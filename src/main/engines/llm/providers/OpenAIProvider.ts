/**
 * Horalix Halo - OpenAI Provider
 *
 * Supports GPT-4, GPT-4 Turbo, GPT-3.5, and future models
 * Industry-standard API with excellent reliability
 */

import {
  LlmProvider,
  ProviderConfig,
  LlmError,
  LlmErrorCode,
} from "../types"
import {
  LlmProviderId,
  LlmModelConfig,
  LlmRequestOptions,
  LlmResponseChunk,
  Message,
} from "../../../state/StateTypes"

// ============================================================================
// OPENAI MODELS
// ============================================================================

const OPENAI_MODELS: LlmModelConfig[] = [
  {
    id: "gpt-4o",
    provider: "openai",
    label: "GPT-4o",
    description: "Most capable GPT-4 model with vision. Excellent for complex tasks.",
    contextWindow: 128000,
    maxOutputTokens: 16384,
    defaultTemperature: 0.7,
    capabilities: ["text", "vision", "streaming", "function-calling"],
    supportsStreaming: true,
    recommendedUse: ["general", "coding", "research", "meeting"],
    costTier: "medium",
    inputCostPer1M: 2.50,
    outputCostPer1M: 10.00,
  },
  {
    id: "gpt-4o-mini",
    provider: "openai",
    label: "GPT-4o Mini",
    description: "Fast and affordable GPT-4 class model. Great for most tasks.",
    contextWindow: 128000,
    maxOutputTokens: 16384,
    defaultTemperature: 0.7,
    capabilities: ["text", "vision", "streaming", "function-calling"],
    supportsStreaming: true,
    recommendedUse: ["general", "fast", "meeting"],
    costTier: "low",
    inputCostPer1M: 0.15,
    outputCostPer1M: 0.60,
  },
  {
    id: "gpt-4-turbo",
    provider: "openai",
    label: "GPT-4 Turbo",
    description: "Previous generation flagship. Still highly capable.",
    contextWindow: 128000,
    maxOutputTokens: 4096,
    defaultTemperature: 0.7,
    capabilities: ["text", "vision", "streaming", "function-calling"],
    supportsStreaming: true,
    recommendedUse: ["general", "coding"],
    costTier: "high",
    inputCostPer1M: 10.00,
    outputCostPer1M: 30.00,
  },
]

// ============================================================================
// OPENAI PROVIDER
// ============================================================================

export class OpenAIProvider implements LlmProvider {
  readonly id: LlmProviderId = "openai"
  readonly label = "OpenAI"
  readonly description = "OpenAI GPT models - Industry-leading language models"
  readonly models = OPENAI_MODELS
  readonly requiresApiKey = true
  readonly supportsVision = true
  readonly supportsAudio = true
  readonly supportsStreaming = true

  private config: ProviderConfig
  private apiKey: string | null = null
  private baseUrl = "https://api.openai.com/v1"
  private activeRequests = new Map<string, AbortController>()

  constructor(config: ProviderConfig = {}) {
    this.config = {
      timeout: 60000,
      maxRetries: 3,
      ...config,
    }
  }

  async initialize(config: ProviderConfig): Promise<void> {
    this.config = { ...this.config, ...config }

    if (config.apiKey) {
      this.apiKey = config.apiKey
    }

    if (config.baseUrl) {
      this.baseUrl = config.baseUrl
    }

    if (!this.apiKey) {
      throw new LlmError(
        "OpenAI API key is required",
        LlmErrorCode.INVALID_API_KEY,
        this.id,
        false
      )
    }
  }

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    if (!this.apiKey) {
      return { success: false, error: "API key not configured" }
    }

    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        return {
          success: false,
          error: error.error?.message || "Connection test failed",
        }
      }

      return { success: true }
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Network error",
      }
    }
  }

  async *complete(
    options: LlmRequestOptions
  ): AsyncIterable<LlmResponseChunk> {
    const { modelId, messages, stream = true } = options

    const model = this.models.find((m) => m.id === modelId)
    if (!model) {
      throw new LlmError(
        `Model ${modelId} not found`,
        LlmErrorCode.MODEL_NOT_FOUND,
        this.id,
        false
      )
    }

    const request = {
      model: modelId,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      temperature: options.temperature ?? model.defaultTemperature,
      max_tokens: options.maxTokens ?? model.maxOutputTokens,
      top_p: options.topP,
      frequency_penalty: options.frequencyPenalty,
      presence_penalty: options.presencePenalty,
      stop: options.stop,
      stream,
    }

    if (stream) {
      yield* this.streamRequest(request)
    } else {
      const response = await this.makeRequest(request)
      yield this.convertResponse(response)
    }
  }

  async cancel(requestId: string): Promise<void> {
    const controller = this.activeRequests.get(requestId)
    if (controller) {
      controller.abort()
      this.activeRequests.delete(requestId)
    }
  }

  private async makeRequest(request: any): Promise<any> {
    const requestId = `openai_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
    const controller = new AbortController()
    this.activeRequests.set(requestId, controller)

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
          ...this.config.customHeaders,
        },
        body: JSON.stringify(request),
        signal: controller.signal,
      })

      if (!response.ok) {
        await this.handleErrorResponse(response)
      }

      return await response.json()
    } catch (error: any) {
      if (error.name === "AbortError") {
        throw new LlmError(
          "Request cancelled",
          LlmErrorCode.UNKNOWN_ERROR,
          this.id,
          false
        )
      }
      throw this.wrapError(error)
    } finally {
      this.activeRequests.delete(requestId)
    }
  }

  private async *streamRequest(request: any): AsyncIterable<LlmResponseChunk> {
    const requestId = `openai_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
    const controller = new AbortController()
    this.activeRequests.set(requestId, controller)

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
          ...this.config.customHeaders,
        },
        body: JSON.stringify(request),
        signal: controller.signal,
      })

      if (!response.ok) {
        await this.handleErrorResponse(response)
      }

      if (!response.body) {
        throw new LlmError(
          "No response body",
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
          if (line.startsWith("data: ")) {
            const data = line.slice(6)
            if (data === "[DONE]") return

            try {
              const chunk = JSON.parse(data)
              const delta = chunk.choices[0]?.delta

              if (delta?.content) {
                yield {
                  type: "delta",
                  content: delta.content,
                }
              }

              if (chunk.choices[0]?.finish_reason) {
                yield {
                  type: "final",
                  content: "",
                  finishReason: chunk.choices[0].finish_reason,
                }
              }
            } catch (e) {
              // Ignore parse errors
            }
          }
        }
      }
    } finally {
      this.activeRequests.delete(requestId)
    }
  }

  private convertResponse(response: any): LlmResponseChunk {
    return {
      type: "final",
      content: response.choices[0].message.content,
      usage: {
        inputTokens: response.usage?.prompt_tokens,
        outputTokens: response.usage?.completion_tokens,
        totalTokens: response.usage?.total_tokens,
      },
      finishReason: response.choices[0].finish_reason,
    }
  }

  private async handleErrorResponse(response: Response): Promise<never> {
    const errorData = await response.json().catch(() => ({}))
    const errorMessage =
      errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`

    let errorCode: LlmErrorCode
    let retryable = false

    switch (response.status) {
      case 401:
        errorCode = LlmErrorCode.INVALID_API_KEY
        break
      case 429:
        errorCode = LlmErrorCode.RATE_LIMIT_EXCEEDED
        retryable = true
        break
      case 400:
        errorCode = LlmErrorCode.INVALID_REQUEST
        break
      default:
        errorCode = LlmErrorCode.UNKNOWN_ERROR
        retryable = response.status >= 500
    }

    throw new LlmError(errorMessage, errorCode, this.id, retryable, errorData)
  }

  private wrapError(error: any): LlmError {
    if (error instanceof LlmError) return error

    return new LlmError(
      error.message || "Unknown error",
      LlmErrorCode.UNKNOWN_ERROR,
      this.id,
      false,
      error
    )
  }
}

export function createOpenAIProvider(config: ProviderConfig = {}): OpenAIProvider {
  return new OpenAIProvider(config)
}
