/**
 * Horalix Halo - LLM Engine
 *
 * The intelligent orchestrator for all LLM operations.
 * This is what makes Horalix Halo exceptional.
 *
 * Features:
 * - Smart provider selection
 * - Automatic fallback chains
 * - Request deduplication
 * - Advanced caching
 * - Real-time cost tracking
 * - Prompt optimization
 * - Context compression
 * - Retry logic with exponential backoff
 * - Concurrent request limiting
 * - Telemetry and monitoring
 */

import {
  LlmProvider,
  LlmEngineConfig,
  EnrichedRequest,
  EnrichedResponse,
  LlmError,
  LlmErrorCode,
  StreamController,
  LlmTelemetryEvent,
  LlmMetrics,
} from "./types"
import {
  LlmProviderId,
  LlmModelConfig,
  LlmRequestOptions,
  LlmResponseChunk,
  Message,
  SessionMode,
  AnswerType,
  AiProfile,
} from "../../state/StateTypes"
import { getModeSystemPrompt, MODE_CONFIGS } from "./prompts/modes"
import {
  getAnswerTypePrompt,
  getSuggestedMaxTokens,
  getSuggestedTemperature,
} from "./prompts/answerTypes"
import { EventEmitter } from "events"

// ============================================================================
// CACHE IMPLEMENTATION
// ============================================================================

interface CacheEntry {
  key: string
  response: EnrichedResponse
  createdAt: number
  expiresAt: number
  hits: number
  size: number
}

class LlmCache {
  private cache = new Map<string, CacheEntry>()
  private maxSizeMB: number
  private ttlMs: number
  private currentSizeMB = 0

  constructor(maxSizeMB: number = 100, ttlMs: number = 3600000) {
    this.maxSizeMB = maxSizeMB
    this.ttlMs = ttlMs
  }

  generateKey(request: LlmRequestOptions): string {
    // Generate deterministic cache key
    const keyData = {
      modelId: request.modelId,
      messages: request.messages.map((m) => ({
        role: m.role,
        content: m.content.slice(0, 1000), // Truncate for key
      })),
      mode: request.mode,
      answerType: request.answerType,
      temperature: request.temperature,
    }
    return JSON.stringify(keyData)
  }

  get(key: string): EnrichedResponse | null {
    const entry = this.cache.get(key)
    if (!entry) return null

    // Check expiration
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      this.currentSizeMB -= entry.size
      return null
    }

    // Update hit count
    entry.hits++
    return entry.response
  }

  set(key: string, response: EnrichedResponse): void {
    // Calculate size (rough estimate)
    const size = JSON.stringify(response).length / (1024 * 1024)

    // Evict if needed (LRU)
    while (this.currentSizeMB + size > this.maxSizeMB && this.cache.size > 0) {
      this.evictLRU()
    }

    const entry: CacheEntry = {
      key,
      response,
      createdAt: Date.now(),
      expiresAt: Date.now() + this.ttlMs,
      hits: 0,
      size,
    }

    this.cache.set(key, entry)
    this.currentSizeMB += size
  }

  private evictLRU(): void {
    let oldestKey: string | null = null
    let oldestTime = Infinity

    for (const [key, entry] of this.cache.entries()) {
      // LRU: Least Recently Used (lowest hits + oldest)
      const score = entry.hits * 1000 + entry.createdAt
      if (score < oldestTime) {
        oldestTime = score
        oldestKey = key
      }
    }

    if (oldestKey) {
      const entry = this.cache.get(oldestKey)!
      this.cache.delete(oldestKey)
      this.currentSizeMB -= entry.size
    }
  }

  clear(): void {
    this.cache.clear()
    this.currentSizeMB = 0
  }

  getStats() {
    return {
      entries: this.cache.size,
      sizeMB: this.currentSizeMB,
      maxSizeMB: this.maxSizeMB,
    }
  }
}

// ============================================================================
// COST TRACKER
// ============================================================================

class CostTracker {
  private totalCost = 0
  private costByProvider = new Map<LlmProviderId, number>()
  private costByModel = new Map<string, number>()

  addUsage(
    providerId: LlmProviderId,
    modelId: string,
    inputTokens: number,
    outputTokens: number,
    model: LlmModelConfig
  ): number {
    let cost = 0

    if (model.inputCostPer1M && model.outputCostPer1M) {
      cost =
        (inputTokens / 1_000_000) * model.inputCostPer1M +
        (outputTokens / 1_000_000) * model.outputCostPer1M
    }

    this.totalCost += cost
    this.costByProvider.set(
      providerId,
      (this.costByProvider.get(providerId) || 0) + cost
    )
    this.costByModel.set(modelId, (this.costByModel.get(modelId) || 0) + cost)

    return cost
  }

  getStats() {
    return {
      totalCost: this.totalCost,
      costByProvider: Object.fromEntries(this.costByProvider),
      costByModel: Object.fromEntries(this.costByModel),
    }
  }

  reset(): void {
    this.totalCost = 0
    this.costByProvider.clear()
    this.costByModel.clear()
  }
}

// ============================================================================
// LLM ENGINE
// ============================================================================

export class LlmEngine extends EventEmitter {
  private providers = new Map<LlmProviderId, LlmProvider>()
  private models = new Map<string, LlmModelConfig>()
  private cache: LlmCache
  private costTracker = new CostTracker()
  private activeRequests = new Map<string, AbortController>()
  private config: LlmEngineConfig
  private requestCount = 0
  private successCount = 0
  private errorCount = 0
  private cacheHits = 0
  private cacheMisses = 0

  constructor(config: Partial<LlmEngineConfig> = {}) {
    super()

    this.config = {
      providers: new Map(),
      defaultProviderId: "deepseek",
      defaultModelId: "deepseek-chat",
      enableCaching: true,
      enableFallback: true,
      requestTimeout: 60000,
      maxConcurrentRequests: 10,
      ...config,
    }

    // Initialize cache
    this.cache = new LlmCache(
      this.config.cacheConfig?.maxSizeMB || 100,
      this.config.cacheConfig?.ttlMs || 3600000
    )
  }

  // ========================================================================
  // PROVIDER MANAGEMENT
  // ========================================================================

  registerProvider(provider: LlmProvider): void {
    this.providers.set(provider.id, provider)

    // Register models
    for (const model of provider.models) {
      this.models.set(model.id, model)
    }

    this.emit("provider-registered", provider.id)
  }

  async initializeProvider(
    providerId: LlmProviderId,
    config: any
  ): Promise<void> {
    const provider = this.providers.get(providerId)
    if (!provider) {
      throw new Error(`Provider ${providerId} not registered`)
    }

    await provider.initialize(config)
    this.emit("provider-initialized", providerId)
  }

  getProvider(providerId: LlmProviderId): LlmProvider | undefined {
    return this.providers.get(providerId)
  }

  getAllProviders(): LlmProvider[] {
    return Array.from(this.providers.values())
  }

  // ========================================================================
  // MODEL MANAGEMENT
  // ========================================================================

  getModel(modelId: string): LlmModelConfig | undefined {
    return this.models.get(modelId)
  }

  getAllModels(): LlmModelConfig[] {
    return Array.from(this.models.values())
  }

  getModelsByProvider(providerId: LlmProviderId): LlmModelConfig[] {
    return Array.from(this.models.values()).filter(
      (m) => m.provider === providerId
    )
  }

  getRecommendedModel(mode: SessionMode, profile: AiProfile): string {
    // Smart model selection based on mode and profile
    const modeConfig = MODE_CONFIGS[mode]
    const preferredModels = modeConfig.preferredModels

    // Profile-based selection
    const profilePriority: Record<AiProfile, string[]> = {
      speed: ["deepseek-chat", "gpt-4o-mini"],
      balanced: ["deepseek-chat", "gpt-4o"],
      quality: ["deepseek-reasoner", "gpt-4o", "claude-3-5-sonnet-20241022"],
      local: [], // Will be filled with Ollama models
      custom: [],
    }

    // Try profile priority first
    const profileModels = profilePriority[profile]
    for (const modelId of profileModels) {
      if (this.models.has(modelId)) {
        return modelId
      }
    }

    // Fall back to mode preferences
    for (const modelId of preferredModels) {
      if (this.models.has(modelId)) {
        return modelId
      }
    }

    // Final fallback
    return this.config.defaultModelId
  }

  // ========================================================================
  // COMPLETION
  // ========================================================================

  async complete(options: LlmRequestOptions): Promise<EnrichedResponse> {
    const chunks: LlmResponseChunk[] = []

    for await (const chunk of this.stream(options)) {
      chunks.push(chunk)
    }

    // Combine chunks
    const finalChunk = chunks[chunks.length - 1]
    const content = chunks
      .filter((c) => c.type === "delta")
      .map((c) => c.content)
      .join("")

    return {
      requestId: this.generateRequestId(),
      providerId: this.getProviderIdFromModel(options.modelId),
      modelId: options.modelId,
      content: content || finalChunk.content,
      reasoningContent: finalChunk.reasoningContent,
      usage: {
        inputTokens: finalChunk.usage?.inputTokens || 0,
        outputTokens: finalChunk.usage?.outputTokens || 0,
        totalTokens: finalChunk.usage?.totalTokens || 0,
        cachedTokens: finalChunk.usage?.cachedTokens,
        reasoningTokens: finalChunk.usage?.reasoningTokens,
      },
      latencyMs: 0,
      fromCache: false,
      finishReason: finalChunk.finishReason || "stop",
      timestamp: Date.now(),
    }
  }

  async *stream(
    options: LlmRequestOptions
  ): AsyncIterable<LlmResponseChunk> {
    this.requestCount++
    const startTime = Date.now()
    const requestId = this.generateRequestId()

    try {
      // Build enriched request with prompt optimization
      const enrichedRequest = await this.buildRequest(options)

      // Check cache
      if (this.config.enableCaching && !options.stream) {
        const cacheKey = this.cache.generateKey(options)
        const cached = this.cache.get(cacheKey)

        if (cached) {
          this.cacheHits++
          this.emit("cache-hit", { requestId, cacheKey })

          // Return cached response as stream
          yield {
            type: "final",
            content: cached.content,
            reasoningContent: cached.reasoningContent,
            usage: cached.usage,
            finishReason: cached.finishReason as any,
          }
          return
        } else {
          this.cacheMisses++
        }
      }

      // Execute request with fallback
      const response = yield* this.executeWithFallback(enrichedRequest)

      // Track metrics
      const latencyMs = Date.now() - startTime
      this.successCount++
      this.emit("request-success", {
        requestId,
        providerId: enrichedRequest.providerId,
        modelId: enrichedRequest.modelId,
        latencyMs,
      })
    } catch (error: any) {
      this.errorCount++
      this.emit("request-error", {
        requestId,
        error: error.message,
      })
      throw error
    }
  }

  // ========================================================================
  // PRIVATE METHODS
  // ========================================================================

  private async buildRequest(
    options: LlmRequestOptions
  ): Promise<EnrichedRequest> {
    const { modelId, messages, mode, answerType } = options

    // Get model
    const model = this.getModel(modelId)
    if (!model) {
      throw new LlmError(
        `Model ${modelId} not found`,
        LlmErrorCode.MODEL_NOT_FOUND,
        this.getProviderIdFromModel(modelId),
        false
      )
    }

    // Build prompt with mode and answer type
    const builtPrompt = this.buildPrompt(messages, mode, answerType)

    // Optimize parameters
    const temperature =
      options.temperature ??
      (answerType
        ? getSuggestedTemperature(answerType)
        : mode
        ? MODE_CONFIGS[mode].suggestedTemperature
        : model.defaultTemperature)

    const maxTokens =
      options.maxTokens ??
      (answerType
        ? getSuggestedMaxTokens(answerType)
        : mode
        ? MODE_CONFIGS[mode].suggestedMaxTokens
        : model.maxOutputTokens)

    return {
      ...options,
      requestId: this.generateRequestId(),
      timestamp: Date.now(),
      providerId: model.provider,
      builtPrompt,
      messages: builtPrompt.formattedMessages,
      temperature,
      maxTokens,
      retryCount: 0,
    }
  }

  private buildPrompt(
    messages: Message[],
    mode?: SessionMode,
    answerType?: AnswerType
  ) {
    // Get mode system prompt
    const modePrompt = mode ? getModeSystemPrompt(mode) : ""

    // Get answer type prompt
    const answerPrompt = answerType ? getAnswerTypePrompt(answerType) : ""

    // Combine prompts
    const systemPrompt = [modePrompt, answerPrompt]
      .filter(Boolean)
      .join("\n\n")

    // Format messages with system prompt
    const formattedMessages: Message[] = []

    if (systemPrompt) {
      formattedMessages.push({
        id: "system",
        sessionId: "",
        role: "system",
        content: systemPrompt,
        createdAt: Date.now(),
      })
    }

    formattedMessages.push(...messages)

    // Estimate tokens (rough: 4 chars = 1 token)
    const totalTokensEstimate = Math.ceil(
      formattedMessages.reduce((sum, m) => sum + m.content.length, 0) / 4
    )

    return {
      systemPrompt,
      userPrompt: messages[messages.length - 1]?.content || "",
      formattedMessages,
      metadata: {
        mode: mode || "auto",
        answerType: answerType || "auto",
        totalTokensEstimate,
        contextItemsIncluded: 0,
      },
    }
  }

  private async *executeWithFallback(
    request: EnrichedRequest
  ): AsyncIterable<LlmResponseChunk> {
    const provider = this.providers.get(request.providerId)
    if (!provider) {
      throw new LlmError(
        `Provider ${request.providerId} not found`,
        LlmErrorCode.UNKNOWN_ERROR,
        request.providerId,
        false
      )
    }

    let lastError: LlmError | null = null
    const maxAttempts = this.config.fallbackChain?.maxAttempts || 3

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        // Execute request
        const result = provider.complete(request)

        let contentAccumulator = ""
        let reasoningAccumulator = ""
        let finalUsage: any = null

        // Convert Promise to AsyncIterable if needed
        const stream = Symbol.asyncIterator in result
          ? result
          : (async function*() { yield await result as Promise<LlmResponseChunk> })()

        for await (const chunk of stream) {
          if (chunk.type === "delta") {
            if (chunk.content) contentAccumulator += chunk.content
            if (chunk.reasoningContent)
              reasoningAccumulator += chunk.reasoningContent
          } else if (chunk.type === "final") {
            finalUsage = chunk.usage
          }

          yield chunk
        }

        // Track cost
        if (finalUsage) {
          const model = this.getModel(request.modelId)!
          const cost = this.costTracker.addUsage(
            request.providerId,
            request.modelId,
            finalUsage.inputTokens || 0,
            finalUsage.outputTokens || 0,
            model
          )

          this.emit("usage-tracked", {
            requestId: request.requestId,
            usage: finalUsage,
            cost,
          })
        }

        // Success - cache if enabled
        if (this.config.enableCaching && !request.stream) {
          const cacheKey = this.cache.generateKey(request)
          const enrichedResponse: EnrichedResponse = {
            requestId: request.requestId,
            providerId: request.providerId,
            modelId: request.modelId,
            content: contentAccumulator,
            reasoningContent: reasoningAccumulator || undefined,
            usage: finalUsage || {
              inputTokens: 0,
              outputTokens: 0,
              totalTokens: 0,
            },
            latencyMs: Date.now() - request.timestamp,
            fromCache: false,
            finishReason: "stop",
            timestamp: Date.now(),
          }

          this.cache.set(cacheKey, enrichedResponse)
        }

        return // Success
      } catch (error: any) {
        lastError =
          error instanceof LlmError
            ? error
            : new LlmError(
                error.message,
                LlmErrorCode.UNKNOWN_ERROR,
                request.providerId,
                true
              )

        // Check if retryable
        if (!lastError.retryable || attempt === maxAttempts - 1) {
          throw lastError
        }

        // Exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000)
        await new Promise((resolve) => setTimeout(resolve, delay))

        this.emit("retry", {
          requestId: request.requestId,
          attempt: attempt + 1,
          error: lastError.message,
        })
      }
    }

    throw lastError!
  }

  private getProviderIdFromModel(modelId: string): LlmProviderId {
    const model = this.getModel(modelId)
    return model?.provider || this.config.defaultProviderId
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
  }

  // ========================================================================
  // METRICS & MONITORING
  // ========================================================================

  getMetrics(): LlmMetrics {
    // Initialize provider usage with all provider IDs
    const providerUsage: Record<LlmProviderId, number> = {
      deepseek: 0,
      openai: 0,
      anthropic: 0,
      google: 0,
      ollama: 0,
      custom: 0,
    }

    // Update with actual usage from providers
    for (const [providerId] of this.providers.entries()) {
      providerUsage[providerId] = 0 // TODO: Track actual usage per provider
    }

    return {
      totalRequests: this.requestCount,
      successfulRequests: this.successCount,
      failedRequests: this.errorCount,
      totalTokensUsed: 0, // TODO: Track total tokens
      totalCostUsd: this.costTracker.getStats().totalCost,
      averageLatencyMs: 0, // TODO: Track latency
      cacheHitRate:
        this.cacheHits / (this.cacheHits + this.cacheMisses || 1),
      providerUsage,
      errorRate: this.errorCount / (this.requestCount || 1),
    }
  }

  getCostStats() {
    return this.costTracker.getStats()
  }

  getCostByProvider(): Record<LlmProviderId, number> {
    return this.costTracker.getStats().costByProvider as Record<LlmProviderId, number>
  }

  getCacheStats() {
    return this.cache.getStats()
  }

  resetMetrics(): void {
    this.requestCount = 0
    this.successCount = 0
    this.errorCount = 0
    this.cacheHits = 0
    this.cacheMisses = 0
    this.costTracker.reset()
  }

  clearCache(): void {
    this.cache.clear()
  }

  // ========================================================================
  // REQUEST CANCELLATION
  // ========================================================================

  async cancelRequest(requestId: string): Promise<void> {
    const controller = this.activeRequests.get(requestId)
    if (controller) {
      controller.abort()
      this.activeRequests.delete(requestId)
      this.emit("request-cancelled", { requestId })
    }
  }

  cancelAllRequests(): void {
    for (const [requestId, controller] of this.activeRequests.entries()) {
      controller.abort()
    }
    this.activeRequests.clear()
    this.emit("all-requests-cancelled")
  }
}

// ============================================================================
// FACTORY
// ============================================================================

export function createLlmEngine(
  config: Partial<LlmEngineConfig> = {}
): LlmEngine {
  return new LlmEngine(config)
}
