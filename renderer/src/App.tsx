/**
 * Horalix Halo - Main App Component
 *
 * Integrates all UI components into a complete application.
 */

import React, { useState, useEffect } from "react"
import { useAppStore, useSessionStore, useSettingsStore, useLlmStore } from "./store"
import { ChatPanel } from "./components/chat/ChatPanel"
import { ContextPanel } from "./components/context/ContextPanel"
import { MeetingToolbar } from "./components/meeting/MeetingToolbar"
import {
  AnswerTypeSelector,
  MiniAnswerTypeSelector,
} from "./components/controls/AnswerTypeSelector"
import { CommandPalette } from "./components/controls/CommandPalette"
import { GlassCard, GlassButton, GlassPill } from "./components/glass"
import { cn } from "./lib/utils"
import type { SessionMode, AnswerType } from "../../src/main/state/StateTypes"

export const App: React.FC = () => {
  const { theme, compactMode, overlayVisible, setOverlayVisible } = useAppStore()
  const { currentSession, currentMode, isProcessing } = useSessionStore()
  const { activeProfile } = useSettingsStore()
  const { costByProvider } = useLlmStore()

  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K / Ctrl+K - Command Palette
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setCommandPaletteOpen(true)
      }

      // Cmd+, / Ctrl+, - Settings
      if ((e.metaKey || e.ctrlKey) && e.key === ",") {
        e.preventDefault()
        setSettingsOpen(true)
      }

      // Cmd+B / Ctrl+B - Toggle Sidebar
      if ((e.metaKey || e.ctrlKey) && e.key === "b") {
        e.preventDefault()
        setSidebarCollapsed(!sidebarCollapsed)
      }

      // Cmd+Shift+Space - Toggle Overlay
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.code === "Space") {
        e.preventDefault()
        setOverlayVisible(!overlayVisible)
      }

      // Escape - Close dialogs
      if (e.key === "Escape") {
        setCommandPaletteOpen(false)
        setSettingsOpen(false)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [overlayVisible, setOverlayVisible, sidebarCollapsed])

  // Calculate total cost
  const totalCost = Object.values(costByProvider).reduce((sum, cost) => sum + cost, 0)

  return (
    <div
      className={cn(
        "h-screen w-screen overflow-hidden",
        "bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950",
        theme === "dark" ? "dark" : ""
      )}
    >
      {/* Header */}
      <header className="h-16 border-b border-white/10 backdrop-blur-xl bg-black/20 flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-halo-gradient flex items-center justify-center text-white font-bold">
              H
            </div>
            <h1 className="text-xl font-bold bg-halo-gradient bg-clip-text text-transparent">
              Horalix Halo
            </h1>
          </div>

          {/* Mode Selector */}
          <div className="flex items-center gap-2">
            {(["auto", "coding", "meeting", "research"] as SessionMode[]).map(
              (mode) => (
                <button
                  key={mode}
                  onClick={() => useSessionStore.getState().setMode(mode)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                    "hover:scale-105",
                    currentMode === mode
                      ? "bg-halo-gradient text-white shadow-glow"
                      : "bg-white/5 text-slate-400 hover:bg-white/10"
                  )}
                >
                  {mode === "auto" && "🤖"}
                  {mode === "coding" && "💻"}
                  {mode === "meeting" && "🎙️"}
                  {mode === "research" && "🔬"}
                  <span className="ml-1.5 capitalize">{mode}</span>
                </button>
              )
            )}
          </div>

          {/* Answer Type */}
          <MiniAnswerTypeSelector />
        </div>

        <div className="flex items-center gap-4">
          {/* Profile Badge */}
          <GlassPill size="sm" variant="info">
            {activeProfile === "speed" && "⚡ Speed"}
            {activeProfile === "balanced" && "⚖️ Balanced"}
            {activeProfile === "quality" && "💎 Quality"}
          </GlassPill>

          {/* Cost Tracker */}
          {totalCost > 0 && (
            <GlassPill size="sm" variant="success">
              💰 ${totalCost.toFixed(4)}
            </GlassPill>
          )}

          {/* Processing Indicator */}
          {isProcessing && (
            <div className="flex items-center gap-2 text-halo-purple-400 animate-pulse">
              <div className="w-2 h-2 rounded-full bg-halo-purple-500 animate-glow-pulse" />
              <span className="text-xs font-medium">Processing...</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCommandPaletteOpen(true)}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-all"
              title="Command Palette (⌘K)"
            >
              <svg
                className="w-5 h-5 text-slate-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </button>

            <button
              onClick={() => setSettingsOpen(true)}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-all"
              title="Settings (⌘,)"
            >
              <svg
                className="w-5 h-5 text-slate-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="h-[calc(100vh-4rem)] flex">
        {/* Chat Area */}
        <div className="flex-1 flex flex-col p-4 gap-4 overflow-hidden">
          {/* Meeting Toolbar (only in meeting mode) */}
          {currentMode === "meeting" && (
            <MeetingToolbar compact={compactMode} />
          )}

          {/* Chat Panel */}
          <div className="flex-1 overflow-hidden">
            <ChatPanel />
          </div>
        </div>

        {/* Sidebar */}
        {!sidebarCollapsed && (
          <div className="w-96 border-l border-white/10 backdrop-blur-xl bg-black/20 p-4 overflow-y-auto">
            <div className="space-y-4">
              {/* Context Panel */}
              <ContextPanel />

              {/* Answer Type Selector */}
              {!compactMode && <AnswerTypeSelector />}
            </div>
          </div>
        )}

        {/* Sidebar Toggle */}
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className={cn(
            "fixed right-0 top-1/2 -translate-y-1/2",
            "p-2 rounded-l-lg bg-white/5 hover:bg-white/10",
            "border-l border-y border-white/10",
            "transition-all",
            sidebarCollapsed ? "right-0" : "right-96"
          )}
          title="Toggle Sidebar (⌘B)"
        >
          <svg
            className={cn(
              "w-5 h-5 text-slate-400 transition-transform",
              sidebarCollapsed ? "rotate-180" : ""
            )}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
      </div>

      {/* Command Palette */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
      />

      {/* Settings Modal */}
      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <GlassCard className="w-full max-w-4xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Settings</h2>
              <button
                onClick={() => setSettingsOpen(false)}
                className="p-2 rounded-lg hover:bg-white/10"
              >
                <svg
                  className="w-6 h-6 text-slate-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="text-white">
              <p>Settings panel coming soon...</p>
              <p className="text-sm text-slate-400 mt-2">
                Will include provider configuration, hotkeys, privacy settings,
                and more.
              </p>
            </div>
          </GlassCard>
        </div>
      )}

      {/* Hint for new users */}
      {!currentSession && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 pointer-events-none">
          <div className="bg-halo-gradient px-6 py-3 rounded-full shadow-glow text-white text-sm font-medium animate-float">
            Press <kbd className="px-2 py-1 rounded bg-white/20 mx-1">⌘K</kbd> to
            get started
          </div>
        </div>
      )}
    </div>
  )
}

export default App
