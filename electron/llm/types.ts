export interface ChatOptions {
  systemPrompt?: string
  temperature?: number
  maxTokens?: number
}

export interface ModelInfo {
  id: string
  name: string
  supportsVision: boolean
  supportsAudio: boolean
}

export interface LLMProviderConfig {
  id: string
  name: string
  model: string
  supportsChat: boolean
  supportsVision: boolean
  supportsAudio: boolean
  supportsStreaming: boolean
}

export interface LLMProvider {
  readonly config: LLMProviderConfig

  chat(message: string, options?: ChatOptions): Promise<string>
  analyzeImage?(imageData: Buffer, mimeType: string, prompt: string): Promise<string>
  analyzeAudio?(audioData: Buffer, mimeType: string, prompt: string): Promise<string>

  testConnection(): Promise<{ success: boolean; error?: string }>
  getAvailableModels(): Promise<ModelInfo[]>
}
