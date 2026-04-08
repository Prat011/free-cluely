import type { LLMProvider, LLMProviderConfig, ChatOptions, ModelInfo } from "./types"

interface OllamaResponse {
  response: string
  done: boolean
}

export class OllamaProvider implements LLMProvider {
  private url: string
  readonly config: LLMProviderConfig

  constructor(model: string = "llama3.2", url: string = "http://localhost:11434") {
    this.url = url
    this.config = {
      id: "ollama",
      name: "Ollama (Local)",
      model,
      supportsChat: true,
      supportsVision: false, // updated dynamically if vision model detected
      supportsAudio: false,
      supportsStreaming: true,
    }
  }

  async chat(message: string, _options?: ChatOptions): Promise<string> {
    const response = await fetch(`${this.url}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.config.model,
        prompt: message,
        stream: false,
        options: { temperature: 0.7, top_p: 0.9 },
      }),
    })

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status} ${response.statusText}`)
    }

    const data: OllamaResponse = await response.json()
    return data.response
  }

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.url}/api/tags`)
      if (!response.ok) {
        return { success: false, error: `Ollama not available at ${this.url}` }
      }
      await this.chat("Hello")
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  }

  async getAvailableModels(): Promise<ModelInfo[]> {
    try {
      const response = await fetch(`${this.url}/api/tags`)
      if (!response.ok) return []
      const data = await response.json()
      return (data.models ?? []).map((m: any) => ({
        id: m.name,
        name: m.name,
        supportsVision: m.name.includes("vision") || m.name.includes("llava"),
        supportsAudio: false,
      }))
    } catch {
      return []
    }
  }

  setModel(model: string): void {
    (this.config as any).model = model
  }

  getUrl(): string {
    return this.url
  }
}
