/**
 * Horalix Halo - Core State Type Definitions
 *
 * This file contains all TypeScript interfaces and types for the application state.
 * Designed for extensibility, type safety, and clarity.
 */

// ============================================================================
// SESSION TYPES
// ============================================================================

export type SessionMode = "auto" | "coding" | "meeting" | "research"
export type SessionStatus = "active" | "paused" | "ended"

export interface MeetingContext {
  title?: string
  participants?: string[]
  userRole?: string
  userCompany?: string
  goals?: string
  constraints?: string
  languageTone?: "professional" | "casual" | "technical" | "friendly"
  customContext?: string
}

export interface HaloSession {
  id: string
  name: string
  mode: SessionMode
  status: SessionStatus
  startedAt: number
  endedAt?: number
  pausedAt?: number
  contextItemIds: string[]
  transcriptSegmentIds: string[]
  messageIds: string[]
  meetingContext?: MeetingContext
  memorySummary?: string
  tags?: string[]
  metadata?: Record<string, any>
}

// ============================================================================
// CONTEXT ITEM TYPES
// ============================================================================

export type ContextItemType = "screenshot" | "transcript" | "note" | "clipboard" | "file"

export interface BaseContextItem {
  id: string
  sessionId: string
  type: ContextItemType
  createdAt: number
  updatedAt?: number
  title?: string
  sourceApp?: string
  sourceWindowTitle?: string
  pinned: boolean
  tags?: string[]
  metadata?: Record<string, any>
}

export interface ScreenshotContextItem extends BaseContextItem {
  type: "screenshot"
  thumbnailPath: string
  fullImagePath: string
  width: number
  height: number
  ocrText?: string
  ocrConfidence?: number
  captureType: "fullscreen" | "window" | "region"
  displayIndex?: number
}

export interface TranscriptContextItem extends BaseContextItem {
  type: "transcript"
  segmentIds: string[]
  startTime: number
  endTime: number
  speakerCount?: number
  language?: string
}

export interface NoteContextItem extends BaseContextItem {
  type: "note"
  text: string
  format: "plain" | "markdown"
}

export interface ClipboardContextItem extends BaseContextItem {
  type: "clipboard"
  text: string
  format: "text" | "html" | "image"
  imagePath?: string
}

export interface FileContextItem extends BaseContextItem {
  type: "file"
  filePath: string
  fileName: string
  fileType: string
  fileSize: number
  content?: string
}

export type ContextItem =
  | ScreenshotContextItem
  | TranscriptContextItem
  | NoteContextItem
  | ClipboardContextItem
  | FileContextItem

// ============================================================================
// TRANSCRIPT TYPES
// ============================================================================

export type SpeakerType = "user" | "other" | "unknown"
export type AudioSource = "mic" | "system" | "combined"

export interface TranscriptSegment {
  id: string
  sessionId: string
  text: string
  startTime: number
  endTime: number
  speaker?: SpeakerType
  speakerName?: string
  confidence?: number
  source: AudioSource
  language?: string
  isFinal: boolean
  words?: TranscriptWord[]
}

export interface TranscriptWord {
  text: string
  startTime: number
  endTime: number
  confidence?: number
}

// ============================================================================
// MESSAGE TYPES (Chat/Conversation)
// ============================================================================

export type MessageRole = "system" | "user" | "assistant"

export interface Message {
  id: string
  sessionId: string
  role: MessageRole
  content: string
  reasoningContent?: string  // For DeepSeek Reasoner, Claude extended thinking
  createdAt: number
  contextItemIds?: string[]
  modelId?: string
  providerId?: string
  tokenUsage?: TokenUsage
  metadata?: Record<string, any>
}

export interface TokenUsage {
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
  cachedTokens?: number
  reasoningTokens?: number
}

// ============================================================================
// LLM TYPES
// ============================================================================

export type LlmProviderId =
  | "deepseek"
  | "openai"
  | "anthropic"
  | "google"
  | "ollama"
  | "custom"

export type ModelCapability =
  | "text"
  | "vision"
  | "audio"
  | "reasoning"
  | "streaming"
  | "function-calling"

export type RecommendedUse =
  | "general"
  | "reasoning"
  | "coding"
  | "meeting"
  | "research"
  | "local"
  | "fast"

export type CostTier = "free" | "low" | "medium" | "high" | "premium"

export interface LlmModelConfig {
  id: string
  provider: LlmProviderId
  label: string
  description: string
  contextWindow: number
  maxOutputTokens: number
  defaultTemperature: number
  capabilities: ModelCapability[]
  supportsStreaming: boolean
  recommendedUse: RecommendedUse[]
  costTier: CostTier
  inputCostPer1M?: number   // USD per 1M tokens
  outputCostPer1M?: number  // USD per 1M tokens
  deprecated?: boolean
  betaFeatures?: string[]
}

export interface LlmRequestOptions {
  modelId: string
  messages: Message[]
  stream?: boolean
  mode?: SessionMode
  answerType?: AnswerType
  temperature?: number
  maxTokens?: number
  topP?: number
  frequencyPenalty?: number
  presencePenalty?: number
  stop?: string[]
  systemPromptOverride?: string
  metadata?: Record<string, any>
}

export interface LlmResponseChunk {
  type: "delta" | "final"
  content: string
  reasoningContent?: string
  usage?: TokenUsage
  finishReason?: "stop" | "length" | "tool_calls" | "content_filter" | "error"
  error?: string
  metadata?: Record<string, any>
}

// ============================================================================
// ANSWER TYPE SYSTEM
// ============================================================================

export type AnswerType =
  | "auto"
  | "short"
  | "detailed"
  | "step-by-step"
  | "checklist"
  | "code-only"
  | "explain-simple"
  | "bullet-points"
  | "pros-cons"

export interface AnswerTypeConfig {
  id: AnswerType
  label: string
  description: string
  icon: string
  systemPromptSuffix: string
  defaultMode?: SessionMode[]
}

// ============================================================================
// AI PROFILE SYSTEM
// ============================================================================

export type AiProfile = "speed" | "balanced" | "quality" | "local" | "custom"

export interface AiProfileConfig {
  id: AiProfile
  label: string
  description: string
  primaryModelId: string
  fallbackModelId?: string
  defaultTemperature: number
  defaultMaxTokens?: number
  enableStreaming: boolean
  enableCaching: boolean
  enableMultiModelVerification?: boolean
  costLimit?: number  // Max USD per request
}

// ============================================================================
// MEETING ACTION TYPES
// ============================================================================

export type MeetingActionType =
  | "say"              // "What should I say?"
  | "followups"        // "Follow-up questions"
  | "factcheck"        // "Fact check"
  | "recap"            // "Recap last X minutes"
  | "decisions"        // "Summarize decisions"
  | "email"            // "Draft follow-up email"
  | "action-items"     // "Extract action items"
  | "key-points"       // "Key points"
  | "clarify"          // "Ask clarifying question"

export interface MeetingAction {
  id: MeetingActionType
  label: string
  description: string
  icon: string
  hotkey?: string
  timeWindowMinutes?: number  // For recap actions
}

// ============================================================================
// SETTINGS TYPES
// ============================================================================

export interface HotkeyConfig {
  action: string
  key: string
  modifiers: ("ctrl" | "shift" | "alt" | "cmd" | "meta")[]
  enabled: boolean
}

export interface PrivacySettings {
  blacklistedApps: string[]
  blacklistedWindowTitles: string[]
  neverCaptureIncognito: boolean
  blurSensitiveFields: boolean
  panicModeHotkey?: HotkeyConfig
  autoDeleteAfterDays?: number
  encryptLocalStorage: boolean
}

export interface CaptureSettings {
  defaultCaptureType: "fullscreen" | "window" | "region"
  maxScreenshotsPerSession: number
  enableOcr: boolean
  ocrLanguages: string[]
  autoCapture: boolean
  autoCaptureIntervalSeconds?: number
}

export interface AudioSettings {
  enableMicCapture: boolean
  enableSystemAudioCapture: boolean
  sttProvider: "deepgram" | "assemblyai" | "local-whisper" | "disabled"
  sttApiKey?: string
  language: string
  enableDiarization: boolean  // Speaker detection
  realtimeTranscription: boolean
}

export interface UiSettings {
  theme: "dark" | "light" | "auto"
  compactMode: boolean
  showReasoningByDefault: boolean
  enableAnimations: boolean
  fontSize: "small" | "medium" | "large"
  overlayOpacity: number
  primaryColor: string
}

export interface AppSettings {
  // LLM Settings
  activeProfile: AiProfile
  customProfileConfig?: AiProfileConfig
  providerApiKeys: Partial<Record<LlmProviderId, string>>
  defaultMode: SessionMode
  defaultAnswerType: AnswerType

  // Audio/STT Settings
  audio: AudioSettings

  // Capture Settings
  capture: CaptureSettings

  // Privacy Settings
  privacy: PrivacySettings

  // UI Settings
  ui: UiSettings

  // Hotkeys
  hotkeys: HotkeyConfig[]

  // Advanced
  enableDebugMode: boolean
  enableTelemetry: boolean
  autoUpdate: boolean

  // Version
  version: string
  lastUpdated: number
}

// ============================================================================
// STT TYPES
// ============================================================================

export type SttProviderId =
  | "deepgram"
  | "assemblyai"
  | "openai-whisper"
  | "local-whisper"
  | "custom"

export interface SttProvider {
  id: SttProviderId
  label: string
  description: string
  supportsStreaming: boolean
  supportsDiarization: boolean
  supportsMultiLanguage: boolean
  languages: string[]
  costTier: CostTier
}

export interface SttSessionOptions {
  source: AudioSource
  language?: string
  enableDiarization?: boolean
  interim?: boolean  // Partial results
  punctuate?: boolean
  profanityFilter?: boolean
}

export interface SttChunk {
  type: "partial" | "final"
  text: string
  startTime?: number
  endTime?: number
  confidence?: number
  speaker?: SpeakerType
  words?: TranscriptWord[]
  isFinal: boolean
}

// ============================================================================
// CACHE TYPES
// ============================================================================

export interface CacheEntry<T> {
  key: string
  value: T
  createdAt: number
  expiresAt?: number
  hits: number
  size?: number
}

export interface CacheStats {
  totalEntries: number
  totalSize: number
  hitRate: number
  missRate: number
  evictions: number
}

// ============================================================================
// ERROR TYPES
// ============================================================================

export type ErrorSeverity = "info" | "warning" | "error" | "critical"
export type ErrorCategory =
  | "llm"
  | "stt"
  | "capture"
  | "network"
  | "storage"
  | "auth"
  | "unknown"

export interface HaloError {
  id: string
  category: ErrorCategory
  severity: ErrorSeverity
  message: string
  details?: string
  stack?: string
  timestamp: number
  context?: Record<string, any>
  userMessage?: string  // User-friendly message
  recoverable: boolean
  retryable: boolean
}

// ============================================================================
// ANALYTICS/TELEMETRY TYPES (Privacy-respecting)
// ============================================================================

export interface UsageStats {
  sessionCount: number
  totalMessages: number
  totalTokensUsed: number
  totalCostEstimate: number
  screenshotCount: number
  transcriptMinutes: number
  mostUsedMode: SessionMode
  mostUsedProvider: LlmProviderId
  averageSessionDuration: number
  period: "day" | "week" | "month" | "all-time"
}

// ============================================================================
// EXPORT TYPES
// ============================================================================

export interface SessionExport {
  session: HaloSession
  contextItems: ContextItem[]
  transcriptSegments: TranscriptSegment[]
  messages: Message[]
  exportedAt: number
  exportVersion: string
}

export type ExportFormat = "json" | "markdown" | "html" | "pdf"

// ============================================================================
// UTILITY TYPES
// ============================================================================

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

export type Nullable<T> = T | null
export type Optional<T> = T | undefined

// ============================================================================
// CONSTANTS
// ============================================================================

export const DEFAULT_SESSION_MODE: SessionMode = "auto"
export const DEFAULT_ANSWER_TYPE: AnswerType = "auto"
export const DEFAULT_AI_PROFILE: AiProfile = "balanced"
export const MAX_CONTEXT_ITEMS_PER_SESSION = 100
export const MAX_TRANSCRIPT_SEGMENTS_PER_SESSION = 1000
export const MAX_MESSAGES_PER_SESSION = 500
export const DEFAULT_CACHE_TTL_MS = 1000 * 60 * 60 // 1 hour
export const MAX_CACHE_SIZE_MB = 100
