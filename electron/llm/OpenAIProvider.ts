import OpenAI from "openai"
import type { LLMProvider, LLMProviderConfig, ChatOptions, ModelInfo } from "./types"

export class OpenAIProvider implements LLMProvider {
  private client: OpenAI
  readonly config: LLMProviderConfig

  constructor(apiKey: string, model: string = "gpt-4o") {
    this.client = new OpenAI({ apiKey })
    this.config = {
      id: "openai",
      name: "OpenAI",
      model,
      supportsChat: true,
      supportsVision: true,
      supportsAudio: false,
      supportsStreaming: true,
    }
  }

  async chat(message: string, _options?: ChatOptions): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: this.config.model,
      messages: [{ role: "user", content: message }],
    })
    return response.choices[0]?.message?.content ?? ""
  }

  async analyzeImage(
    imageData: Buffer,
    mimeType: string,
    prompt: string
  ): Promise<string> {
    const base64 = imageData.toString("base64")
    const response = await this.client.chat.completions.create({
      model: this.config.model,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: { url: `data:${mimeType};base64,${base64}` },
            },
          ],
        },
      ],
    })
    return response.choices[0]?.message?.content ?? ""
  }

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      await this.chat("Hello")
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  }

  async getAvailableModels(): Promise<ModelInfo[]> {
    return [
      { id: "gpt-4o", name: "GPT-4o", supportsVision: true, supportsAudio: false },
      { id: "gpt-4o-mini", name: "GPT-4o Mini", supportsVision: true, supportsAudio: false },
      { id: "gpt-5-mini", name: "GPT-5 Mini", supportsVision: true, supportsAudio: false },
    ]
  }
}
