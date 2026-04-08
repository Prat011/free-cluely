interface ElectronAPI {
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
  analyzeImageFile: (path: string) => Promise<void>
  quitApp: () => Promise<void>

  // LLM Model Management (legacy)
  getCurrentLlmConfig: () => Promise<{ provider: "ollama" | "gemini"; model: string; isOllama: boolean }>
  getAvailableOllamaModels: () => Promise<string[]>
  switchToOllama: (model?: string, url?: string) => Promise<{ success: boolean; error?: string }>
  switchToGemini: (apiKey?: string) => Promise<{ success: boolean; error?: string }>
  testLlmConnection: () => Promise<{ success: boolean; error?: string }>

  // Multi-Provider API
  getSettings: () => Promise<any>
  updateSettings: (partial: Record<string, any>) => Promise<{ success: boolean; error?: string }>
  getAvailableProviders: () => Promise<Array<{ id: string; name: string; supportsVision: boolean; supportsAudio: boolean }>>
  setProviderApiKey: (providerId: string, apiKey: string) => Promise<{ success: boolean; error?: string }>
  setActiveProvider: (providerId: string, config?: { model?: string; apiKey?: string; url?: string }) => Promise<{ success: boolean; error?: string }>
  testProviderConnection: (providerId?: string) => Promise<{ success: boolean; error?: string }>
  getProviderModels: (providerId: string) => Promise<Array<{ id: string; name: string; supportsVision: boolean; supportsAudio: boolean }>>

  // Speaker transcription (Gemini Live API)
  startSpeakerTranscription: (language: string) => Promise<{ success: boolean; error?: string }>
  stopSpeakerTranscription: () => Promise<{ success: boolean }>
  sendSpeakerAudioChunk: (base64Pcm: string) => void
  onSpeakerTranscription: (callback: (data: { text: string; isFinal: boolean; timestamp: number }) => void) => () => void
  onSpeakerTranscriptionStatus: (callback: (data: { status: "connected" | "disconnected" }) => void) => () => void

  // Meeting Management (Phase 2)
  startMeeting: (title?: string) => Promise<{ success: boolean; meeting?: any; error?: string }>
  endMeeting: () => Promise<{ success: boolean; meeting?: any; error?: string }>
  getCurrentMeeting: () => Promise<any>
  getMeeting: (id: string) => Promise<any>
  getMeetingHistory: () => Promise<any[]>
  deleteMeeting: (id: string) => Promise<{ success: boolean }>
  searchMeetings: (query: string) => Promise<any[]>
  generateMeetingSummary: (meetingId: string) => Promise<{ success: boolean; summary?: string; error?: string }>
  extractActionItems: (meetingId: string) => Promise<{ success: boolean; items?: any[]; error?: string }>
  addTranscriptionEntry: (meetingId: string, entry: any) => Promise<{ success: boolean; error?: string }>
  onMeetingContextUpdate: (callback: (data: any) => void) => () => void
  onMeetingError: (callback: (error: string) => void) => () => void

  // Playbook Management (Phase 3)
  listPlaybooks: () => Promise<any[]>
  getPlaybook: (id: string) => Promise<any>
  createPlaybook: (input: any) => Promise<{ success: boolean; playbook?: any; error?: string }>
  updatePlaybook: (id: string, partial: any) => Promise<{ success: boolean; playbook?: any; error?: string }>
  deletePlaybook: (id: string) => Promise<{ success: boolean }>

  // Coaching API (Phase 3)
  evaluateCoaching: (statement: string, playbookId: string) => Promise<{ advice: string | null; error?: string }>
  generateQuickResponses: (question: string, context: string) => Promise<{ responses: string[]; error?: string }>

  // Conversation History (Phase 4.3)
  getConversationHistory: (limit?: number) => Promise<any[]>
  addConversationMessage: (role: "user" | "assistant", content: string) => Promise<{ success: boolean }>
  getConversationContext: (limit?: number) => Promise<string>
  clearConversationHistory: () => Promise<{ success: boolean }>

  // Window Management (Phase 4.2 / 4.4)
  toggleClickThrough: () => Promise<{ isClickThrough: boolean }>
  getAvailableDisplays: () => Promise<Array<{ id: number; label: string; width: number; height: number }>>
  moveToDisplay: (displayId: number) => Promise<{ success: boolean }>
  snapWindow: (position: string) => Promise<{ success: boolean }>
  onClickThroughChanged: (callback: (isClickThrough: boolean) => void) => () => void

  // Export API (Phase 5.2)
  exportMeetingMarkdown: (meetingId: string) => Promise<{ success: boolean; markdown?: string; error?: string }>
  exportMeetingClipboard: (meetingId: string) => Promise<{ success: boolean }>
  exportMeetingJSON: (meetingId: string) => Promise<{ success: boolean; json?: string; error?: string }>

  // Webhook API (Phase 5.3)
  setWebhookUrl: (url: string | null) => Promise<{ success: boolean }>
  getWebhookUrl: () => Promise<{ url: string | null }>
  testWebhook: () => Promise<{ success: boolean; error?: string }>

  // Whisper Transcription API (Phase 4.5)
  whisperTranscribe: (filePath: string, options?: { language?: string; prompt?: string }) => Promise<{ success: boolean; text?: string; timestamp?: number; error?: string }>
  whisperTranscribeVerbose: (filePath: string, options?: { language?: string; prompt?: string }) => Promise<{ success: boolean; text?: string; detectedLanguage?: string; duration?: number; timestamp?: number; error?: string }>
  getWhisperLanguages: () => Promise<string[]>

  // Calendar API (Phase 5.1)
  getUpcomingEvents: () => Promise<any[]>
  getNextEvent: () => Promise<any | null>
  getImminentEvents: (minutes?: number) => Promise<any[]>
  addCalendarEvent: (event: any) => Promise<{ success: boolean; error?: string }>
  importICS: (icsText: string) => Promise<{ success: boolean; count?: number; error?: string }>
  suggestPlaybookForEvent: (eventTitle: string) => Promise<{ playbookId: string | null }>

  // Region Capture API (Phase 4.1)
  startRegionCapture: () => Promise<{ success: boolean; path?: string; preview?: string; error?: string }>

  invoke: (channel: string, ...args: any[]) => Promise<any>
}

interface Window {
  electronAPI: ElectronAPI
}
