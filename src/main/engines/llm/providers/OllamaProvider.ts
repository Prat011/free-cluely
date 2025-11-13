/**
 * Horalix Halo - Ollama Provider
 *
 * Local LLM provider for privacy and offline use
 * Supports any model available through Ollama
 */

import {
  LlmProvider,
  ProviderConfig,
  OllamaProviderConfig,
  LlmError,
  LlmErrorCode,
} from "../types"
import {
  LlmProviderId,
  LlmModelConfig,
  LlmRequestOptions,
  LlmResponseChunk,
} from "../../../state/StateTypes"

export class OllamaProvider implements LlmProvider {
  readonly id: LlmProviderId = "ollama"
  readonly label = "Ollama (Local)"
  readonly description = "Local models for privacy and offline use"
  readonly models: LlmModelConfig[] = []
  readonly requiresApiKey = false
  readonly supportsVision = false
  readonly supportsAudio = false
  readonly supportsStreaming = true

  private config: OllamaProviderConfig
  private baseUrl = "http://localhost:11434"
  private availableModels: string[] = []

  constructor(config: OllamaProviderConfig = { baseUrl: "http://localhost:11434" }) {
    this.config = {
      timeout: 120000, // 2 minutes for local models
      ...config,
    }
    this.baseUrl = config.baseUrl
  }

  async initialize(config: ProviderConfig): Promise<void> {
    this.config = { ...this.config, ...config }
    if (config.baseUrl) {
      this.baseUrl = config.baseUrl
    }

    // Fetch available models
    await this.refreshAvailableModels()
  }

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`)
      if (!response.ok) {
        return { success: false, error: `HTTP ${response.status}` }
      }
      return { success: true }
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Cannot connect to Ollama",
      }
    }
  }

  async getAvailableModels(): Promise<LlmModelConfig[]> {
    await this.refreshAvailableModels()
    return this.models
  }

  async *complete(
    options: LlmRequestOptions
  ): AsyncIterable<LlmResponseChunk> {
    const { modelId, messages, stream = true } = options

    const request = {
      model: modelId,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      stream,
      options: {
        temperature: options.temperature ?? 0.7,
        num_predict: options.maxTokens,
      },
    }

    if (stream) {
      yield* this.streamRequest(request)
    } else {
      const response = await this.makeRequest(request)
      yield {
        type: "final",
        content: response.message.content,
        finishReason: "stop",
      }
    }
  }

  async cancel(_requestId: string): Promise<void> {
    // Ollama doesn't support cancellation well, but we can try
  }

  private async refreshAvailableModels(): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`)
      if (!response.ok) throw new Error("Failed to fetch models")

      const data = await response.json()
      this.availableModels = data.models?.map((m: any) => m.name) || []

      // Convert to LlmModelConfig
      this.models.length = 0
      for (const modelName of this.availableModels) {
        this.models.push({
          id: modelName,
          provider: "ollama",
          label: modelName,
          description: `Local model: ${modelName}`,
          contextWindow: 4096, // Default, varies by model
          maxOutputTokens: 2048,
          defaultTemperature: 0.7,
          capabilities: ["text", "streaming"],
          supportsStreaming: true,
          recommendedUse: ["local"],
          costTier: "free",
        })
      }
    } catch (error) {
      console.error("Failed to fetch Ollama models:", error)
    }
  }

  private async makeRequest(request: any): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      throw new LlmError(
        `Ollama error: ${response.statusText}`,
        LlmErrorCode.SERVER_ERROR,
        this.id,
        true
      )
    }

    return await response.json()
  }

  private async *streamRequest(request: any): AsyncIterable<LlmResponseChunk> {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    })

    if (!response.ok || !response.body) {
      throw new LlmError(
        "Ollama stream error",
        LlmErrorCode.SERVER_ERROR,
        this.id,
        true
      )
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ""

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split("\n")
      buffer = lines.pop() || ""

      for (const line of lines) {
        if (!line.trim()) continue

        try {
          const chunk = JSON.parse(line)
          if (chunk.message?.content) {
            yield {
              type: chunk.done ? "final" : "delta",
              content: chunk.message.content,
              finishReason: chunk.done ? "stop" : undefined,
            }
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
    }
  }
}

export function createOllamaProvider(
  config: OllamaProviderConfig = { baseUrl: "http://localhost:11434" }
): OllamaProvider {
  return new OllamaProvider(config)
}
