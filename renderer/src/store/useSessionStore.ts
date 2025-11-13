/**
 * Horalix Halo - Session Store
 *
 * Manages active session, messages, context items, and transcripts.
 * The core of the chat and meeting experience.
 */

import { create } from "zustand"
import type {
  HaloSession,
  Message,
  ContextItem,
  TranscriptSegment,
  SessionMode,
  AnswerType,
  MeetingContext,
} from "../../../src/main/state/StateTypes"

export interface SessionState {
  // Current Session
  currentSession: HaloSession | null
  sessions: HaloSession[]

  // Messages
  messages: Message[]
  streamingMessage: string | null
  streamingReasoning: string | null

  // Context
  contextItems: ContextItem[]
  selectedContextIds: string[]
  transcriptSegments: TranscriptSegment[]

  // Current Request
  isProcessing: boolean
  currentMode: SessionMode
  currentAnswerType: AnswerType
  meetingContext: MeetingContext | null

  // Actions - Session Management
  createSession: (mode: SessionMode, name?: string) => void
  endSession: () => void
  setCurrentSession: (session: HaloSession) => void
  deleteSession: (sessionId: string) => void

  // Actions - Messages
  addMessage: (message: Omit<Message, "id" | "createdAt">) => void
  updateStreamingMessage: (content: string, reasoning?: string) => void
  finalizeStreamingMessage: (
    messageId: string,
    content: string,
    reasoning?: string
  ) => void
  clearMessages: () => void

  // Actions - Context
  addContextItem: (item: ContextItem) => void
  removeContextItem: (itemId: string) => void
  toggleContextSelection: (itemId: string) => void
  clearContextSelection: () => void
  clearContext: () => void
  pinContextItem: (itemId: string) => void

  // Actions - Transcripts
  addTranscriptSegment: (segment: TranscriptSegment) => void
  clearTranscripts: () => void

  // Actions - Mode & Settings
  setMode: (mode: SessionMode) => void
  setAnswerType: (answerType: AnswerType) => void
  setMeetingContext: (context: MeetingContext) => void
  setProcessing: (isProcessing: boolean) => void

  // Utilities
  reset: () => void
}

const generateId = () => `${Date.now()}_${Math.random().toString(36).slice(2, 11)}`

const initialState = {
  currentSession: null,
  sessions: [],
  messages: [],
  streamingMessage: null,
  streamingReasoning: null,
  contextItems: [],
  selectedContextIds: [],
  transcriptSegments: [],
  isProcessing: false,
  currentMode: "auto" as SessionMode,
  currentAnswerType: "auto" as AnswerType,
  meetingContext: null,
}

export const useSessionStore = create<SessionState>((set, get) => ({
  ...initialState,

  // Session Management
  createSession: (mode, name) => {
    const session: HaloSession = {
      id: generateId(),
      name: name || `Session ${get().sessions.length + 1}`,
      mode,
      status: "active",
      startedAt: Date.now(),
      contextItemIds: [],
      transcriptSegmentIds: [],
      messageIds: [],
    }

    set({
      currentSession: session,
      sessions: [...get().sessions, session],
      messages: [],
      contextItems: [],
      transcriptSegments: [],
      currentMode: mode,
    })
  },

  endSession: () => {
    const { currentSession, sessions } = get()
    if (!currentSession) return

    const updatedSession: HaloSession = {
      ...currentSession,
      status: "ended",
      endedAt: Date.now(),
    }

    set({
      currentSession: null,
      sessions: sessions.map((s) =>
        s.id === currentSession.id ? updatedSession : s
      ),
    })
  },

  setCurrentSession: (session) => set({ currentSession: session }),

  deleteSession: (sessionId) => {
    set({
      sessions: get().sessions.filter((s) => s.id !== sessionId),
      currentSession:
        get().currentSession?.id === sessionId ? null : get().currentSession,
    })
  },

  // Messages
  addMessage: (messageData) => {
    const message: Message = {
      ...messageData,
      id: generateId(),
      sessionId: get().currentSession?.id || "",
      createdAt: Date.now(),
    }

    set({
      messages: [...get().messages, message],
      streamingMessage: null,
      streamingReasoning: null,
    })
  },

  updateStreamingMessage: (content, reasoning) => {
    set({
      streamingMessage: content,
      streamingReasoning: reasoning,
    })
  },

  finalizeStreamingMessage: (messageId, content, reasoning) => {
    const message: Message = {
      id: messageId,
      sessionId: get().currentSession?.id || "",
      role: "assistant",
      content,
      reasoningContent: reasoning,
      createdAt: Date.now(),
    }

    set({
      messages: [...get().messages, message],
      streamingMessage: null,
      streamingReasoning: null,
      isProcessing: false,
    })
  },

  clearMessages: () => set({ messages: [], streamingMessage: null }),

  // Context Items
  addContextItem: (item) => {
    set({
      contextItems: [...get().contextItems, item],
    })

    // Update current session
    const { currentSession } = get()
    if (currentSession) {
      set({
        currentSession: {
          ...currentSession,
          contextItemIds: [...currentSession.contextItemIds, item.id],
        },
      })
    }
  },

  removeContextItem: (itemId) => {
    set({
      contextItems: get().contextItems.filter((i) => i.id !== itemId),
      selectedContextIds: get().selectedContextIds.filter((id) => id !== itemId),
    })
  },

  toggleContextSelection: (itemId) => {
    const { selectedContextIds } = get()
    set({
      selectedContextIds: selectedContextIds.includes(itemId)
        ? selectedContextIds.filter((id) => id !== itemId)
        : [...selectedContextIds, itemId],
    })
  },

  clearContextSelection: () => set({ selectedContextIds: [] }),

  clearContext: () => set({ contextItems: [], selectedContextIds: [] }),

  pinContextItem: (itemId) => {
    set({
      contextItems: get().contextItems.map((item) =>
        item.id === itemId ? { ...item, pinned: !item.pinned } : item
      ),
    })
  },

  // Transcripts
  addTranscriptSegment: (segment) => {
    set({
      transcriptSegments: [...get().transcriptSegments, segment],
    })
  },

  clearTranscripts: () => set({ transcriptSegments: [] }),

  // Mode & Settings
  setMode: (mode) => set({ currentMode: mode }),
  setAnswerType: (answerType) => set({ currentAnswerType: answerType }),
  setMeetingContext: (meetingContext) => set({ meetingContext }),
  setProcessing: (isProcessing) => set({ isProcessing }),

  // Reset
  reset: () => set(initialState),
}))
