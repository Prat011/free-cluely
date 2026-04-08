import { GoogleGenAI } from "@google/genai"
import type { LLMProvider, LLMProviderConfig, ChatOptions, ModelInfo } from "./types"

const DEFAULT_MODEL = "gemini-2.5-flash"

export class GeminiProvider implements LLMProvider {
  private client: GoogleGenAI
  readonly config: LLMProviderConfig

  constructor(apiKey: string, model: string = DEFAULT_MODEL) {
    this.client = new GoogleGenAI({ apiKey })
    this.config = {
      id: "gemini",
      name: "Google Gemini",
      model,
      supportsChat: true,
      supportsVision: true,
      supportsAudio: true,
      supportsStreaming: true,
    }
  }

  async chat(message: string, _options?: ChatOptions): Promise<string> {
    return this.generate(message)
  }

  async analyzeImage(
    imageData: Buffer,
    mimeType: string,
    prompt: string
  ): Promise<string> {
    return this.generate([
      { text: prompt },
      { inlineData: { data: imageData.toString("base64"), mimeType } },
    ])
  }

  async analyzeAudio(
    audioData: Buffer,
    mimeType: string,
    prompt: string
  ): Promise<string> {
    return this.generate([
      { text: prompt },
      { inlineData: { data: audioData.toString("base64"), mimeType } },
    ])
  }

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      const text = await this.generate("Hello")
      if (text) return { success: true }
      return { success: false, error: "Empty response from Gemini" }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  }

  async getAvailableModels(): Promise<ModelInfo[]> {
    return [
      { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", supportsVision: true, supportsAudio: true },
      { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", supportsVision: true, supportsAudio: true },
    ]
  }

  async generate(contents: string | object[]): Promise<string> {
    const result = await this.client.models.generateContent({
      model: this.config.model,
      contents,
    })
    return result.text ?? ""
  }
}
