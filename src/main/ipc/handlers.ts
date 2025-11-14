/**
 * Horalix Halo - IPC Handlers
 *
 * Electron IPC handlers for main process communication.
 * Handles LLM requests, session management, screenshots, etc.
 */

import { ipcMain, BrowserWindow, desktopCapturer } from "electron"
import { LlmEngine } from "../engines/llm/LlmEngine"
import { SessionEngine } from "../engines/session/SessionEngine"
import type { LlmRequestOptions, LlmResponseChunk, LlmProviderId } from "../engines/llm/types"
import type {
  HaloSession,
  Message,
  ContextItem,
  TranscriptSegment,
} from "../state/StateTypes"

let llmEngine: LlmEngine
let sessionEngine: SessionEngine

/**
 * Initialize IPC handlers
 */
export function initializeIpcHandlers(
  llmEngineInstance: LlmEngine,
  sessionEngineInstance: SessionEngine
): void {
  llmEngine = llmEngineInstance
  sessionEngine = sessionEngineInstance

  console.log("[IPC] Initializing IPC handlers...")

  // LLM Handlers
  setupLlmHandlers()

  // Session Handlers
  setupSessionHandlers()

  // Screenshot Handlers
  setupScreenshotHandlers()

  // System Handlers
  setupSystemHandlers()

  console.log("[IPC] IPC handlers initialized successfully")
}

// ============================================================================
// LLM HANDLERS
// ============================================================================

function setupLlmHandlers(): void {
  /**
   * Stream LLM response
   */
  ipcMain.on("llm:stream", async (event, options: LlmRequestOptions) => {
    try {
      // Validate input parameters
      if (!options || !options.modelId || !options.messages) {
        throw new Error("Invalid request: modelId and messages are required")
      }

      console.log("[IPC] Starting LLM stream for model:", options.modelId)

      const stream = llmEngine.stream(options)

      for await (const chunk of stream) {
        // Send chunk to renderer
        event.sender.send("llm:stream:chunk", chunk)
      }

      // Send completion signal
      event.sender.send("llm:stream:complete")
    } catch (error: any) {
      console.error("[IPC] LLM stream error:", error)
      event.sender.send("llm:stream:error", {
        message: error.message || "Unknown error",
        code: error.code,
      })
    }
  })

  /**
   * Cancel ongoing LLM request
   */
  ipcMain.on("llm:cancel", (_event, requestId?: string) => {
    try {
      if (requestId) {
        llmEngine.cancelRequest(requestId)
        console.log("[IPC] LLM request cancelled:", requestId)
      } else {
        llmEngine.cancelAllRequests()
        console.log("[IPC] All LLM requests cancelled")
      }
    } catch (error: any) {
      console.error("[IPC] Error cancelling request:", error)
    }
  })

  /**
   * Get LLM metrics
   */
  ipcMain.handle("llm:getMetrics", async () => {
    try {
      return { success: true, metrics: llmEngine.getMetrics() }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  /**
   * Get LLM cost by provider
   */
  ipcMain.handle("llm:getCostByProvider", async () => {
    try {
      return { success: true, costs: llmEngine.getCostByProvider() }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  /**
   * Clear LLM cache
   */
  ipcMain.handle("llm:clearCache", async () => {
    try {
      llmEngine.clearCache()
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  /**
   * Test provider connection
   */
  ipcMain.handle(
    "llm:testProvider",
    async (_event, providerId: string, _config: any) => {
      try {
        const provider = llmEngine.getProvider(providerId as LlmProviderId)
        if (!provider) {
          throw new Error(`Provider ${providerId} not found`)
        }
        const result = await provider.testConnection()
        return result
      } catch (error: any) {
        return { success: false, error: error.message }
      }
    }
  )
}

// ============================================================================
// SESSION HANDLERS
// ============================================================================

function setupSessionHandlers(): void {
  /**
   * Create session
   */
  ipcMain.handle("session:create", async (_event, session: HaloSession) => {
    try {
      sessionEngine.createSession(session)
      return { success: true, session }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  /**
   * Get session
   */
  ipcMain.handle("session:get", async (_event, sessionId: string) => {
    try {
      const session = sessionEngine.getSession(sessionId)
      return { success: true, session }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  /**
   * Update session
   */
  ipcMain.handle(
    "session:update",
    async (_event, sessionId: string, updates: Partial<HaloSession>) => {
      try {
        sessionEngine.updateSession(sessionId, updates)
        return { success: true }
      } catch (error: any) {
        return { success: false, error: error.message }
      }
    }
  )

  /**
   * Delete session
   */
  ipcMain.handle("session:delete", async (_event, sessionId: string) => {
    try {
      sessionEngine.deleteSession(sessionId)
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  /**
   * Query sessions
   */
  ipcMain.handle("session:query", async (_event, query: any) => {
    try {
      const sessions = sessionEngine.querySessions(query)
      return { success: true, sessions }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  /**
   * Get recent sessions
   */
  ipcMain.handle("session:getRecent", async (_event, limit: number = 10) => {
    try {
      const sessions = sessionEngine.getRecentSessions(limit)
      return { success: true, sessions }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  /**
   * Add message
   */
  ipcMain.handle("session:addMessage", async (_event, message: Message) => {
    try {
      sessionEngine.addMessage(message)
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  /**
   * Get messages
   */
  ipcMain.handle(
    "session:getMessages",
    async (_event, sessionId: string, limit?: number) => {
      try {
        const messages = sessionEngine.getMessages(sessionId, limit)
        return { success: true, messages }
      } catch (error: any) {
        return { success: false, error: error.message }
      }
    }
  )

  /**
   * Search messages
   */
  ipcMain.handle(
    "session:searchMessages",
    async (_event, searchText: string, limit: number = 50) => {
      try {
        const messages = sessionEngine.searchMessages(searchText, limit)
        return { success: true, messages }
      } catch (error: any) {
        return { success: false, error: error.message }
      }
    }
  )

  /**
   * Add context item
   */
  ipcMain.handle("session:addContext", async (_event, item: ContextItem) => {
    try {
      sessionEngine.addContextItem(item)
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  /**
   * Get context items
   */
  ipcMain.handle("session:getContext", async (_event, sessionId: string) => {
    try {
      const items = sessionEngine.getContextItems(sessionId)
      return { success: true, items }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  /**
   * Update context item
   */
  ipcMain.handle(
    "session:updateContext",
    async (_event, itemId: string, updates: Partial<ContextItem>) => {
      try {
        sessionEngine.updateContextItem(itemId, updates)
        return { success: true }
      } catch (error: any) {
        return { success: false, error: error.message }
      }
    }
  )

  /**
   * Delete context item
   */
  ipcMain.handle("session:deleteContext", async (_event, itemId: string) => {
    try {
      sessionEngine.deleteContextItem(itemId)
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  /**
   * Add transcript segment
   */
  ipcMain.handle(
    "session:addTranscript",
    async (_event, segment: TranscriptSegment) => {
      try {
        sessionEngine.addTranscriptSegment(segment)
        return { success: true }
      } catch (error: any) {
        return { success: false, error: error.message }
      }
    }
  )

  /**
   * Get transcript segments
   */
  ipcMain.handle("session:getTranscripts", async (_event, sessionId: string) => {
    try {
      const segments = sessionEngine.getTranscriptSegments(sessionId)
      return { success: true, segments }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  /**
   * Get session stats
   */
  ipcMain.handle("session:getStats", async (_event) => {
    try {
      const stats = sessionEngine.getStats()
      return { success: true, stats }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })
}

// ============================================================================
// SCREENSHOT HANDLERS
// ============================================================================

function setupScreenshotHandlers(): void {
  /**
   * Capture screenshot
   */
  ipcMain.handle("screenshot:capture", async (_event, _source?: string) => {
    try {
      const sources = await desktopCapturer.getSources({
        types: ["screen"],
        thumbnailSize: { width: 1920, height: 1080 },
      })

      if (sources.length === 0) {
        throw new Error("No screen sources available")
      }

      // Use first source by default
      const screenshot = sources[0]

      return {
        success: true,
        data: screenshot.thumbnail.toDataURL(),
        name: screenshot.name,
      }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  /**
   * Get available sources
   */
  ipcMain.handle("screenshot:getSources", async () => {
    try {
      const sources = await desktopCapturer.getSources({
        types: ["screen", "window"],
        thumbnailSize: { width: 150, height: 150 },
      })

      return {
        success: true,
        sources: sources.map((s) => ({
          id: s.id,
          name: s.name,
          thumbnail: s.thumbnail.toDataURL(),
        })),
      }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })
}

// ============================================================================
// SYSTEM HANDLERS
// ============================================================================

function setupSystemHandlers(): void {
  /**
   * Get app version
   */
  ipcMain.handle("system:getVersion", async () => {
    const { app } = require("electron")
    return { success: true, version: app.getVersion() }
  })

  /**
   * Get app path
   */
  ipcMain.handle("system:getPath", async (_event, name: string) => {
    const { app } = require("electron")
    return { success: true, path: app.getPath(name as any) }
  })

  /**
   * Minimize window
   */
  ipcMain.on("system:minimize", (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    window?.minimize()
  })

  /**
   * Maximize window
   */
  ipcMain.on("system:maximize", (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (window?.isMaximized()) {
      window.unmaximize()
    } else {
      window?.maximize()
    }
  })

  /**
   * Close window
   */
  ipcMain.on("system:close", (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    window?.close()
  })

  /**
   * Toggle dev tools
   */
  ipcMain.on("system:toggleDevTools", (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    window?.webContents.toggleDevTools()
  })
}
