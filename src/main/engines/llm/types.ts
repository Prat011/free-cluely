/**
 * Horalix Halo - LLM Engine Type Definitions
 *
 * Core interfaces for the multi-provider LLM system.
 * Designed for maximum extensibility and type safety.
 */

import {
  LlmProviderId,
  LlmModelConfig,
  LlmRequestOptions,
  LlmResponseChunk,
  Message,
  SessionMode,
  AnswerType,
  MeetingActionType,
  MeetingContext,
  TokenUsage,
  LlmMetrics,
} from "../../state/StateTypes"

// Re-export for convenience
export type {
  LlmProviderId,
  LlmModelConfig,
  LlmRequestOptions,
  LlmResponseChunk,
  Message,
  SessionMode,
  AnswerType,
  MeetingActionType,
  MeetingContext,
  TokenUsage,
  LlmMetrics,
}

// ============================================================================
// PROVIDER INTERFACE
// ============================================================================

/**
 * Core interface that all LLM providers must implement.
 * Supports both streaming and non-streaming responses.
 */
export interface LlmProvider {
  readonly id: LlmProviderId
  readonly label: string
  readonly description: string
  readonly models: LlmModelConfig[]
  readonly requiresApiKey: boolean
  readonly supportsVision: boolean
  readonly supportsAudio: boolean
  readonly supportsStreaming: boolean

  /**
   * Initialize the provider with configuration
   */
  initialize(config: ProviderConfig): Promise<void>

  /**
   * Test connection and authentication
   */
  testConnection(): Promise<{ success: boolean; error?: string }>

  /**
   * Make a completion request
   * Returns AsyncIterable for streaming, or single response
   */
  complete(
    options: LlmRequestOptions
  ): AsyncIterable<LlmResponseChunk> | Promise<LlmResponseChunk>

  /**
   * Cancel ongoing request
   */
  cancel?(requestId: string): Promise<void>

  /**
   * Get available models (dynamic, for providers like Ollama)
   */
  getAvailableModels?(): Promise<LlmModelConfig[]>
}

// ============================================================================
// PROVIDER CONFIGURATION
// ============================================================================

export interface ProviderConfig {
  apiKey?: string
  baseUrl?: string
  organization?: string
  timeout?: number
  maxRetries?: number
  customHeaders?: Record<string, string>
  metadata?: Record<string, any>
}

export interface DeepSeekProviderConfig extends ProviderConfig {
  enableReasoningExtraction?: boolean
  reasoningVerbosity?: "low" | "medium" | "high"
}

export interface OllamaProviderConfig extends ProviderConfig {
  baseUrl: string  // Required for Ollama (e.g., http://localhost:11434)
  keepAlive?: string
  numCtx?: number
  numGpu?: number
}

export interface CustomProviderConfig extends ProviderConfig {
  baseUrl: string  // Required for custom endpoints
  modelMapping?: Record<string, string>  // Map internal IDs to external model names
  authType?: "bearer" | "api-key" | "custom"
}

// ============================================================================
// PROMPT BUILDING
// ============================================================================

export interface PromptContext {
  mode: SessionMode
  answerType: AnswerType
  sessionHistory?: Message[]
  contextItems?: string[]  // IDs of context items to include
  meetingContext?: MeetingContext
  memorySummary?: string
  timeWindow?: TimeWindow
  metadata?: Record<string, any>
}

export interface TimeWindow {
  startTime: number
  endTime: number
  durationMinutes: number
}

export interface BuiltPrompt {
  systemPrompt: string
  userPrompt: string
  formattedMessages: Message[]
  metadata: {
    mode: SessionMode
    answerType: AnswerType
    totalTokensEstimate: number
    contextItemsIncluded: number
  }
}

// ============================================================================
// MEETING PROMPT BUILDING
// ============================================================================

export interface MeetingPromptOptions {
  action: MeetingActionType
  transcriptText: string
  transcriptTimeWindow: TimeWindow
  meetingContext?: MeetingContext
  sessionMemory?: string
  answerType?: AnswerType
  previousMessages?: Message[]
}

export interface MeetingPromptResult extends BuiltPrompt {
  action: MeetingActionType
  suggestedTemperature?: number
  suggestedMaxTokens?: number
}

// ============================================================================
// LLM ENGINE CONFIGURATION
// ============================================================================

export interface LlmEngineConfig {
  providers: Map<LlmProviderId, LlmProvider>
  defaultProviderId: LlmProviderId
  defaultModelId: string
  enableCaching: boolean
  cacheConfig?: CacheConfig
  enableFallback: boolean
  fallbackChain?: FallbackChainConfig
  requestTimeout: number
  maxConcurrentRequests: number
}

export interface CacheConfig {
  maxSizeMB: number
  ttlMs: number
  strategy: "lru" | "lfu" | "fifo"
  excludePatterns?: string[]
}

export interface FallbackChainConfig {
  chain: Array<{
    providerId: LlmProviderId
    modelId: string
    condition?: "on-error" | "on-rate-limit" | "on-timeout"
  }>
  maxAttempts: number
}

// ============================================================================
// REQUEST/RESPONSE ENRICHMENT
// ============================================================================

export interface EnrichedRequest extends LlmRequestOptions {
  requestId: string
  timestamp: number
  providerId: LlmProviderId
  builtPrompt: BuiltPrompt
  cacheKey?: string
  retryCount: number
}

export interface EnrichedResponse {
  requestId: string
  providerId: LlmProviderId
  modelId: string
  content: string
  reasoningContent?: string
  usage: {
    inputTokens: number
    outputTokens: number
    totalTokens: number
    cachedTokens?: number
    reasoningTokens?: number
    estimatedCostUsd?: number
  }
  latencyMs: number
  fromCache: boolean
  finishReason: string
  timestamp: number
  metadata?: Record<string, any>
}

// ============================================================================
// STREAMING TYPES
// ============================================================================

export interface StreamController {
  requestId: string
  abort: () => void
  pause: () => void
  resume: () => void
  onChunk: (chunk: LlmResponseChunk) => void
  onError: (error: Error) => void
  onComplete: (response: EnrichedResponse) => void
}

export interface StreamOptions {
  bufferSize?: number
  flushIntervalMs?: number
  enableBackpressure?: boolean
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

export class LlmError extends Error {
  constructor(
    message: string,
    public readonly code: LlmErrorCode,
    public readonly providerId: LlmProviderId,
    public readonly retryable: boolean = false,
    public readonly details?: any
  ) {
    super(message)
    this.name = "LlmError"
  }
}

export enum LlmErrorCode {
  // Authentication
  INVALID_API_KEY = "INVALID_API_KEY",
  AUTHENTICATION_FAILED = "AUTHENTICATION_FAILED",

  // Rate Limiting
  RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED",
  QUOTA_EXCEEDED = "QUOTA_EXCEEDED",

  // Request Errors
  INVALID_REQUEST = "INVALID_REQUEST",
  MODEL_NOT_FOUND = "MODEL_NOT_FOUND",
  CONTEXT_LENGTH_EXCEEDED = "CONTEXT_LENGTH_EXCEEDED",
  INVALID_PARAMETERS = "INVALID_PARAMETERS",

  // Server Errors
  SERVER_ERROR = "SERVER_ERROR",
  SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE",
  TIMEOUT = "TIMEOUT",

  // Network Errors
  NETWORK_ERROR = "NETWORK_ERROR",
  CONNECTION_FAILED = "CONNECTION_FAILED",

  // Content Errors
  CONTENT_FILTER = "CONTENT_FILTER",
  SAFETY_FILTER = "SAFETY_FILTER",

  // Unknown
  UNKNOWN_ERROR = "UNKNOWN_ERROR",
}

// ============================================================================
// MODEL REGISTRY
// ============================================================================

export interface ModelRegistry {
  getAllModels(): LlmModelConfig[]
  getModelsByProvider(providerId: LlmProviderId): LlmModelConfig[]
  getModelById(modelId: string): LlmModelConfig | undefined
  getRecommendedModels(
    criteria: ModelSearchCriteria
  ): LlmModelConfig[]
  registerModel(model: LlmModelConfig): void
  updateModel(modelId: string, updates: Partial<LlmModelConfig>): void
}

export interface ModelSearchCriteria {
  capability?: string
  recommendedUse?: string
  costTier?: "free" | "low" | "medium" | "high" | "premium"
  minContextWindow?: number
  supportsStreaming?: boolean
  provider?: LlmProviderId
}

// ============================================================================
// TELEMETRY & MONITORING
// ============================================================================

export interface LlmTelemetryEvent {
  type: "request" | "response" | "error" | "cache-hit" | "cache-miss"
  requestId: string
  providerId: LlmProviderId
  modelId: string
  timestamp: number
  duration?: number
  tokenCount?: number
  cost?: number
  error?: string
  metadata?: Record<string, any>
}

export interface LlmMetrics {
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  totalTokensUsed: number
  totalCostUsd: number
  averageLatencyMs: number
  cacheHitRate: number
  providerUsage: Record<LlmProviderId, number>
  errorRate: number
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export type ProviderFactory = (config: ProviderConfig) => LlmProvider

export interface ProviderRegistration {
  id: LlmProviderId
  factory: ProviderFactory
  defaultConfig?: ProviderConfig
  priority?: number
}
