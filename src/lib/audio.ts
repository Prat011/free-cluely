export interface PreparedAudio {
  base64: string
  mimeType: string
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const result = reader.result as string
      const base64 = result.split(",")[1]
      if (!base64) {
        reject(new Error("Failed to convert blob to base64"))
        return
      }
      resolve(base64)
    }
    reader.onerror = () => reject(new Error("Failed reading audio blob"))
    reader.readAsDataURL(blob)
  })
}

function writeString(view: DataView, offset: number, value: string): void {
  for (let i = 0; i < value.length; i++) {
    view.setUint8(offset + i, value.charCodeAt(i))
  }
}

function audioBufferToWav(audioBuffer: AudioBuffer): ArrayBuffer {
  const numChannels = audioBuffer.numberOfChannels
  const sampleRate = audioBuffer.sampleRate
  const samples = audioBuffer.length
  const bytesPerSample = 2
  const blockAlign = numChannels * bytesPerSample
  const dataSize = samples * blockAlign
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)

  writeString(view, 0, "RIFF")
  view.setUint32(4, 36 + dataSize, true)
  writeString(view, 8, "WAVE")
  writeString(view, 12, "fmt ")
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * blockAlign, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, 16, true)
  writeString(view, 36, "data")
  view.setUint32(40, dataSize, true)

  const channelData = Array.from({ length: numChannels }, (_, ch) => audioBuffer.getChannelData(ch))
  let offset = 44

  for (let i = 0; i < samples; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channelData[ch][i]))
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff
      view.setInt16(offset, intSample, true)
      offset += 2
    }
  }

  return buffer
}

async function convertBlobToWav(blob: Blob): Promise<Blob> {
  const arrayBuffer = await blob.arrayBuffer()
  const audioContext = new AudioContext()
  try {
    const decoded = await audioContext.decodeAudioData(arrayBuffer.slice(0))
    const wavArrayBuffer = audioBufferToWav(decoded)
    return new Blob([wavArrayBuffer], { type: "audio/wav" })
  } finally {
    await audioContext.close()
  }
}

function isSupportedAudioMime(mimeType: string): boolean {
  const normalized = (mimeType || "").toLowerCase()
  return normalized.includes("wav") || normalized.includes("mp3") || normalized.includes("mpeg")
}

export async function prepareRecordedAudio(blob: Blob): Promise<PreparedAudio> {
  const mimeType = blob.type || "audio/webm"

  if (isSupportedAudioMime(mimeType)) {
    const base64 = await blobToBase64(blob)
    return { base64, mimeType }
  }

  // Convert unsupported browser recorder formats (e.g., webm/opus) to WAV.
  try {
    const wavBlob = await convertBlobToWav(blob)
    const base64 = await blobToBase64(wavBlob)
    return { base64, mimeType: "audio/wav" }
  } catch {
    // Fallback keeps app functional if browser cannot decode the source blob.
    const base64 = await blobToBase64(blob)
    return { base64, mimeType }
  }
}
