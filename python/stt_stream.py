# pyright: reportMissingImports=false

import argparse
import audioop
import json
import os
import queue
import signal
import sys
import time
from contextlib import ExitStack
from typing import Any


SourceType = str


def flush_event(event_type: str, text: str, source: SourceType | None = None) -> None:
    payload = {"type": event_type, "text": text}
    if source:
        payload["source"] = source
    print(json.dumps(payload, ensure_ascii=True), flush=True)


def normalize_source_mode(value: str) -> str:
    normalized = (value or "").strip().lower()
    if normalized in {"mic", "system", "both"}:
        return normalized
    return "both"


def get_hostapi_name(sd, device_index: int) -> str:
    devices = sd.query_devices()
    hostapis = sd.query_hostapis()
    hostapi_index = int(devices[device_index]["hostapi"])
    return str(hostapis[hostapi_index]["name"])


def find_wasapi_output_device(sd) -> int | None:
    devices = sd.query_devices()

    def is_wasapi_output(index: int) -> bool:
        device = devices[index]
        if int(device.get("max_output_channels", 0)) <= 0:
            return False
        hostapi_name = get_hostapi_name(sd, index).lower()
        return "wasapi" in hostapi_name

    try:
        default_output = int(sd.default.device[1])
        if default_output >= 0 and is_wasapi_output(default_output):
            return default_output
    except Exception:
        pass

    for idx in range(len(devices)):
        if is_wasapi_output(idx):
            return idx

    return None


def find_system_capture_input_devices(sd) -> list[tuple[int, int]]:
    devices = sd.query_devices()
    preferred_markers = ["stereo mix", "loopback", "what u hear", "monitor"]

    def get_input_channels(index: int) -> int:
        return int(devices[index].get("max_input_channels", 0))

    candidates: list[tuple[int, int]] = []
    for idx in range(len(devices)):
        input_channels = get_input_channels(idx)
        if input_channels <= 0:
            continue

        name = str(devices[idx].get("name", "")).lower()
        if any(marker in name for marker in preferred_markers):
            candidates.append((idx, max(1, min(input_channels, 2))))
    return candidates


def find_mic_input_devices(sd) -> list[tuple[int, int]]:
    devices = sd.query_devices()

    def get_input_channels(index: int) -> int:
        return int(devices[index].get("max_input_channels", 0))

    preferred_markers = ["microphone", "mic", "array", "headset"]
    avoid_markers = ["stereo mix", "loopback", "what u hear", "monitor"]

    ordered: list[tuple[int, int]] = []
    seen: set[int] = set()

    try:
        default_input = int(sd.default.device[0])
        if default_input >= 0:
            channels = get_input_channels(default_input)
            if channels > 0:
                ordered.append((default_input, max(1, min(channels, 2))))
                seen.add(default_input)
    except Exception:
        pass

    for idx in range(len(devices)):
        if idx in seen:
            continue

        channels = get_input_channels(idx)
        if channels <= 0:
            continue

        name = str(devices[idx].get("name", "")).lower()
        if any(marker in name for marker in avoid_markers):
            continue

        if any(marker in name for marker in preferred_markers):
            ordered.append((idx, max(1, min(channels, 2))))
            seen.add(idx)

    for idx in range(len(devices)):
        if idx in seen:
            continue

        channels = get_input_channels(idx)
        if channels <= 0:
            continue

        name = str(devices[idx].get("name", "")).lower()
        if any(marker in name for marker in avoid_markers):
            continue

        ordered.append((idx, max(1, min(channels, 2))))
        seen.add(idx)

    return ordered


def build_wasapi_loopback_settings(sd):
    try:
        return sd.WasapiSettings(loopback=True)
    except TypeError:
        return None
    except Exception:
        return None


def resolve_input_samplerate(sd, device_index: int, channels: int, preferred_rate: int, extra_settings=None) -> int | None:
    try:
        sd.check_input_settings(
            device=device_index,
            channels=channels,
            dtype="int16",
            extra_settings=extra_settings,
            samplerate=preferred_rate,
        )
        return preferred_rate
    except Exception:
        pass

    try:
        device_info = sd.query_devices(device_index)
        fallback_rate = int(float(device_info.get("default_samplerate", preferred_rate)))
    except Exception:
        fallback_rate = preferred_rate

    try:
        sd.check_input_settings(
            device=device_index,
            channels=channels,
            dtype="int16",
            extra_settings=extra_settings,
            samplerate=fallback_rate,
        )
        return fallback_rate
    except Exception:
        return None


def to_mono_pcm16(data: bytes, channels: int) -> bytes:
    if channels <= 1:
        return data

    # Convert multi-channel PCM16 stream to mono to improve recognizer consistency.
    return audioop.tomono(data, 2, 0.5, 0.5)


def normalize_mic_pcm16(data: bytes, max_gain: float, target_rms: int) -> bytes:
    if max_gain <= 1.0:
        return data

    try:
        rms = audioop.rms(data, 2)
        if rms <= 0:
            return data

        desired_gain = target_rms / max(rms, 1)
        gain = min(max_gain, max(1.0, desired_gain))
        if gain <= 1.01:
            return data

        return audioop.mul(data, 2, gain)
    except Exception:
        return data


def parse_recognizer_result(raw: str, key: str) -> str:
    try:
        payload = json.loads(raw)
        return str(payload.get(key) or "").strip()
    except Exception:
        return ""


def run_vosk(model_path: str, sample_rate: int, source_mode: str) -> None:
    try:
        import sounddevice as sd  # pyright: ignore[reportMissingImports]
        from vosk import KaldiRecognizer, Model  # pyright: ignore[reportMissingImports]
    except Exception as exc:
        flush_event("error", f"Missing vosk dependencies: {exc}")
        sys.exit(1)

    source_mode = normalize_source_mode(source_mode)
    mic_max_gain = max(1.0, min(float(os.getenv("STT_MIC_MAX_GAIN", "1.8")), 3.0))
    mic_target_rms = max(400, min(int(os.getenv("STT_MIC_TARGET_RMS", "1800")), 6000))

    audio_queues: dict[str, "queue.Queue[bytes]"] = {}
    recognizers: dict[str, Any] = {}
    stream_channels: dict[str, int] = {}
    stream_configs: list[dict[str, Any]] = []

    try:
        model = Model(model_path)
    except Exception as exc:
        flush_event(
            "error",
            f"Failed to create Vosk model from '{model_path}'. The model may be missing, incomplete, or incompatible. Details: {exc}",
        )
        sys.exit(1)

    def make_callback(source: str):
        def callback(indata, _frames, _time, status):
            if status:
                flush_event("warn", str(status), source)
            audio_queues[source].put(bytes(indata))

        return callback

    if source_mode in {"mic", "both"}:
        mic_stream_kwargs: dict[str, Any] | None = None
        for device_index, channels in find_mic_input_devices(sd):
            capture_rate = resolve_input_samplerate(sd, device_index, channels, sample_rate)
            if capture_rate is None:
                continue

            mic_stream_kwargs = {
                "samplerate": capture_rate,
                "blocksize": 8000,
                "dtype": "int16",
                "channels": channels,
                "device": device_index,
                "callback": make_callback("mic"),
            }
            break

        if mic_stream_kwargs is None:
            flush_event("error", "Microphone input could not be initialized for STT.")
            sys.exit(1)

        device_name = "unknown"
        try:
            device_info = sd.query_devices(int(mic_stream_kwargs["device"]))
            device_name = str(device_info.get("name", "unknown"))
        except Exception:
            pass

        flush_event(
            "status",
            f"mic configured: device={device_name}, rate={int(mic_stream_kwargs['samplerate'])}, channels={int(mic_stream_kwargs['channels'])}",
        )

        audio_queues["mic"] = queue.Queue()
        recognizers["mic"] = KaldiRecognizer(model, int(mic_stream_kwargs["samplerate"]))
        stream_channels["mic"] = int(mic_stream_kwargs["channels"])
        stream_configs.append(
            {
                "source": "mic",
                "kwargs": mic_stream_kwargs,
            }
        )

    if source_mode in {"system", "both"}:
        system_stream_kwargs: dict[str, Any] | None = None

        capture_inputs = find_system_capture_input_devices(sd)
        for device_index, input_channels in capture_inputs:
            capture_rate = resolve_input_samplerate(sd, device_index, input_channels, sample_rate)
            if capture_rate is None:
                continue

            system_stream_kwargs = {
                "samplerate": capture_rate,
                "blocksize": 8000,
                "dtype": "int16",
                "channels": input_channels,
                "device": device_index,
                "callback": make_callback("system"),
            }
            break
        else:
            wasapi_output = find_wasapi_output_device(sd)
            wasapi_loopback = build_wasapi_loopback_settings(sd)

            if wasapi_output is None or wasapi_loopback is None:
                if source_mode == "system":
                    flush_event(
                        "error",
                        "System audio capture could not be initialized. Enable a system-capture input device (e.g., Stereo Mix) or use a sounddevice build that supports WASAPI loopback.",
                    )
                    sys.exit(1)
                flush_event(
                    "warn",
                    "System audio capture is unavailable on this machine. Falling back to microphone-only transcription.",
                )
                system_stream_kwargs = None

            if system_stream_kwargs is None and wasapi_output is not None and wasapi_loopback is not None:
                output_info: Any = sd.query_devices(wasapi_output)
                max_output_channels = 2
                try:
                    max_output_channels = int(output_info.get("max_output_channels", 2))
                except Exception:
                    pass
                output_channels = max(1, min(max_output_channels, 2))
                output_rate = resolve_input_samplerate(
                    sd,
                    wasapi_output,
                    output_channels,
                    sample_rate,
                    extra_settings=wasapi_loopback,
                )
                if output_rate is None:
                    if source_mode == "system":
                        flush_event(
                            "error",
                            "System audio capture could not be initialized for any supported sample rate.",
                        )
                        sys.exit(1)
                    flush_event(
                        "warn",
                        "System audio capture sample-rate negotiation failed. Falling back to microphone-only transcription.",
                    )
                    system_stream_kwargs = None
                else:
                    system_stream_kwargs = {
                        "samplerate": output_rate,
                        "blocksize": 8000,
                        "dtype": "int16",
                        "channels": output_channels,
                        "device": wasapi_output,
                        "extra_settings": wasapi_loopback,
                        "callback": make_callback("system"),
                    }

        if system_stream_kwargs is not None:
            audio_queues["system"] = queue.Queue()
            recognizers["system"] = KaldiRecognizer(model, int(system_stream_kwargs["samplerate"]))
            stream_channels["system"] = int(system_stream_kwargs["channels"])
            stream_configs.append(
                {
                    "source": "system",
                    "kwargs": system_stream_kwargs,
                }
            )

    if not stream_configs:
        flush_event("error", "No audio inputs could be initialized for STT.")
        sys.exit(1)

    stopped = False

    def handler(_sig, _frame):
        nonlocal stopped
        stopped = True

    signal.signal(signal.SIGINT, handler)
    signal.signal(signal.SIGTERM, handler)

    try:
        with ExitStack() as stack:
            for config in stream_configs:
                stack.enter_context(sd.RawInputStream(**config["kwargs"]))

            active_sources = ", ".join(cfg["source"] for cfg in stream_configs)
            flush_event("status", f"listening ({active_sources})")

            while not stopped:
                processed_any = False
                for source, audio_q in audio_queues.items():
                    try:
                        data = audio_q.get_nowait()
                    except queue.Empty:
                        continue

                    processed_any = True
                    recognizer = recognizers[source]
                    mono_data = to_mono_pcm16(data, stream_channels.get(source, 1))
                    if source == "mic":
                        mono_data = normalize_mic_pcm16(mono_data, mic_max_gain, mic_target_rms)
                    if recognizer.AcceptWaveform(mono_data):
                        text = parse_recognizer_result(recognizer.Result(), "text")
                        if text:
                            flush_event("final", text, source)
                    else:
                        partial = parse_recognizer_result(recognizer.PartialResult(), "partial")
                        if partial:
                            flush_event("partial", partial, source)

                if not processed_any:
                    time.sleep(0.01)

    except Exception as exc:
        flush_event("error", f"Failed to start audio stream: {exc}")
        sys.exit(1)

    for source, recognizer in recognizers.items():
        final_text = parse_recognizer_result(recognizer.FinalResult(), "text")
        if final_text:
            flush_event("final", final_text, source)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--engine", default="vosk", choices=["vosk"])
    parser.add_argument("--model", required=True)
    parser.add_argument("--sample-rate", type=int, default=16000)
    parser.add_argument("--source", default="both", choices=["mic", "system", "both"])
    args = parser.parse_args()

    if args.engine == "vosk":
        run_vosk(args.model, args.sample_rate, args.source)


if __name__ == "__main__":
    main()
