import OpenAI from "openai"
import fs from "node:fs"

export interface TranscriptionOptions {
  language?: string
  prompt?: string
}

export interface TranscriptionResult {
  text: string
  timestamp: number
}

export interface VerboseTranscriptionResult extends TranscriptionResult {
  detectedLanguage: string | null
  duration: number | null
}

// ISO 639-1 codes supported by Whisper
const SUPPORTED_LANGUAGES = [
  "af", "am", "ar", "as", "az", "ba", "be", "bg", "bn", "bo",
  "br", "bs", "ca", "cs", "cy", "da", "de", "el", "en", "es",
  "et", "eu", "fa", "fi", "fo", "fr", "gl", "gu", "ha", "haw",
  "he", "hi", "hr", "ht", "hu", "hy", "id", "is", "it", "ja",
  "jw", "ka", "kk", "km", "kn", "ko", "la", "lb", "ln", "lo",
  "lt", "lv", "mg", "mi", "mk", "ml", "mn", "mr", "ms", "mt",
  "my", "ne", "nl", "nn", "no", "oc", "pa", "pl", "ps", "pt",
  "ro", "ru", "sa", "sd", "si", "sk", "sl", "sn", "so", "sq",
  "sr", "su", "sv", "sw", "ta", "te", "tg", "th", "tk", "tl",
  "tr", "tt", "uk", "ur", "uz", "vi", "yi", "yo", "zh", "zu",
]

export class WhisperTranscriptionHelper {
  private client: OpenAI

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey })
  }

  async transcribe(
    filePath: string,
    options?: TranscriptionOptions
  ): Promise<TranscriptionResult> {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Audio file not found: ${filePath}`)
    }

    try {
      const params: any = {
        model: "whisper-1",
        file: fs.createReadStream(filePath),
      }

      if (options?.language) {
        params.language = options.language
      }
      if (options?.prompt) {
        params.prompt = options.prompt
      }

      const response = await this.client.audio.transcriptions.create(params)

      return {
        text: response.text,
        timestamp: Date.now(),
      }
    } catch (error: any) {
      throw new Error(`Whisper transcription failed: ${error.message}`)
    }
  }

  async transcribeVerbose(
    filePath: string,
    options?: TranscriptionOptions
  ): Promise<VerboseTranscriptionResult> {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Audio file not found: ${filePath}`)
    }

    try {
      const params: any = {
        model: "whisper-1",
        file: fs.createReadStream(filePath),
        response_format: "verbose_json",
      }

      if (options?.language) {
        params.language = options.language
      }
      if (options?.prompt) {
        params.prompt = options.prompt
      }

      const response: any = await this.client.audio.transcriptions.create(params)

      return {
        text: response.text,
        detectedLanguage: response.language ?? null,
        duration: response.duration ?? null,
        timestamp: Date.now(),
      }
    } catch (error: any) {
      throw new Error(`Whisper transcription failed: ${error.message}`)
    }
  }

  static getSupportedLanguages(): string[] {
    return [...SUPPORTED_LANGUAGES]
  }
}
