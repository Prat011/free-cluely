/**
 * Horalix Halo - Preload Script
 *
 * Secure bridge between main and renderer processes.
 * Exposes controlled IPC API via contextBridge.
 */

import { contextBridge, ipcRenderer } from "electron"
import type {
  LlmRequestOptions,
  LlmResponseChunk,
  LlmMetrics,
} from "../main/engines/llm/types"
import type {
  HaloSession,
  Message,
  ContextItem,
  TranscriptSegment,
} from "../main/state/StateTypes"
import type { SessionQuery, SessionStats } from "../main/engines/session"

// ============================================================================
// HORALIX HALO API
// ============================================================================

export interface HoralixApi {
  // LLM
  llm: {
    stream: (
      options: LlmRequestOptions,
      onChunk: (chunk: LlmResponseChunk) => void,
      onComplete: () => void,
      onError: (error: { message: string; code?: string }) => void
    ) => () => void
    cancel: () => void
    getMetrics: () => Promise<LlmMetrics>
    getCostByProvider: () => Promise<Record<string, number>>
    clearCache: () => Promise<{ success: boolean }>
    testProvider: (
      providerId: string,
      config: any
    ) => Promise<{ success: boolean; error?: string }>
  }

  // Session
  session: {
    create: (
      session: HaloSession
    ) => Promise<{ success: boolean; session?: HaloSession; error?: string }>
    get: (
      sessionId: string
    ) => Promise<{ success: boolean; session?: HaloSession; error?: string }>
    update: (
      sessionId: string,
      updates: Partial<HaloSession>
    ) => Promise<{ success: boolean; error?: string }>
    delete: (
      sessionId: string
    ) => Promise<{ success: boolean; error?: string }>
    query: (
      query: SessionQuery
    ) => Promise<{ success: boolean; sessions?: HaloSession[]; error?: string }>
    getRecent: (
      limit?: number
    ) => Promise<{ success: boolean; sessions?: HaloSession[]; error?: string }>
    addMessage: (
      message: Message
    ) => Promise<{ success: boolean; error?: string }>
    getMessages: (
      sessionId: string,
      limit?: number
    ) => Promise<{ success: boolean; messages?: Message[]; error?: string }>
    searchMessages: (
      searchText: string,
      limit?: number
    ) => Promise<{ success: boolean; messages?: Message[]; error?: string }>
    addContext: (
      item: ContextItem
    ) => Promise<{ success: boolean; error?: string }>
    getContext: (
      sessionId: string
    ) => Promise<{ success: boolean; items?: ContextItem[]; error?: string }>
    updateContext: (
      itemId: string,
      updates: Partial<ContextItem>
    ) => Promise<{ success: boolean; error?: string }>
    deleteContext: (
      itemId: string
    ) => Promise<{ success: boolean; error?: string }>
    addTranscript: (
      segment: TranscriptSegment
    ) => Promise<{ success: boolean; error?: string }>
    getTranscripts: (
      sessionId: string
    ) => Promise<{
      success: boolean
      segments?: TranscriptSegment[]
      error?: string
    }>
    getStats: () => Promise<{
      success: boolean
      stats?: SessionStats
      error?: string
    }>
  }

  // Screenshot
  screenshot: {
    capture: (
      source?: string
    ) => Promise<{
      success: boolean
      data?: string
      name?: string
      error?: string
    }>
    getSources: () => Promise<{
      success: boolean
      sources?: Array<{ id: string; name: string; thumbnail: string }>
      error?: string
    }>
  }

  // System
  system: {
    getVersion: () => Promise<{ success: boolean; version?: string }>
    getPath: (name: string) => Promise<{ success: boolean; path?: string }>
    minimize: () => void
    maximize: () => void
    close: () => void
    toggleDevTools: () => void
  }
}

// ============================================================================
// EXPOSE API
// ============================================================================

const horalixApi: HoralixApi = {
  // LLM API
  llm: {
    stream: (options, onChunk, onComplete, onError) => {
      // Set up listeners
      const chunkListener = (_event: any, chunk: LlmResponseChunk) => {
        onChunk(chunk)
      }

      const completeListener = () => {
        onComplete()
        cleanup()
      }

      const errorListener = (
        _event: any,
        error: { message: string; code?: string }
      ) => {
        onError(error)
        cleanup()
      }

      ipcRenderer.on("llm:stream:chunk", chunkListener)
      ipcRenderer.once("llm:stream:complete", completeListener)
      ipcRenderer.once("llm:stream:error", errorListener)

      // Start stream
      ipcRenderer.send("llm:stream", options)

      // Cleanup function
      const cleanup = () => {
        ipcRenderer.removeListener("llm:stream:chunk", chunkListener)
        ipcRenderer.removeListener("llm:stream:complete", completeListener)
        ipcRenderer.removeListener("llm:stream:error", errorListener)
      }

      // Return cleanup function for manual cancellation
      return cleanup
    },

    cancel: () => {
      ipcRenderer.send("llm:cancel")
    },

    getMetrics: () => ipcRenderer.invoke("llm:getMetrics"),
    getCostByProvider: () => ipcRenderer.invoke("llm:getCostByProvider"),
    clearCache: () => ipcRenderer.invoke("llm:clearCache"),
    testProvider: (providerId, config) =>
      ipcRenderer.invoke("llm:testProvider", providerId, config),
  },

  // Session API
  session: {
    create: (session) => ipcRenderer.invoke("session:create", session),
    get: (sessionId) => ipcRenderer.invoke("session:get", sessionId),
    update: (sessionId, updates) =>
      ipcRenderer.invoke("session:update", sessionId, updates),
    delete: (sessionId) => ipcRenderer.invoke("session:delete", sessionId),
    query: (query) => ipcRenderer.invoke("session:query", query),
    getRecent: (limit) => ipcRenderer.invoke("session:getRecent", limit),
    addMessage: (message) => ipcRenderer.invoke("session:addMessage", message),
    getMessages: (sessionId, limit) =>
      ipcRenderer.invoke("session:getMessages", sessionId, limit),
    searchMessages: (searchText, limit) =>
      ipcRenderer.invoke("session:searchMessages", searchText, limit),
    addContext: (item) => ipcRenderer.invoke("session:addContext", item),
    getContext: (sessionId) =>
      ipcRenderer.invoke("session:getContext", sessionId),
    updateContext: (itemId, updates) =>
      ipcRenderer.invoke("session:updateContext", itemId, updates),
    deleteContext: (itemId) =>
      ipcRenderer.invoke("session:deleteContext", itemId),
    addTranscript: (segment) =>
      ipcRenderer.invoke("session:addTranscript", segment),
    getTranscripts: (sessionId) =>
      ipcRenderer.invoke("session:getTranscripts", sessionId),
    getStats: () => ipcRenderer.invoke("session:getStats"),
  },

  // Screenshot API
  screenshot: {
    capture: (source) => ipcRenderer.invoke("screenshot:capture", source),
    getSources: () => ipcRenderer.invoke("screenshot:getSources"),
  },

  // System API
  system: {
    getVersion: () => ipcRenderer.invoke("system:getVersion"),
    getPath: (name) => ipcRenderer.invoke("system:getPath", name),
    minimize: () => ipcRenderer.send("system:minimize"),
    maximize: () => ipcRenderer.send("system:maximize"),
    close: () => ipcRenderer.send("system:close"),
    toggleDevTools: () => ipcRenderer.send("system:toggleDevTools"),
  },
}

// Expose API to renderer
contextBridge.exposeInMainWorld("horalix", horalixApi)

// TypeScript declaration for window.horalix
declare global {
  interface Window {
    horalix: HoralixApi
  }
}
