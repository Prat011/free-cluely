/**
 * Horalix Halo - Google Provider
 *
 * Supports Gemini models - Google's flagship AI
 * Excellent multimodal capabilities and long context
 */

import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai"
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
// GOOGLE MODELS
// ============================================================================

const GOOGLE_MODELS: LlmModelConfig[] = [
  {
    id: "gemini-2.0-flash",
    provider: "google",
    label: "Gemini 2.0 Flash",
    description:
      "Latest Gemini model with multimodal capabilities. Fast and capable.",
    contextWindow: 1000000,
    maxOutputTokens: 8192,
    defaultTemperature: 0.7,
    capabilities: ["text", "vision", "audio", "streaming"],
    supportsStreaming: true,
    recommendedUse: ["general", "meeting", "research"],
    costTier: "low",
    inputCostPer1M: 0.075,
    outputCostPer1M: 0.3,
  },
  {
    id: "gemini-1.5-pro",
    provider: "google",
    label: "Gemini 1.5 Pro",
    description:
      "Powerful model with massive context window. Great for long documents.",
    contextWindow: 2000000,
    maxOutputTokens: 8192,
    defaultTemperature: 0.7,
    capabilities: ["text", "vision", "audio", "streaming"],
    supportsStreaming: true,
    recommendedUse: ["research", "general"],
    costTier: "medium",
    inputCostPer1M: 1.25,
    outputCostPer1M: 5.0,
  },
  {
    id: "gemini-1.5-flash",
    provider: "google",
    label: "Gemini 1.5 Flash",
    description: "Fast and affordable. Good for high-volume tasks.",
    contextWindow: 1000000,
    maxOutputTokens: 8192,
    defaultTemperature: 0.7,
    capabilities: ["text", "vision", "audio", "streaming"],
    supportsStreaming: true,
    recommendedUse: ["fast", "general"],
    costTier: "low",
    inputCostPer1M: 0.075,
    outputCostPer1M: 0.3,
  },
]

// ============================================================================
// GOOGLE PROVIDER
// ============================================================================

export class GoogleProvider implements LlmProvider {
  readonly id: LlmProviderId = "google"
  readonly label = "Google"
  readonly description =
    "Google Gemini - Advanced multimodal AI with massive context windows"
  readonly models = GOOGLE_MODELS
  readonly requiresApiKey = true
  readonly supportsVision = true
  readonly supportsAudio = true
  readonly supportsStreaming = true

  private genAI: GoogleGenerativeAI | null = null
  private config: ProviderConfig
  private modelInstances = new Map<string, GenerativeModel>()

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
        "Google API key is required",
        LlmErrorCode.INVALID_API_KEY,
        this.id,
        false
      )
    }

    this.genAI = new GoogleGenerativeAI(config.apiKey)
  }

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    if (!this.genAI) {
      return {
        success: false,
        error: "Client not initialized",
      }
    }

    try {
      const model = this.genAI.getGenerativeModel({
        model: "gemini-1.5-flash",
      })
      const result = await model.generateContent("Hello")
      await result.response.text()

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
    if (!this.genAI) {
      throw new LlmError(
        "Client not initialized",
        LlmErrorCode.INVALID_REQUEST,
        this.id,
        false
      )
    }

    const { modelId, messages, stream = true } = options

    // Validate model
    const modelConfig = this.models.find((m) => m.id === modelId)
    if (!modelConfig) {
      throw new LlmError(
        `Model ${modelId} not found`,
        LlmErrorCode.MODEL_NOT_FOUND,
        this.id,
        false
      )
    }

    // Get or create model instance
    let model = this.modelInstances.get(modelId)
    if (!model) {
      model = this.genAI.getGenerativeModel({
        model: modelId,
        generationConfig: {
          temperature: options.temperature ?? modelConfig.defaultTemperature,
          maxOutputTokens: options.maxTokens ?? modelConfig.maxOutputTokens,
          topP: options.topP,
          stopSequences: options.stop,
        },
      })
      this.modelInstances.set(modelId, model)
    }

    // Convert messages to Gemini format
    const geminiMessages = this.convertMessages(messages)

    // Execute request
    try {
      if (stream) {
        yield* this.streamRequest(model, geminiMessages)
      } else {
        const result = await model.generateContent(geminiMessages)
        const response = await result.response
        yield {
          type: "final",
          content: response.text(),
          usage: {
            inputTokens: response.usageMetadata?.promptTokenCount || 0,
            outputTokens: response.usageMetadata?.candidatesTokenCount || 0,
            totalTokens: response.usageMetadata?.totalTokenCount || 0,
          },
          finishReason: "stop",
        }
      }
    } catch (error: any) {
      throw this.wrapError(error)
    }
  }

  async cancel(requestId: string): Promise<void> {
    // Gemini SDK doesn't support cancellation well
  }

  // ========================================================================
  // PRIVATE METHODS
  // ========================================================================

  private convertMessages(messages: Message[]): string {
    // Gemini uses a single prompt string for simple cases
    // For complex multi-turn, we'd need to use chat session
    return messages.map((m) => `${m.role}: ${m.content}`).join("\n\n")
  }

  private async *streamRequest(
    model: GenerativeModel,
    prompt: string
  ): AsyncIterable<LlmResponseChunk> {
    try {
      const result = await model.generateContentStream(prompt)

      let contentAccumulator = ""

      for await (const chunk of result.stream) {
        const chunkText = chunk.text()
        contentAccumulator += chunkText

        yield {
          type: "delta",
          content: chunkText,
        }
      }

      const response = await result.response
      yield {
        type: "final",
        content: contentAccumulator,
        usage: {
          inputTokens: response.usageMetadata?.promptTokenCount || 0,
          outputTokens: response.usageMetadata?.candidatesTokenCount || 0,
          totalTokens: response.usageMetadata?.totalTokenCount || 0,
        },
        finishReason: "stop",
      }
    } catch (error: any) {
      throw this.wrapError(error)
    }
  }

  private wrapError(error: any): LlmError {
    if (error instanceof LlmError) {
      return error
    }

    let errorCode = LlmErrorCode.UNKNOWN_ERROR
    let retryable = false

    // Map common Gemini errors
    if (error.message?.includes("API key")) {
      errorCode = LlmErrorCode.INVALID_API_KEY
    } else if (error.message?.includes("quota") || error.message?.includes("limit")) {
      errorCode = LlmErrorCode.RATE_LIMIT_EXCEEDED
      retryable = true
    } else if (error.message?.includes("safety")) {
      errorCode = LlmErrorCode.SAFETY_FILTER
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

export function createGoogleProvider(
  config: ProviderConfig = {}
): GoogleProvider {
  return new GoogleProvider(config)
}
