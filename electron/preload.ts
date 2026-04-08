import { contextBridge, ipcRenderer } from "electron"

// Types for the exposed Electron API
interface ElectronAPI {
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
  
  // LLM Model Management
  getCurrentLlmConfig: () => Promise<{ provider: "ollama" | "gemini" | "nvidia"; model: string; isOllama: boolean; isNvidia: boolean }>
  getAvailableOllamaModels: () => Promise<string[]>
  getOllamaModelCapabilities: () => Promise<Array<{ name: string; supportsVision: boolean; supportsAudio: boolean }>>
  switchToOllama: (model?: string, url?: string) => Promise<{ success: boolean; error?: string }>
  switchToGemini: (apiKey?: string) => Promise<{ success: boolean; error?: string }>
  switchToNvidia: (apiKey?: string, model?: string, url?: string) => Promise<{ success: boolean; error?: string }>
  testLlmConnection: () => Promise<{ success: boolean; error?: string }>
  getScreenshotUnderstandingMode: () => Promise<{ mode: "ocr" | "ocr-llm-filter" | "multimodal"; error?: string }>
  setScreenshotUnderstandingMode: (mode: "ocr" | "ocr-llm-filter" | "multimodal") => Promise<{ success: boolean; mode?: "ocr" | "ocr-llm-filter" | "multimodal"; error?: string }>
  
  invoke: (channel: string, ...args: any[]) => Promise<any>
}

export const PROCESSING_EVENTS = {
  //global states
  UNAUTHORIZED: "procesing-unauthorized",
  NO_SCREENSHOTS: "processing-no-screenshots",

  //states for generating the initial solution
  INITIAL_START: "initial-start",
  PROBLEM_EXTRACTED: "problem-extracted",
  SOLUTION_SUCCESS: "solution-success",
  INITIAL_SOLUTION_ERROR: "solution-error",

  //states for processing the debugging
  DEBUG_START: "debug-start",
  DEBUG_SUCCESS: "debug-success",
  DEBUG_ERROR: "debug-error"
} as const

// Expose the Electron API to the renderer process
contextBridge.exposeInMainWorld("electronAPI", {
  getHotkeys: () => ipcRenderer.invoke("get-hotkeys"),
  getSessionEntries: () => ipcRenderer.invoke("get-session-entries"),
  submitTaggedInput: (
    source: "chat" | "audio" | "image",
    text: string,
    metadata?: Record<string, any>
  ) => ipcRenderer.invoke("submit-tagged-input", source, text, metadata),
  onSessionEntryAdded: (
    callback: (entry: {
      id: string
      source: "chat" | "audio" | "image" | "assistant" | "system"
      text: string
      timestamp: number
      metadata?: Record<string, any>
    }) => void
  ) => {
    const subscription = (_: any, entry: any) => callback(entry)
    ipcRenderer.on("session-entry-added", subscription)
    return () => {
      ipcRenderer.removeListener("session-entry-added", subscription)
    }
  },
  toggleRealtimeAudioTranscription: () => ipcRenderer.invoke("toggle-realtime-audio-transcription"),
  getRealtimeAudioTranscriptionState: () => ipcRenderer.invoke("get-realtime-audio-transcription-state"),
  onAudioTranscriptStream: (
    callback: (event: {
      type: "partial" | "final" | "status" | "error" | "warn"
      text: string
      active: boolean
      source?: "mic" | "system"
    }) => void
  ) => {
    const subscription = (_: any, payload: any) => callback(payload)
    ipcRenderer.on("audio-transcript-stream", subscription)
    return () => {
      ipcRenderer.removeListener("audio-transcript-stream", subscription)
    }
  },
  onAudioTranscriptionState: (callback: (state: { active: boolean }) => void) => {
    const subscription = (_: any, state: { active: boolean }) => callback(state)
    ipcRenderer.on("audio-transcription-state", subscription)
    return () => {
      ipcRenderer.removeListener("audio-transcription-state", subscription)
    }
  },
  onOpenChat: (callback: () => void) => {
    const subscription = () => callback()
    ipcRenderer.on("open-chat", subscription)
    return () => {
      ipcRenderer.removeListener("open-chat", subscription)
    }
  },
  updateContentDimensions: (dimensions: { width: number; height: number }) =>
    ipcRenderer.invoke("update-content-dimensions", dimensions),
  takeScreenshot: () => ipcRenderer.invoke("take-screenshot"),
  getScreenshots: () => ipcRenderer.invoke("get-screenshots"),
  deleteScreenshot: (path: string) =>
    ipcRenderer.invoke("delete-screenshot", path),

  // Event listeners
  onScreenshotTaken: (
    callback: (data: { path: string; preview: string }) => void
  ) => {
    const subscription = (_: any, data: { path: string; preview: string }) =>
      callback(data)
    ipcRenderer.on("screenshot-taken", subscription)
    return () => {
      ipcRenderer.removeListener("screenshot-taken", subscription)
    }
  },
  onSolutionsReady: (callback: (solutions: string) => void) => {
    const subscription = (_: any, solutions: string) => callback(solutions)
    ipcRenderer.on("solutions-ready", subscription)
    return () => {
      ipcRenderer.removeListener("solutions-ready", subscription)
    }
  },
  onResetView: (callback: () => void) => {
    const subscription = () => callback()
    ipcRenderer.on("reset-view", subscription)
    return () => {
      ipcRenderer.removeListener("reset-view", subscription)
    }
  },
  onSolutionStart: (callback: () => void) => {
    const subscription = () => callback()
    ipcRenderer.on(PROCESSING_EVENTS.INITIAL_START, subscription)
    return () => {
      ipcRenderer.removeListener(PROCESSING_EVENTS.INITIAL_START, subscription)
    }
  },
  onDebugStart: (callback: () => void) => {
    const subscription = () => callback()
    ipcRenderer.on(PROCESSING_EVENTS.DEBUG_START, subscription)
    return () => {
      ipcRenderer.removeListener(PROCESSING_EVENTS.DEBUG_START, subscription)
    }
  },

  onDebugSuccess: (callback: (data: any) => void) => {
    ipcRenderer.on("debug-success", (_event, data) => callback(data))
    return () => {
      ipcRenderer.removeListener("debug-success", (_event, data) =>
        callback(data)
      )
    }
  },
  onDebugError: (callback: (error: string) => void) => {
    const subscription = (_: any, error: string) => callback(error)
    ipcRenderer.on(PROCESSING_EVENTS.DEBUG_ERROR, subscription)
    return () => {
      ipcRenderer.removeListener(PROCESSING_EVENTS.DEBUG_ERROR, subscription)
    }
  },
  onSolutionError: (callback: (error: string) => void) => {
    const subscription = (_: any, error: string) => callback(error)
    ipcRenderer.on(PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR, subscription)
    return () => {
      ipcRenderer.removeListener(
        PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR,
        subscription
      )
    }
  },
  onProcessingNoScreenshots: (callback: () => void) => {
    const subscription = () => callback()
    ipcRenderer.on(PROCESSING_EVENTS.NO_SCREENSHOTS, subscription)
    return () => {
      ipcRenderer.removeListener(PROCESSING_EVENTS.NO_SCREENSHOTS, subscription)
    }
  },

  onProblemExtracted: (callback: (data: any) => void) => {
    const subscription = (_: any, data: any) => callback(data)
    ipcRenderer.on(PROCESSING_EVENTS.PROBLEM_EXTRACTED, subscription)
    return () => {
      ipcRenderer.removeListener(
        PROCESSING_EVENTS.PROBLEM_EXTRACTED,
        subscription
      )
    }
  },
  onSolutionSuccess: (callback: (data: any) => void) => {
    const subscription = (_: any, data: any) => callback(data)
    ipcRenderer.on(PROCESSING_EVENTS.SOLUTION_SUCCESS, subscription)
    return () => {
      ipcRenderer.removeListener(
        PROCESSING_EVENTS.SOLUTION_SUCCESS,
        subscription
      )
    }
  },
  onUnauthorized: (callback: () => void) => {
    const subscription = () => callback()
    ipcRenderer.on(PROCESSING_EVENTS.UNAUTHORIZED, subscription)
    return () => {
      ipcRenderer.removeListener(PROCESSING_EVENTS.UNAUTHORIZED, subscription)
    }
  },
  moveWindowLeft: () => ipcRenderer.invoke("move-window-left"),
  moveWindowRight: () => ipcRenderer.invoke("move-window-right"),
  moveWindowUp: () => ipcRenderer.invoke("move-window-up"),
  moveWindowDown: () => ipcRenderer.invoke("move-window-down"),
  analyzeAudioFromBase64: (data: string, mimeType: string) => ipcRenderer.invoke("analyze-audio-base64", data, mimeType),
  analyzeAudioFile: (path: string) => ipcRenderer.invoke("analyze-audio-file", path),
  analyzeImageFile: (path: string) => ipcRenderer.invoke("analyze-image-file", path),
  quitApp: () => ipcRenderer.invoke("quit-app"),
  
  // LLM Model Management
  getCurrentLlmConfig: () => ipcRenderer.invoke("get-current-llm-config"),
  getAvailableOllamaModels: () => ipcRenderer.invoke("get-available-ollama-models"),
  getOllamaModelCapabilities: () => ipcRenderer.invoke("get-ollama-model-capabilities"),
  switchToOllama: (model?: string, url?: string) => ipcRenderer.invoke("switch-to-ollama", model, url),
  switchToGemini: (apiKey?: string) => ipcRenderer.invoke("switch-to-gemini", apiKey),
  switchToNvidia: (apiKey?: string, model?: string, url?: string) => ipcRenderer.invoke("switch-to-nvidia", apiKey, model, url),
  testLlmConnection: () => ipcRenderer.invoke("test-llm-connection"),
  getScreenshotUnderstandingMode: () => ipcRenderer.invoke("get-screenshot-understanding-mode"),
  setScreenshotUnderstandingMode: (mode: "ocr" | "ocr-llm-filter" | "multimodal") => ipcRenderer.invoke("set-screenshot-understanding-mode", mode),
  
  invoke: (channel: string, ...args: any[]) => ipcRenderer.invoke(channel, ...args)
} as ElectronAPI)
