export type AIProviderName = "groq" | "gemini" | "ollama"
export type AIResponseFormat = "text" | "json"

export interface AIInputAttachment {
  kind: "image" | "audio"
  data: string
  mimeType: string
}

export interface AIRequest {
  prompt: string
  systemPrompt?: string
  format?: AIResponseFormat
  attachments?: AIInputAttachment[]
  temperature?: number
  maxTokens?: number
}

export interface AIResult {
  text: string
  provider: AIProviderName
  model: string
  latencyMs: number
  inputTokens?: number
  outputTokens?: number
}

export interface AIStreamChunk {
  text: string
  done?: boolean
  provider?: AIProviderName
  model?: string
}

export interface AIHealthResult {
  ok: boolean
  provider: AIProviderName
  model?: string
  message?: string
}

export interface AIProvider {
  readonly providerName: AIProviderName
  health(): Promise<AIHealthResult>
  generate(request: AIRequest, options?: { timeoutMs?: number; signal?: AbortSignal }): Promise<AIResult>
  stream(request: AIRequest, options?: { timeoutMs?: number; signal?: AbortSignal }): AsyncGenerator<AIStreamChunk, AIResult, void>
}