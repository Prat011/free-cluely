import argparse
import json
import os
import shutil
import tempfile
import urllib.request
import zipfile


def emit(event_type: str, text: str) -> None:
    print(json.dumps({"type": event_type, "text": text}, ensure_ascii=True), flush=True)


def choose_model_dir(dest_root: str) -> str | None:
    if not os.path.isdir(dest_root):
        return None

    candidates = [
        os.path.join(dest_root, name)
        for name in os.listdir(dest_root)
        if name.lower().startswith("vosk-model") and os.path.isdir(os.path.join(dest_root, name))
    ]
    if not candidates:
        return None

    candidates.sort()
    return candidates[0]


def download_file(url: str, target_path: str) -> None:
    emit("status", f"Downloading Vosk model archive from {url}")
    with urllib.request.urlopen(url) as response, open(target_path, "wb") as out:
        shutil.copyfileobj(response, out)


def extract_zip(zip_path: str, target_dir: str) -> None:
    emit("status", "Extracting Vosk model archive")
    with zipfile.ZipFile(zip_path, "r") as archive:
        archive.extractall(target_dir)


def ensure_model(url: str, dest_root: str) -> str:
    existing = choose_model_dir(dest_root)
    if existing:
        emit("status", f"Vosk model already present: {existing}")
        return existing

    os.makedirs(dest_root, exist_ok=True)

    with tempfile.TemporaryDirectory() as tmp:
        archive_path = os.path.join(tmp, "vosk-model.zip")
        download_file(url, archive_path)
        extract_zip(archive_path, dest_root)

    installed = choose_model_dir(dest_root)
    if not installed:
        raise RuntimeError("Vosk model archive extracted, but no vosk-model* directory was found.")

    emit("status", f"Vosk model installed: {installed}")
    return installed


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", required=True)
    parser.add_argument("--dest-root", required=True)
    args = parser.parse_args()

    try:
        model_dir = ensure_model(args.url, args.dest_root)
        emit("result", model_dir)
    except Exception as exc:
        emit("error", str(exc))
        raise


if __name__ == "__main__":
    main()
