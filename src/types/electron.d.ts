export interface ElectronAPI {
  getHotkeys: () => Promise<{
    toggleWindow: string
    screenshot: string
    solve: string
    openChat: string
    sttToggle: string
  }>
  getSessionEntries: () => Promise<Array<{ id: string; source: "chat" | "audio" | "image" | "assistant" | "system"; text: string; timestamp: number; metadata?: Record<string, any> }>>
  submitTaggedInput: (
    source: "chat" | "audio" | "image",
    text: string,
    metadata?: Record<string, any>
  ) => Promise<{
    reply: string
    userEntry: { id: string; source: string; text: string; timestamp: number; metadata?: Record<string, any> }
    assistantEntry: { id: string; source: string; text: string; timestamp: number; metadata?: Record<string, any> }
  }>
  onSessionEntryAdded: (
    callback: (entry: {
      id: string
      source: "chat" | "audio" | "image" | "assistant" | "system"
      text: string
      timestamp: number
      metadata?: Record<string, any>
    }) => void
  ) => () => void
  toggleRealtimeAudioTranscription: () => Promise<{ active: boolean; transcript?: string; llmReply?: string; error?: string }>
  getRealtimeAudioTranscriptionState: () => Promise<{
    active: boolean
    partial: string
    partialBySource: { mic: string; system: string }
    sourceMode: "mic" | "system" | "both"
    finalTranscript: string
  }>
  onAudioTranscriptStream: (
    callback: (event: {
      type: "partial" | "final" | "status" | "error" | "warn"
      text: string
      active: boolean
      source?: "mic" | "system"
    }) => void
  ) => () => void
  onAudioTranscriptionState: (callback: (state: { active: boolean }) => void) => () => void
  onOpenChat: (callback: () => void) => () => void
  updateContentDimensions: (dimensions: {
    width: number
    height: number
  }) => Promise<void>
  getScreenshots: () => Promise<Array<{ path: string; preview: string }>>
  deleteScreenshot: (path: string) => Promise<{ success: boolean; error?: string }>
  onScreenshotTaken: (callback: (data: { path: string; preview: string }) => void) => () => void
  onSolutionsReady: (callback: (solutions: string) => void) => () => void
  onResetView: (callback: () => void) => () => void
  onSolutionStart: (callback: () => void) => () => void
  onDebugStart: (callback: () => void) => () => void
  onDebugSuccess: (callback: (data: any) => void) => () => void
  onSolutionError: (callback: (error: string) => void) => () => void
  onProcessingNoScreenshots: (callback: () => void) => () => void
  onProblemExtracted: (callback: (data: any) => void) => () => void
  onSolutionSuccess: (callback: (data: any) => void) => () => void
  onUnauthorized: (callback: () => void) => () => void
  onDebugError: (callback: (error: string) => void) => () => void
  takeScreenshot: () => Promise<void>
  moveWindowLeft: () => Promise<void>
  moveWindowRight: () => Promise<void>
  moveWindowUp: () => Promise<void>
  moveWindowDown: () => Promise<void>
  analyzeAudioFromBase64: (data: string, mimeType: string) => Promise<{ text: string; timestamp: number }>
  analyzeAudioFile: (path: string) => Promise<{ text: string; timestamp: number }>
  getCurrentLlmConfig: () => Promise<{ provider: "ollama" | "gemini" | "nvidia"; model: string; isOllama: boolean; isNvidia: boolean }>
  getAvailableOllamaModels: () => Promise<string[]>
  getOllamaModelCapabilities: () => Promise<Array<{ name: string; supportsVision: boolean; supportsAudio: boolean }>>
  switchToOllama: (model?: string, url?: string) => Promise<{ success: boolean; error?: string }>
  switchToGemini: (apiKey?: string) => Promise<{ success: boolean; error?: string }>
  switchToNvidia: (apiKey?: string, model?: string, url?: string) => Promise<{ success: boolean; error?: string }>
  testLlmConnection: () => Promise<{ success: boolean; error?: string }>
  getScreenshotUnderstandingMode: () => Promise<{ mode: "ocr" | "ocr-llm-filter" | "multimodal"; error?: string }>
  setScreenshotUnderstandingMode: (mode: "ocr" | "ocr-llm-filter" | "multimodal") => Promise<{ success: boolean; mode?: "ocr" | "ocr-llm-filter" | "multimodal"; error?: string }>
  quitApp: () => Promise<void>
  invoke: (channel: string, ...args: any[]) => Promise<any>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
} 