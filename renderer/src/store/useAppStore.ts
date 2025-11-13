/**
 * Horalix Halo - App Store
 *
 * Global application state using Zustand.
 * Manages UI state, theme, mode, and general app behavior.
 */

import { create } from "zustand"
import { persist } from "zustand/middleware"

export type Theme = "light" | "dark" | "auto"
export type ViewMode = "chat" | "context" | "settings"

export interface AppState {
  // UI State
  theme: Theme
  viewMode: ViewMode
  isCompactMode: boolean
  showCommandPalette: boolean
  showDebugDrawer: boolean
  overlayOpacity: number

  // Window State
  isOverlayVisible: boolean
  windowPosition: { x: number; y: number }

  // Actions
  setTheme: (theme: Theme) => void
  setViewMode: (mode: ViewMode) => void
  setCompactMode: (compact: boolean) => void
  toggleCommandPalette: () => void
  toggleDebugDrawer: () => void
  setOverlayOpacity: (opacity: number) => void
  setOverlayVisible: (visible: boolean) => void
  setWindowPosition: (x: number, y: number) => void

  // Utilities
  reset: () => void
}

const initialState = {
  theme: "dark" as Theme,
  viewMode: "chat" as ViewMode,
  isCompactMode: false,
  showCommandPalette: false,
  showDebugDrawer: false,
  overlayOpacity: 0.95,
  isOverlayVisible: true,
  windowPosition: { x: 0, y: 0 },
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      ...initialState,

      // Actions
      setTheme: (theme) => set({ theme }),
      setViewMode: (viewMode) => set({ viewMode }),
      setCompactMode: (isCompactMode) => set({ isCompactMode }),
      toggleCommandPalette: () =>
        set((state) => ({ showCommandPalette: !state.showCommandPalette })),
      toggleDebugDrawer: () =>
        set((state) => ({ showDebugDrawer: !state.showDebugDrawer })),
      setOverlayOpacity: (overlayOpacity) => set({ overlayOpacity }),
      setOverlayVisible: (isOverlayVisible) => set({ isOverlayVisible }),
      setWindowPosition: (x, y) => set({ windowPosition: { x, y } }),

      reset: () => set(initialState),
    }),
    {
      name: "horalix-app-storage",
      partialize: (state) => ({
        theme: state.theme,
        isCompactMode: state.isCompactMode,
        overlayOpacity: state.overlayOpacity,
      }),
    }
  )
)
