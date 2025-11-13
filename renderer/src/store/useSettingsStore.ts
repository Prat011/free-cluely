/**
 * Horalix Halo - Settings Store
 *
 * Manages user settings, API keys, provider configs, and preferences.
 */

import { create } from "zustand"
import { persist } from "zustand/middleware"
import type {
  LlmProviderId,
  AiProfile,
  SessionMode,
  AnswerType,
} from "../../../src/main/state/StateTypes"

export interface ProviderSettings {
  enabled: boolean
  apiKey?: string
  baseUrl?: string
  customSettings?: Record<string, any>
}

export interface HotkeyBinding {
  action: string
  key: string
  modifiers: ("ctrl" | "shift" | "alt" | "cmd")[]
  enabled: boolean
}

export interface SettingsState {
  // LLM Settings
  activeProfile: AiProfile
  defaultMode: SessionMode
  defaultAnswerType: AnswerType
  providers: Record<LlmProviderId, ProviderSettings>
  defaultProviderId: LlmProviderId
  defaultModelId: string

  // UI Settings
  enableAnimations: boolean
  fontSize: "small" | "medium" | "large"
  showReasoningByDefault: boolean

  // Privacy Settings
  blacklistedApps: string[]
  neverCaptureIncognito: boolean
  encryptLocalStorage: boolean

  // Capture Settings
  enableOcr: boolean
  maxScreenshotsPerSession: number
  autoCapture: boolean

  // Audio/STT Settings
  enableMicCapture: boolean
  enableSystemAudio: boolean
  sttProvider: "deepgram" | "assemblyai" | "disabled"
  sttApiKey?: string

  // Hotkeys
  hotkeys: HotkeyBinding[]

  // Advanced
  enableDebugMode: boolean
  enableTelemetry: boolean

  // Actions - LLM Settings
  setActiveProfile: (profile: AiProfile) => void
  setDefaultMode: (mode: SessionMode) => void
  setDefaultAnswerType: (answerType: AnswerType) => void
  updateProviderSettings: (
    providerId: LlmProviderId,
    settings: Partial<ProviderSettings>
  ) => void
  setDefaultProvider: (providerId: LlmProviderId) => void
  setDefaultModel: (modelId: string) => void

  // Actions - UI Settings
  setEnableAnimations: (enable: boolean) => void
  setFontSize: (size: "small" | "medium" | "large") => void
  setShowReasoningByDefault: (show: boolean) => void

  // Actions - Privacy
  addBlacklistedApp: (app: string) => void
  removeBlacklistedApp: (app: string) => void
  setNeverCaptureIncognito: (never: boolean) => void
  setEncryptLocalStorage: (encrypt: boolean) => void

  // Actions - Capture
  setEnableOcr: (enable: boolean) => void
  setMaxScreenshotsPerSession: (max: number) => void
  setAutoCapture: (auto: boolean) => void

  // Actions - Audio/STT
  setEnableMicCapture: (enable: boolean) => void
  setEnableSystemAudio: (enable: boolean) => void
  setSttProvider: (provider: "deepgram" | "assemblyai" | "disabled") => void
  setSttApiKey: (key: string) => void

  // Actions - Hotkeys
  updateHotkey: (action: string, binding: Partial<HotkeyBinding>) => void
  resetHotkeys: () => void

  // Actions - Advanced
  setEnableDebugMode: (enable: boolean) => void
  setEnableTelemetry: (enable: boolean) => void

  // Utilities
  reset: () => void
  exportSettings: () => string
  importSettings: (json: string) => void
}

const defaultHotkeys: HotkeyBinding[] = [
  {
    action: "toggle-overlay",
    key: "Space",
    modifiers: ["cmd", "shift"],
    enabled: true,
  },
  {
    action: "take-screenshot",
    key: "h",
    modifiers: ["cmd"],
    enabled: true,
  },
  {
    action: "command-palette",
    key: "k",
    modifiers: ["cmd"],
    enabled: true,
  },
  {
    action: "new-session",
    key: "n",
    modifiers: ["cmd"],
    enabled: true,
  },
  {
    action: "clear-context",
    key: "l",
    modifiers: ["cmd"],
    enabled: true,
  },
]

const initialState = {
  // LLM Settings
  activeProfile: "balanced" as AiProfile,
  defaultMode: "auto" as SessionMode,
  defaultAnswerType: "auto" as AnswerType,
  providers: {
    deepseek: { enabled: true },
    openai: { enabled: false },
    anthropic: { enabled: false },
    google: { enabled: false },
    ollama: { enabled: false },
    custom: { enabled: false },
  } as Record<LlmProviderId, ProviderSettings>,
  defaultProviderId: "deepseek" as LlmProviderId,
  defaultModelId: "deepseek-chat",

  // UI Settings
  enableAnimations: true,
  fontSize: "medium" as const,
  showReasoningByDefault: false,

  // Privacy Settings
  blacklistedApps: [],
  neverCaptureIncognito: true,
  encryptLocalStorage: false,

  // Capture Settings
  enableOcr: true,
  maxScreenshotsPerSession: 100,
  autoCapture: false,

  // Audio/STT Settings
  enableMicCapture: false,
  enableSystemAudio: false,
  sttProvider: "disabled" as const,
  sttApiKey: undefined,

  // Hotkeys
  hotkeys: defaultHotkeys,

  // Advanced
  enableDebugMode: false,
  enableTelemetry: false,
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      ...initialState,

      // LLM Settings
      setActiveProfile: (activeProfile) => set({ activeProfile }),
      setDefaultMode: (defaultMode) => set({ defaultMode }),
      setDefaultAnswerType: (defaultAnswerType) => set({ defaultAnswerType }),

      updateProviderSettings: (providerId, settings) => {
        set({
          providers: {
            ...get().providers,
            [providerId]: {
              ...get().providers[providerId],
              ...settings,
            },
          },
        })
      },

      setDefaultProvider: (defaultProviderId) => set({ defaultProviderId }),
      setDefaultModel: (defaultModelId) => set({ defaultModelId }),

      // UI Settings
      setEnableAnimations: (enableAnimations) => set({ enableAnimations }),
      setFontSize: (fontSize) => set({ fontSize }),
      setShowReasoningByDefault: (showReasoningByDefault) =>
        set({ showReasoningByDefault }),

      // Privacy
      addBlacklistedApp: (app) => {
        set({
          blacklistedApps: [...get().blacklistedApps, app],
        })
      },

      removeBlacklistedApp: (app) => {
        set({
          blacklistedApps: get().blacklistedApps.filter((a) => a !== app),
        })
      },

      setNeverCaptureIncognito: (neverCaptureIncognito) =>
        set({ neverCaptureIncognito }),
      setEncryptLocalStorage: (encryptLocalStorage) =>
        set({ encryptLocalStorage }),

      // Capture
      setEnableOcr: (enableOcr) => set({ enableOcr }),
      setMaxScreenshotsPerSession: (maxScreenshotsPerSession) =>
        set({ maxScreenshotsPerSession }),
      setAutoCapture: (autoCapture) => set({ autoCapture }),

      // Audio/STT
      setEnableMicCapture: (enableMicCapture) => set({ enableMicCapture }),
      setEnableSystemAudio: (enableSystemAudio) => set({ enableSystemAudio }),
      setSttProvider: (sttProvider) => set({ sttProvider }),
      setSttApiKey: (sttApiKey) => set({ sttApiKey }),

      // Hotkeys
      updateHotkey: (action, binding) => {
        set({
          hotkeys: get().hotkeys.map((h) =>
            h.action === action ? { ...h, ...binding } : h
          ),
        })
      },

      resetHotkeys: () => set({ hotkeys: defaultHotkeys }),

      // Advanced
      setEnableDebugMode: (enableDebugMode) => set({ enableDebugMode }),
      setEnableTelemetry: (enableTelemetry) => set({ enableTelemetry }),

      // Utilities
      reset: () => set(initialState),

      exportSettings: () => {
        const settings = get()
        return JSON.stringify(settings, null, 2)
      },

      importSettings: (json) => {
        try {
          const settings = JSON.parse(json)
          set(settings)
        } catch (error) {
          console.error("Failed to import settings:", error)
        }
      },
    }),
    {
      name: "horalix-settings-storage",
      // Don't persist API keys in localStorage for security
      partialize: (state) => ({
        ...state,
        providers: Object.fromEntries(
          Object.entries(state.providers).map(([id, settings]) => [
            id,
            { ...settings, apiKey: undefined },
          ])
        ),
        sttApiKey: undefined,
      }),
    }
  )
)
