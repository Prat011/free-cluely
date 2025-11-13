/**
 * Horalix Halo - DeepSeek Provider
 *
 * Primary LLM provider with support for:
 * - DeepSeek Chat (fast, affordable)
 * - DeepSeek Reasoner (advanced chain-of-thought reasoning)
 *
 * DeepSeek offers exceptional quality-to-cost ratio and is our recommended primary provider.
 */

import {
  LlmProvider,
  ProviderConfig,
  DeepSeekProviderConfig,
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
// DEEPSEEK MODELS CONFIGURATION
// ============================================================================

const DEEPSEEK_MODELS: LlmModelConfig[] = [
  {
    id: "deepseek-chat",
    provider: "deepseek",
    label: "DeepSeek Chat",
    description:
      "Fast, affordable, and highly capable. Best for most tasks. Exceptional quality-to-cost ratio.",
    contextWindow: 64000,
    maxOutputTokens: 8192,
    defaultTemperature: 0.7,
    capabilities: ["text", "vision", "streaming"],
    supportsStreaming: true,
    recommendedUse: ["general", "coding", "meeting", "fast"],
    costTier: "low",
    inputCostPer1M: 0.14,
    outputCostPer1M: 0.28,
  },
  {
    id: "deepseek-reasoner",
    provider: "deepseek",
    label: "DeepSeek Reasoner",
    description:
      "Advanced reasoning model with visible chain-of-thought. Best for complex problems requiring deep analysis.",
    contextWindow: 64000,
    maxOutputTokens: 8192,
    defaultTemperature: 0.6,
    capabilities: ["text", "reasoning", "streaming"],
    supportsStreaming: true,
    recommendedUse: ["reasoning", "research", "meeting"],
    costTier: "medium",
    inputCostPer1M: 0.55,
    outputCostPer1M: 2.19,
    betaFeatures: ["Chain-of-thought reasoning extraction"],
  },
]

// ============================================================================
// DEEPSEEK API TYPES
// ============================================================================

interface DeepSeekMessage {
  role: "system" | "user" | "assistant"
  content: string
}

interface DeepSeekCompletionRequest {
  model: string
  messages: DeepSeekMessage[]
  temperature?: number
  max_tokens?: number
  top_p?: number
  frequency_penalty?: number
  presence_penalty?: number
  stop?: string[]
  stream?: boolean
}

interface DeepSeekCompletionChoice {
  index: number
  message: {
    role: string
    content: string
    reasoning_content?: string  // DeepSeek Reasoner specific
  }
  finish_reason: string
}

interface DeepSeekCompletionResponse {
  id: string
  object: string
  created: number
  model: string
  choices: DeepSeekCompletionChoice[]
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
    prompt_cache_hit_tokens?: number
    prompt_cache_miss_tokens?: number
    completion_reasoning_tokens?: number  // DeepSeek Reasoner
  }
}

interface DeepSeekStreamChunk {
  id: string
  object: string
  created: number
  model: string
  choices: Array<{
    index: number
    delta: {
      role?: string
      content?: string
      reasoning_content?: string
    }
    finish_reason: string | null
  }>
  usage?: DeepSeekCompletionResponse["usage"]
}

// ============================================================================
// DEEPSEEK PROVIDER IMPLEMENTATION
// ============================================================================

export class DeepSeekProvider implements LlmProvider {
  readonly id: LlmProviderId = "deepseek"
  readonly label = "DeepSeek"
  readonly description =
    "DeepSeek AI - Exceptional reasoning and coding capabilities at low cost"
  readonly models = DEEPSEEK_MODELS
  readonly requiresApiKey = true
  readonly supportsVision = true
  readonly supportsAudio = false
  readonly supportsStreaming = true

  private config: DeepSeekProviderConfig
  private apiKey: string | null = null
  private baseUrl = "https://api.deepseek.com/v1"
  private activeRequests = new Map<string, AbortController>()

  constructor(config: DeepSeekProviderConfig = {}) {
    this.config = {
      timeout: 60000, // 60 seconds
      maxRetries: 3,
      enableReasoningExtraction: true,
      reasoningVerbosity: "medium",
      ...config,
    }
  }

  // ========================================================================
  // INITIALIZATION
  // ========================================================================

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
        "DeepSeek API key is required",
        LlmErrorCode.INVALID_API_KEY,
        this.id,
        false
      )
    }
  }

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    if (!this.apiKey) {
      return {
        success: false,
        error: "API key not configured",
      }
    }

    try {
      // Make a minimal test request
      const response = await this.makeRequest({
        model: "deepseek-chat",
        messages: [{ role: "user", content: "Hello" }],
        max_tokens: 10,
      })

      return { success: true }
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Connection test failed",
      }
    }
  }

  // ========================================================================
  // COMPLETION
  // ========================================================================

  async *complete(
    options: LlmRequestOptions
  ): AsyncIterable<LlmResponseChunk> {
    const { modelId, messages, stream = true } = options

    // Validate model
    const model = this.models.find((m) => m.id === modelId)
    if (!model) {
      throw new LlmError(
        `Model ${modelId} not found`,
        LlmErrorCode.MODEL_NOT_FOUND,
        this.id,
        false
      )
    }

    // Build DeepSeek request
    const request: DeepSeekCompletionRequest = {
      model: modelId,
      messages: this.convertMessages(messages),
      temperature: options.temperature ?? model.defaultTemperature,
      max_tokens: options.maxTokens ?? model.maxOutputTokens,
      top_p: options.topP,
      frequency_penalty: options.frequencyPenalty,
      presence_penalty: options.presencePenalty,
      stop: options.stop,
      stream,
    }

    // Execute request
    if (stream) {
      yield* this.streamRequest(request, modelId)
    } else {
      const response = await this.makeRequest(request)
      yield this.convertResponse(response, modelId)
    }
  }

  async cancel(requestId: string): Promise<void> {
    const controller = this.activeRequests.get(requestId)
    if (controller) {
      controller.abort()
      this.activeRequests.delete(requestId)
    }
  }

  // ========================================================================
  // PRIVATE METHODS
  // ========================================================================

  private convertMessages(messages: Message[]): DeepSeekMessage[] {
    return messages.map((msg) => ({
      role: msg.role === "system" ? "system" : msg.role === "user" ? "user" : "assistant",
      content: msg.content,
    }))
  }

  private async makeRequest(
    request: DeepSeekCompletionRequest
  ): Promise<DeepSeekCompletionResponse> {
    const requestId = this.generateRequestId()
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

      const data: DeepSeekCompletionResponse = await response.json()
      return data
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

  private async *streamRequest(
    request: DeepSeekCompletionRequest,
    modelId: string
  ): AsyncIterable<LlmResponseChunk> {
    const requestId = this.generateRequestId()
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

      // Parse SSE stream
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""
      let contentAccumulator = ""
      let reasoningAccumulator = ""
      let finalUsage: any = null

      while (true) {
        const { done, value } = await reader.read()

        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() || ""

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6)

            if (data === "[DONE]") {
              // Yield final chunk
              yield {
                type: "final",
                content: contentAccumulator,
                reasoningContent: reasoningAccumulator || undefined,
                usage: finalUsage || undefined,
                finishReason: "stop",
              }
              return
            }

            try {
              const chunk: DeepSeekStreamChunk = JSON.parse(data)
              const delta = chunk.choices[0]?.delta

              if (delta?.content) {
                contentAccumulator += delta.content
                yield {
                  type: "delta",
                  content: delta.content,
                }
              }

              // DeepSeek Reasoner: Extract reasoning content
              if (delta?.reasoning_content && this.config.enableReasoningExtraction) {
                reasoningAccumulator += delta.reasoning_content
                yield {
                  type: "delta",
                  content: "",
                  reasoningContent: delta.reasoning_content,
                }
              }

              // Capture final usage stats
              if (chunk.usage) {
                finalUsage = {
                  inputTokens: chunk.usage.prompt_tokens,
                  outputTokens: chunk.usage.completion_tokens,
                  totalTokens: chunk.usage.total_tokens,
                  cachedTokens: chunk.usage.prompt_cache_hit_tokens,
                  reasoningTokens: chunk.usage.completion_reasoning_tokens,
                }
              }
            } catch (parseError) {
              console.error("Failed to parse SSE chunk:", parseError)
            }
          }
        }
      }
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

  private convertResponse(
    response: DeepSeekCompletionResponse,
    modelId: string
  ): LlmResponseChunk {
    const choice = response.choices[0]

    return {
      type: "final",
      content: choice.message.content,
      reasoningContent: choice.message.reasoning_content,
      usage: {
        inputTokens: response.usage.prompt_tokens,
        outputTokens: response.usage.completion_tokens,
        totalTokens: response.usage.total_tokens,
        cachedTokens: response.usage.prompt_cache_hit_tokens,
        reasoningTokens: response.usage.completion_reasoning_tokens,
      },
      finishReason: choice.finish_reason as any,
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
      case 404:
        errorCode = LlmErrorCode.MODEL_NOT_FOUND
        break
      case 500:
      case 502:
      case 503:
        errorCode = LlmErrorCode.SERVER_ERROR
        retryable = true
        break
      default:
        errorCode = LlmErrorCode.UNKNOWN_ERROR
        retryable = response.status >= 500
    }

    throw new LlmError(errorMessage, errorCode, this.id, retryable, errorData)
  }

  private wrapError(error: any): LlmError {
    if (error instanceof LlmError) {
      return error
    }

    if (error.name === "TypeError" && error.message.includes("fetch")) {
      return new LlmError(
        "Network error - check internet connection",
        LlmErrorCode.NETWORK_ERROR,
        this.id,
        true,
        error
      )
    }

    return new LlmError(
      error.message || "Unknown error",
      LlmErrorCode.UNKNOWN_ERROR,
      this.id,
      false,
      error
    )
  }

  private generateRequestId(): string {
    return `deepseek_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
  }
}

// ============================================================================
// FACTORY
// ============================================================================

export function createDeepSeekProvider(
  config: DeepSeekProviderConfig = {}
): DeepSeekProvider {
  return new DeepSeekProvider(config)
}
