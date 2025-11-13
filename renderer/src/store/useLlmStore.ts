/**
 * Horalix Halo - LLM Store
 *
 * Manages LLM request state, streaming, costs, and metrics.
 */

import { create } from "zustand"
import type { LlmProviderId } from "../../../src/main/state/StateTypes"

export interface LlmRequest {
  id: string
  modelId: string
  providerId: LlmProviderId
  startedAt: number
  status: "pending" | "streaming" | "completed" | "error"
}

export interface LlmMetrics {
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  totalCost: number
  averageLatency: number
  cacheHitRate: number
}

export interface LlmState {
  // Current Request
  currentRequest: LlmRequest | null
  streamingContent: string
  streamingReasoning: string
  isStreaming: boolean

  // Metrics
  metrics: LlmMetrics
  costByProvider: Record<LlmProviderId, number>
  requestHistory: LlmRequest[]

  // Cache Stats
  cacheHits: number
  cacheMisses: number

  // Actions
  startRequest: (
    modelId: string,
    providerId: LlmProviderId
  ) => void
  updateStreaming: (content: string, reasoning?: string) => void
  completeRequest: (success: boolean, cost: number, latencyMs: number) => void
  cancelRequest: () => void

  // Metrics
  addCost: (providerId: LlmProviderId, cost: number) => void
  recordCacheHit: () => void
  recordCacheMiss: () => void

  // Utilities
  reset: () => void
  resetMetrics: () => void
}

const generateId = () => `req_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`

const initialMetrics: LlmMetrics = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  totalCost: 0,
  averageLatency: 0,
  cacheHitRate: 0,
}

const initialState = {
  currentRequest: null,
  streamingContent: "",
  streamingReasoning: "",
  isStreaming: false,
  metrics: initialMetrics,
  costByProvider: {} as Record<LlmProviderId, number>,
  requestHistory: [],
  cacheHits: 0,
  cacheMisses: 0,
}

export const useLlmStore = create<LlmState>((set, get) => ({
  ...initialState,

  startRequest: (modelId, providerId) => {
    const request: LlmRequest = {
      id: generateId(),
      modelId,
      providerId,
      startedAt: Date.now(),
      status: "streaming",
    }

    set({
      currentRequest: request,
      streamingContent: "",
      streamingReasoning: "",
      isStreaming: true,
      metrics: {
        ...get().metrics,
        totalRequests: get().metrics.totalRequests + 1,
      },
    })
  },

  updateStreaming: (content, reasoning) => {
    set({
      streamingContent: content,
      streamingReasoning: reasoning || get().streamingReasoning,
    })
  },

  completeRequest: (success, cost, latencyMs) => {
    const { currentRequest, metrics, requestHistory } = get()

    if (currentRequest) {
      const completedRequest: LlmRequest = {
        ...currentRequest,
        status: success ? "completed" : "error",
      }

      // Update metrics
      const newMetrics = {
        ...metrics,
        successfulRequests: success
          ? metrics.successfulRequests + 1
          : metrics.successfulRequests,
        failedRequests: success
          ? metrics.failedRequests
          : metrics.failedRequests + 1,
        totalCost: metrics.totalCost + cost,
        averageLatency:
          (metrics.averageLatency * (metrics.totalRequests - 1) + latencyMs) /
          metrics.totalRequests,
      }

      set({
        currentRequest: null,
        isStreaming: false,
        metrics: newMetrics,
        requestHistory: [completedRequest, ...requestHistory].slice(0, 100), // Keep last 100
      })
    }
  },

  cancelRequest: () => {
    set({
      currentRequest: null,
      streamingContent: "",
      streamingReasoning: "",
      isStreaming: false,
    })
  },

  addCost: (providerId, cost) => {
    const { costByProvider } = get()
    set({
      costByProvider: {
        ...costByProvider,
        [providerId]: (costByProvider[providerId] || 0) + cost,
      },
    })
  },

  recordCacheHit: () => {
    const { cacheHits, cacheMisses } = get()
    const total = cacheHits + cacheMisses + 1
    set({
      cacheHits: cacheHits + 1,
      metrics: {
        ...get().metrics,
        cacheHitRate: (cacheHits + 1) / total,
      },
    })
  },

  recordCacheMiss: () => {
    const { cacheHits, cacheMisses } = get()
    const total = cacheHits + cacheMisses + 1
    set({
      cacheMisses: cacheMisses + 1,
      metrics: {
        ...get().metrics,
        cacheHitRate: cacheHits / total,
      },
    })
  },

  reset: () => set(initialState),
  resetMetrics: () =>
    set({
      metrics: initialMetrics,
      costByProvider: {},
      cacheHits: 0,
      cacheMisses: 0,
    }),
}))
