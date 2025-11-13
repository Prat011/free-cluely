/**
 * Horalix Halo - Anthropic Provider
 *
 * Supports Claude models - among the best AI models available
 * Exceptional at reasoning, coding, and long-context tasks
 */

import Anthropic from "@anthropic-ai/sdk"
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
// ANTHROPIC MODELS
// ============================================================================

const ANTHROPIC_MODELS: LlmModelConfig[] = [
  {
    id: "claude-sonnet-4-20250514",
    provider: "anthropic",
    label: "Claude Sonnet 4.5",
    description:
      "Latest and most capable Claude model. Exceptional at reasoning, coding, and analysis.",
    contextWindow: 200000,
    maxOutputTokens: 8192,
    defaultTemperature: 0.7,
    capabilities: ["text", "vision", "streaming", "reasoning"],
    supportsStreaming: true,
    recommendedUse: ["general", "coding", "reasoning", "research"],
    costTier: "medium",
    inputCostPer1M: 3.0,
    outputCostPer1M: 15.0,
  },
  {
    id: "claude-3-5-sonnet-20241022",
    provider: "anthropic",
    label: "Claude 3.5 Sonnet",
    description:
      "Highly capable and fast. Great balance of intelligence and speed.",
    contextWindow: 200000,
    maxOutputTokens: 8192,
    defaultTemperature: 0.7,
    capabilities: ["text", "vision", "streaming"],
    supportsStreaming: true,
    recommendedUse: ["general", "coding", "meeting"],
    costTier: "medium",
    inputCostPer1M: 3.0,
    outputCostPer1M: 15.0,
  },
  {
    id: "claude-3-5-haiku-20241022",
    provider: "anthropic",
    label: "Claude 3.5 Haiku",
    description: "Fast and affordable. Great for quick tasks and high volume.",
    contextWindow: 200000,
    maxOutputTokens: 8192,
    defaultTemperature: 0.7,
    capabilities: ["text", "vision", "streaming"],
    supportsStreaming: true,
    recommendedUse: ["fast", "general", "meeting"],
    costTier: "low",
    inputCostPer1M: 0.8,
    outputCostPer1M: 4.0,
  },
  {
    id: "claude-3-opus-20240229",
    provider: "anthropic",
    label: "Claude 3 Opus",
    description:
      "Most powerful Claude 3 model. Best for complex tasks requiring deep analysis.",
    contextWindow: 200000,
    maxOutputTokens: 4096,
    defaultTemperature: 0.7,
    capabilities: ["text", "vision", "streaming"],
    supportsStreaming: true,
    recommendedUse: ["reasoning", "research"],
    costTier: "premium",
    inputCostPer1M: 15.0,
    outputCostPer1M: 75.0,
  },
]

// ============================================================================
// ANTHROPIC PROVIDER
// ============================================================================

export class AnthropicProvider implements LlmProvider {
  readonly id: LlmProviderId = "anthropic"
  readonly label = "Anthropic"
  readonly description =
    "Anthropic Claude - Exceptional reasoning and long-context capabilities"
  readonly models = ANTHROPIC_MODELS
  readonly requiresApiKey = true
  readonly supportsVision = true
  readonly supportsAudio = false
  readonly supportsStreaming = true

  private client: Anthropic | null = null
  private config: ProviderConfig
  private activeRequests = new Map<string, AbortController>()

  constructor(config: ProviderConfig = {}) {
    this.config = {
      timeout: 60000,
      maxRetries: 3,
      ...config,
    }
  }

  // ========================================================================
  // INITIALIZATION
  // ========================================================================

  async initialize(config: ProviderConfig): Promise<void> {
    this.config = { ...this.config, ...config }

    if (!config.apiKey) {
      throw new LlmError(
        "Anthropic API key is required",
        LlmErrorCode.INVALID_API_KEY,
        this.id,
        false
      )
    }

    this.client = new Anthropic({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
      timeout: this.config.timeout,
      maxRetries: this.config.maxRetries,
    })
  }

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    if (!this.client) {
      return {
        success: false,
        error: "Client not initialized",
      }
    }

    try {
      // Make a minimal test request
      const message = await this.client.messages.create({
        model: "claude-3-5-haiku-20241022",
        max_tokens: 10,
        messages: [{ role: "user", content: "Hello" }],
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
    if (!this.client) {
      throw new LlmError(
        "Client not initialized",
        LlmErrorCode.INVALID_REQUEST,
        this.id,
        false
      )
    }

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

    // Convert messages to Anthropic format
    const anthropicMessages = this.convertMessages(messages)

    // Extract system message
    const systemMessage = messages.find((m) => m.role === "system")?.content

    // Build request
    const request: Anthropic.MessageCreateParams = {
      model: modelId,
      max_tokens: options.maxTokens ?? model.maxOutputTokens,
      messages: anthropicMessages,
      temperature: options.temperature ?? model.defaultTemperature,
      top_p: options.topP,
      stop_sequences: options.stop,
      stream,
    }

    if (systemMessage) {
      request.system = systemMessage
    }

    // Execute request
    if (stream) {
      yield* this.streamRequest(request)
    } else {
      const response = await this.client.messages.create(request)
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

  // ========================================================================
  // PRIVATE METHODS
  // ========================================================================

  private convertMessages(
    messages: Message[]
  ): Anthropic.MessageParam[] {
    return messages
      .filter((m) => m.role !== "system") // System is separate in Anthropic
      .map((msg) => ({
        role: msg.role === "user" ? "user" : "assistant",
        content: msg.content,
      })) as Anthropic.MessageParam[]
  }

  private async *streamRequest(
    request: Anthropic.MessageCreateParams
  ): AsyncIterable<LlmResponseChunk> {
    if (!this.client) throw new Error("Client not initialized")

    try {
      const stream = await this.client.messages.create({
        ...request,
        stream: true,
      })

      let contentAccumulator = ""
      let inputTokens = 0
      let outputTokens = 0

      for await (const chunk of stream) {
        switch (chunk.type) {
          case "message_start":
            inputTokens = chunk.message.usage.input_tokens
            break

          case "content_block_delta":
            if (chunk.delta.type === "text_delta") {
              const text = chunk.delta.text
              contentAccumulator += text
              yield {
                type: "delta",
                content: text,
              }
            }
            break

          case "message_delta":
            if (chunk.usage) {
              outputTokens = chunk.usage.output_tokens
            }

            if (chunk.delta.stop_reason) {
              yield {
                type: "final",
                content: contentAccumulator,
                usage: {
                  inputTokens,
                  outputTokens,
                  totalTokens: inputTokens + outputTokens,
                },
                finishReason: this.mapStopReason(chunk.delta.stop_reason),
              }
            }
            break

          case "message_stop":
            // Final message
            break

          case "error":
            throw new Error(chunk.error.message)
        }
      }
    } catch (error: any) {
      throw this.wrapError(error)
    }
  }

  private convertResponse(
    response: Anthropic.Message
  ): LlmResponseChunk {
    const content =
      response.content
        .filter((block) => block.type === "text")
        .map((block) => (block as Anthropic.TextBlock).text)
        .join("") || ""

    return {
      type: "final",
      content,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        totalTokens:
          response.usage.input_tokens + response.usage.output_tokens,
      },
      finishReason: this.mapStopReason(response.stop_reason),
    }
  }

  private mapStopReason(
    reason: string | null
  ): "stop" | "length" | "content_filter" | "error" {
    switch (reason) {
      case "end_turn":
        return "stop"
      case "max_tokens":
        return "length"
      case "stop_sequence":
        return "stop"
      default:
        return "stop"
    }
  }

  private wrapError(error: any): LlmError {
    if (error instanceof LlmError) {
      return error
    }

    // Map Anthropic errors to LlmError
    let errorCode = LlmErrorCode.UNKNOWN_ERROR
    let retryable = false

    if (error.status === 401) {
      errorCode = LlmErrorCode.INVALID_API_KEY
    } else if (error.status === 429) {
      errorCode = LlmErrorCode.RATE_LIMIT_EXCEEDED
      retryable = true
    } else if (error.status === 400) {
      errorCode = LlmErrorCode.INVALID_REQUEST
    } else if (error.status === 404) {
      errorCode = LlmErrorCode.MODEL_NOT_FOUND
    } else if (error.status >= 500) {
      errorCode = LlmErrorCode.SERVER_ERROR
      retryable = true
    }

    return new LlmError(
      error.message || "Unknown error",
      errorCode,
      this.id,
      retryable,
      error
    )
  }
}

// ============================================================================
// FACTORY
// ============================================================================

export function createAnthropicProvider(
  config: ProviderConfig = {}
): AnthropicProvider {
  return new AnthropicProvider(config)
}
