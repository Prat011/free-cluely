import { contextBridge, ipcRenderer } from "electron"

// Types for the exposed Electron API
interface ElectronAPI {
  updateContentDimensions: (dimensions: {
    width: number
    height: number
  }) => Promise<void>
  getScreenshots: () => Promise<Array<{ path: string; preview: string }>>
  deleteScreenshot: (
    path: string
  ) => Promise<{ success: boolean; error?: string }>
  onScreenshotTaken: (
    callback: (data: { path: string; preview: string }) => void
  ) => () => void
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
  onSpeakerTranscriptionStatus: (callback: (data: { status: string }) => void) => () => void

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

export const PROCESSING_EVENTS = {
  UNAUTHORIZED: "procesing-unauthorized",
  NO_SCREENSHOTS: "processing-no-screenshots",
  INITIAL_START: "initial-start",
  PROBLEM_EXTRACTED: "problem-extracted",
  SOLUTION_SUCCESS: "solution-success",
  INITIAL_SOLUTION_ERROR: "solution-error",
  DEBUG_START: "debug-start",
  DEBUG_SUCCESS: "debug-success",
  DEBUG_ERROR: "debug-error"
} as const

/**
 * Creates a subscribable IPC event listener that returns an unsubscribe function.
 */
function onIpcEvent<T = void>(channel: string): (callback: (data: T) => void) => () => void {
  return (callback: (data: T) => void) => {
    const handler = (_: any, data: T) => callback(data)
    ipcRenderer.on(channel, handler)
    return () => ipcRenderer.removeListener(channel, handler)
  }
}

contextBridge.exposeInMainWorld("electronAPI", {
  updateContentDimensions: (dimensions: { width: number; height: number }) =>
    ipcRenderer.invoke("update-content-dimensions", dimensions),
  takeScreenshot: () => ipcRenderer.invoke("take-screenshot"),
  getScreenshots: () => ipcRenderer.invoke("get-screenshots"),
  deleteScreenshot: (path: string) =>
    ipcRenderer.invoke("delete-screenshot", path),

  // Event listeners
  onScreenshotTaken: onIpcEvent<{ path: string; preview: string }>("screenshot-taken"),
  onSolutionsReady: onIpcEvent<string>("solutions-ready"),
  onResetView: onIpcEvent("reset-view"),
  onSolutionStart: onIpcEvent(PROCESSING_EVENTS.INITIAL_START),
  onDebugStart: onIpcEvent(PROCESSING_EVENTS.DEBUG_START),
  onDebugSuccess: onIpcEvent<any>("debug-success"),
  onDebugError: onIpcEvent<string>(PROCESSING_EVENTS.DEBUG_ERROR),
  onSolutionError: onIpcEvent<string>(PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR),
  onProcessingNoScreenshots: onIpcEvent(PROCESSING_EVENTS.NO_SCREENSHOTS),
  onProblemExtracted: onIpcEvent<any>(PROCESSING_EVENTS.PROBLEM_EXTRACTED),
  onSolutionSuccess: onIpcEvent<any>(PROCESSING_EVENTS.SOLUTION_SUCCESS),
  onUnauthorized: onIpcEvent(PROCESSING_EVENTS.UNAUTHORIZED),

  moveWindowLeft: () => ipcRenderer.invoke("move-window-left"),
  moveWindowRight: () => ipcRenderer.invoke("move-window-right"),
  moveWindowUp: () => ipcRenderer.invoke("move-window-up"),
  moveWindowDown: () => ipcRenderer.invoke("move-window-down"),
  analyzeAudioFromBase64: (data: string, mimeType: string) => ipcRenderer.invoke("analyze-audio-base64", data, mimeType),
  analyzeAudioFile: (path: string) => ipcRenderer.invoke("analyze-audio-file", path),
  analyzeImageFile: (path: string) => ipcRenderer.invoke("analyze-image-file", path),
  quitApp: () => ipcRenderer.invoke("quit-app"),

  // LLM Model Management (legacy)
  getCurrentLlmConfig: () => ipcRenderer.invoke("get-current-llm-config"),
  getAvailableOllamaModels: () => ipcRenderer.invoke("get-available-ollama-models"),
  switchToOllama: (model?: string, url?: string) => ipcRenderer.invoke("switch-to-ollama", model, url),
  switchToGemini: (apiKey?: string) => ipcRenderer.invoke("switch-to-gemini", apiKey),
  testLlmConnection: () => ipcRenderer.invoke("test-llm-connection"),

  // Multi-Provider API (Phase 1.3)
  getSettings: () => ipcRenderer.invoke("get-settings"),
  updateSettings: (partial: Record<string, any>) => ipcRenderer.invoke("update-settings", partial),
  getAvailableProviders: () => ipcRenderer.invoke("get-available-providers"),
  setProviderApiKey: (providerId: string, apiKey: string) => ipcRenderer.invoke("set-provider-api-key", providerId, apiKey),
  setActiveProvider: (providerId: string, config?: { model?: string; apiKey?: string; url?: string }) => ipcRenderer.invoke("set-active-provider", providerId, config),
  testProviderConnection: (providerId?: string) => ipcRenderer.invoke("test-provider-connection", providerId),
  getProviderModels: (providerId: string) => ipcRenderer.invoke("get-provider-models", providerId),

  // Speaker transcription (Gemini Live API)
  startSpeakerTranscription: (language: string) => ipcRenderer.invoke("start-speaker-transcription", language),
  stopSpeakerTranscription: () => ipcRenderer.invoke("stop-speaker-transcription"),
  sendSpeakerAudioChunk: (base64Pcm: string) => ipcRenderer.send("speaker-audio-chunk", base64Pcm),
  onSpeakerTranscription: onIpcEvent<{ text: string; isFinal: boolean; timestamp: number }>("speaker-transcription"),
  onSpeakerTranscriptionStatus: onIpcEvent<{ status: string }>("speaker-transcription-status"),

  // Meeting Management (Phase 2)
  startMeeting: (title?: string) => ipcRenderer.invoke("start-meeting", title),
  endMeeting: () => ipcRenderer.invoke("end-meeting"),
  getCurrentMeeting: () => ipcRenderer.invoke("get-current-meeting"),
  getMeeting: (id: string) => ipcRenderer.invoke("get-meeting", id),
  getMeetingHistory: () => ipcRenderer.invoke("get-meeting-history"),
  deleteMeeting: (id: string) => ipcRenderer.invoke("delete-meeting", id),
  searchMeetings: (query: string) => ipcRenderer.invoke("search-meetings", query),
  generateMeetingSummary: (meetingId: string) => ipcRenderer.invoke("generate-meeting-summary", meetingId),
  extractActionItems: (meetingId: string) => ipcRenderer.invoke("extract-action-items", meetingId),
  addTranscriptionEntry: (meetingId: string, entry: any) => ipcRenderer.invoke("add-transcription-entry", meetingId, entry),
  onMeetingContextUpdate: onIpcEvent<any>("meeting-context-update"),
  onMeetingError: onIpcEvent<string>("meeting-error"),

  // Playbook Management (Phase 3)
  listPlaybooks: () => ipcRenderer.invoke("list-playbooks"),
  getPlaybook: (id: string) => ipcRenderer.invoke("get-playbook", id),
  createPlaybook: (input: any) => ipcRenderer.invoke("create-playbook", input),
  updatePlaybook: (id: string, partial: any) => ipcRenderer.invoke("update-playbook", id, partial),
  deletePlaybook: (id: string) => ipcRenderer.invoke("delete-playbook", id),

  // Coaching API (Phase 3)
  evaluateCoaching: (statement: string, playbookId: string) => ipcRenderer.invoke("evaluate-coaching", statement, playbookId),
  generateQuickResponses: (question: string, context: string) => ipcRenderer.invoke("generate-quick-responses", question, context),

  // Conversation History (Phase 4.3)
  getConversationHistory: (limit?: number) => ipcRenderer.invoke("get-conversation-history", limit),
  addConversationMessage: (role: "user" | "assistant", content: string) => ipcRenderer.invoke("add-conversation-message", role, content),
  getConversationContext: (limit?: number) => ipcRenderer.invoke("get-conversation-context", limit),
  clearConversationHistory: () => ipcRenderer.invoke("clear-conversation-history"),

  // Window Management (Phase 4.2 / 4.4)
  toggleClickThrough: () => ipcRenderer.invoke("toggle-click-through"),
  getAvailableDisplays: () => ipcRenderer.invoke("get-available-displays"),
  moveToDisplay: (displayId: number) => ipcRenderer.invoke("move-to-display", displayId),
  snapWindow: (position: string) => ipcRenderer.invoke("snap-window", position),
  onClickThroughChanged: onIpcEvent<boolean>("click-through-changed"),

  // Export API (Phase 5.2)
  exportMeetingMarkdown: (meetingId: string) => ipcRenderer.invoke("export-meeting-markdown", meetingId),
  exportMeetingClipboard: (meetingId: string) => ipcRenderer.invoke("export-meeting-clipboard", meetingId),
  exportMeetingJSON: (meetingId: string) => ipcRenderer.invoke("export-meeting-json", meetingId),

  // Webhook API (Phase 5.3)
  setWebhookUrl: (url: string | null) => ipcRenderer.invoke("set-webhook-url", url),
  getWebhookUrl: () => ipcRenderer.invoke("get-webhook-url"),
  testWebhook: () => ipcRenderer.invoke("test-webhook"),

  // Whisper Transcription API (Phase 4.5)
  whisperTranscribe: (filePath: string, options?: { language?: string; prompt?: string }) => ipcRenderer.invoke("whisper-transcribe", filePath, options),
  whisperTranscribeVerbose: (filePath: string, options?: { language?: string; prompt?: string }) => ipcRenderer.invoke("whisper-transcribe-verbose", filePath, options),
  getWhisperLanguages: () => ipcRenderer.invoke("get-whisper-languages"),

  // Calendar API (Phase 5.1)
  getUpcomingEvents: () => ipcRenderer.invoke("get-upcoming-events"),
  getNextEvent: () => ipcRenderer.invoke("get-next-event"),
  getImminentEvents: (minutes?: number) => ipcRenderer.invoke("get-imminent-events", minutes),
  addCalendarEvent: (event: any) => ipcRenderer.invoke("add-calendar-event", event),
  importICS: (icsText: string) => ipcRenderer.invoke("import-ics", icsText),
  suggestPlaybookForEvent: (eventTitle: string) => ipcRenderer.invoke("suggest-playbook-for-event", eventTitle),

  // Region Capture API (Phase 4.1)
  startRegionCapture: () => ipcRenderer.invoke("start-region-capture"),

  invoke: (channel: string, ...args: any[]) => ipcRenderer.invoke(channel, ...args)
} as ElectronAPI)
