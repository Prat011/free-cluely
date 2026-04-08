import Anthropic from "@anthropic-ai/sdk"
import type { LLMProvider, LLMProviderConfig, ChatOptions, ModelInfo } from "./types"

export class ClaudeProvider implements LLMProvider {
  private client: Anthropic
  readonly config: LLMProviderConfig

  constructor(apiKey: string, model: string = "claude-sonnet-4-6") {
    this.client = new Anthropic({ apiKey })
    this.config = {
      id: "claude",
      name: "Anthropic Claude",
      model,
      supportsChat: true,
      supportsVision: true,
      supportsAudio: false,
      supportsStreaming: true,
    }
  }

  async chat(message: string, _options?: ChatOptions): Promise<string> {
    const response = await this.client.messages.create({
      model: this.config.model,
      max_tokens: 4096,
      messages: [{ role: "user", content: message }],
    })
    const block = response.content[0]
    return block && block.type === "text" ? block.text : ""
  }

  async analyzeImage(
    imageData: Buffer,
    mimeType: string,
    prompt: string
  ): Promise<string> {
    const response = await this.client.messages.create({
      model: this.config.model,
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mimeType as "image/png" | "image/jpeg" | "image/gif" | "image/webp",
                data: imageData.toString("base64"),
              },
            },
            { type: "text", text: prompt },
          ],
        },
      ],
    })
    const block = response.content[0]
    return block && block.type === "text" ? block.text : ""
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
      { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6", supportsVision: true, supportsAudio: false },
      { id: "claude-haiku-4-5", name: "Claude Haiku 4.5", supportsVision: true, supportsAudio: false },
      { id: "claude-opus-4-6", name: "Claude Opus 4.6", supportsVision: true, supportsAudio: false },
    ]
  }
}
