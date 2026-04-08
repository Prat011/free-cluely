// AudioWorkletProcessor: Float32 -> Int16 PCM -> base64, posts every ~100ms
class PcmProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this._buffer = []
    this._bytesPerChunk = 16000 * 2 * 0.1 // 16kHz * 2 bytes * 100ms = 3200 bytes
  }

  process(inputs) {
    const input = inputs[0]
    if (!input || !input[0]) return true

    const samples = input[0]
    for (let i = 0; i < samples.length; i++) {
      // Clamp and convert Float32 [-1, 1] to Int16
      const s = Math.max(-1, Math.min(1, samples[i]))
      const val = s < 0 ? s * 0x8000 : s * 0x7fff
      this._buffer.push(val & 0xff)
      this._buffer.push((val >> 8) & 0xff)
    }

    if (this._buffer.length >= this._bytesPerChunk) {
      const chunk = new Uint8Array(this._buffer)
      this._buffer = []
      this.port.postMessage({
        type: "pcm-chunk",
        data: this._uint8ToBase64(chunk),
      })
    }

    return true
  }

  _uint8ToBase64(uint8Array) {
    let binary = ""
    for (let i = 0; i < uint8Array.length; i++) {
      binary += String.fromCharCode(uint8Array[i])
    }
    return btoa(binary)
  }
}

registerProcessor("pcm-processor", PcmProcessor)
