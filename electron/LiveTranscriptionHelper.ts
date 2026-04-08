import { GoogleGenAI, Modality, Session } from "@google/genai"
import { BrowserWindow } from "electron"

export class LiveTranscriptionHelper {
  private apiKey: string
  private session: Session | null = null
  private mainWindow: BrowserWindow | null = null
  private connecting = false

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async connect(mainWindow: BrowserWindow, language: string): Promise<void> {
    if (this.connecting) return
    this.connecting = true

    try {
      await this.disconnect()
      this.mainWindow = mainWindow

      const client = new GoogleGenAI({ apiKey: this.apiKey })

      const systemInstruction = language.startsWith("ja")
        ? "音声を聞いて、何も返答しないでください。無言でいてください。"
        : "Listen to the audio and do not respond. Stay silent."

      this.session = await client.live.connect({
        model: "gemini-2.5-flash-native-audio-preview-12-2025",
        config: {
          inputAudioTranscription: {},
          responseModalities: [Modality.AUDIO],
          systemInstruction: { parts: [{ text: systemInstruction }] },
        },
        callbacks: {
          onopen: () => {
            console.log("[LiveTranscription] Session opened")
          },
          onmessage: (msg: any) => {
            const transcription =
              msg?.serverContent?.inputTranscription?.text
            if (transcription) {
              this.sendToRenderer("speaker-transcription", {
                text: transcription,
                isFinal: true,
                timestamp: Date.now(),
              })
            }
          },
          onerror: (err: any) => {
            console.error("[LiveTranscription] Error:", err)
          },
          onclose: (ev: any) => {
            console.log("[LiveTranscription] Session closed", ev?.reason ?? "")
            this.session = null
            this.sendToRenderer("speaker-transcription-status", {
              status: "disconnected",
            })
          },
        },
      })

      this.sendToRenderer("speaker-transcription-status", {
        status: "connected",
      })
    } finally {
      this.connecting = false
    }
  }

  sendAudioChunk(base64Pcm: string): void {
    if (!this.session) return
    try {
      this.session.sendRealtimeInput({
        audio: {
          data: base64Pcm,
          mimeType: "audio/pcm;rate=16000",
        },
      })
    } catch (err) {
      console.error("[LiveTranscription] Failed to send audio chunk:", err)
    }
  }

  async disconnect(): Promise<void> {
    if (this.session) {
      try {
        this.session.close()
      } catch {
        // ignore close errors
      }
      this.session = null
    }
    this.mainWindow = null
  }

  isConnected(): boolean {
    return this.session !== null
  }

  private sendToRenderer(channel: string, data: unknown): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data)
    }
  }
}
