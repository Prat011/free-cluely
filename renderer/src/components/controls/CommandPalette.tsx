/**
 * Horalix Halo - CommandPalette Component
 *
 * Cmd+K command palette with fuzzy search.
 * Quick access to all features and actions.
 */

import React, { useState, useEffect, useRef, useMemo } from "react"
import { useAppStore, useSessionStore, useSettingsStore } from "../../store"
import { GlassCard, GlassPill } from "../glass"
import { cn } from "../../lib/utils"
import { motion, AnimatePresence } from "framer-motion"
import type {
  SessionMode,
  AnswerType,
  AiProfile,
} from "../../../../src/main/state/StateTypes"

export interface Command {
  id: string
  label: string
  description: string
  icon: string
  category: "session" | "mode" | "answer" | "profile" | "view" | "action"
  keywords: string[]
  shortcut?: string
  action: () => void
}

export interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
}) => {
  const [search, setSearch] = useState("")
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const sessionStore = useSessionStore()
  const appStore = useAppStore()
  const settingsStore = useSettingsStore()

  // Build command list
  const commands: Command[] = useMemo(
    () => [
      // Session Commands
      {
        id: "new-session",
        label: "New Session",
        description: "Start a fresh conversation",
        icon: "➕",
        category: "session",
        keywords: ["new", "session", "fresh", "start"],
        shortcut: "⌘N",
        action: () => {
          sessionStore.createSession("auto", "New Session")
          onClose()
        },
      },
      {
        id: "clear-context",
        label: "Clear Context",
        description: "Remove all context items",
        icon: "🗑️",
        category: "session",
        keywords: ["clear", "context", "delete", "remove"],
        shortcut: "⌘L",
        action: () => {
          sessionStore.clearContext()
          onClose()
        },
      },
      {
        id: "export-session",
        label: "Export Session",
        description: "Save current session to file",
        icon: "💾",
        category: "session",
        keywords: ["export", "save", "download"],
        action: () => {
          // TODO: Implement export
          console.log("Export session")
          onClose()
        },
      },

      // Mode Commands
      {
        id: "mode-auto",
        label: "Auto Mode",
        description: "Let AI detect the best mode",
        icon: "🤖",
        category: "mode",
        keywords: ["mode", "auto", "automatic"],
        action: () => {
          sessionStore.setMode("auto")
          onClose()
        },
      },
      {
        id: "mode-coding",
        label: "Coding Mode",
        description: "Optimized for development",
        icon: "💻",
        category: "mode",
        keywords: ["mode", "coding", "development", "programming"],
        action: () => {
          sessionStore.setMode("coding")
          onClose()
        },
      },
      {
        id: "mode-meeting",
        label: "Meeting Mode",
        description: "Real-time meeting assistance",
        icon: "🎙️",
        category: "mode",
        keywords: ["mode", "meeting", "call", "transcript"],
        action: () => {
          sessionStore.setMode("meeting")
          onClose()
        },
      },
      {
        id: "mode-research",
        label: "Research Mode",
        description: "Deep analysis and exploration",
        icon: "🔬",
        category: "mode",
        keywords: ["mode", "research", "analysis", "study"],
        action: () => {
          sessionStore.setMode("research")
          onClose()
        },
      },

      // Answer Type Commands
      {
        id: "answer-short",
        label: "Short Answers",
        description: "Brief, concise responses",
        icon: "⚡",
        category: "answer",
        keywords: ["answer", "short", "brief", "quick"],
        action: () => {
          sessionStore.setAnswerType("short")
          onClose()
        },
      },
      {
        id: "answer-detailed",
        label: "Detailed Answers",
        description: "Comprehensive explanations",
        icon: "📚",
        category: "answer",
        keywords: ["answer", "detailed", "comprehensive", "long"],
        action: () => {
          sessionStore.setAnswerType("detailed")
          onClose()
        },
      },
      {
        id: "answer-step",
        label: "Step-by-Step",
        description: "Sequential instructions",
        icon: "🪜",
        category: "answer",
        keywords: ["answer", "step", "sequential", "guide"],
        action: () => {
          sessionStore.setAnswerType("step-by-step")
          onClose()
        },
      },
      {
        id: "answer-code",
        label: "Code Only",
        description: "Just code, minimal explanation",
        icon: "💻",
        category: "answer",
        keywords: ["answer", "code", "programming"],
        action: () => {
          sessionStore.setAnswerType("code-only")
          onClose()
        },
      },

      // Profile Commands
      {
        id: "profile-speed",
        label: "Speed Profile",
        description: "Fastest responses",
        icon: "⚡",
        category: "profile",
        keywords: ["profile", "speed", "fast", "quick"],
        action: () => {
          settingsStore.setActiveProfile("speed")
          onClose()
        },
      },
      {
        id: "profile-balanced",
        label: "Balanced Profile",
        description: "Good balance of speed and quality",
        icon: "⚖️",
        category: "profile",
        keywords: ["profile", "balanced", "default"],
        action: () => {
          settingsStore.setActiveProfile("balanced")
          onClose()
        },
      },
      {
        id: "profile-quality",
        label: "Quality Profile",
        description: "Best possible answers",
        icon: "💎",
        category: "profile",
        keywords: ["profile", "quality", "best", "premium"],
        action: () => {
          settingsStore.setActiveProfile("quality")
          onClose()
        },
      },

      // View Commands
      {
        id: "toggle-theme",
        label: "Toggle Theme",
        description: "Switch between light and dark",
        icon: "🌓",
        category: "view",
        keywords: ["theme", "dark", "light", "toggle"],
        action: () => {
          appStore.setTheme(appStore.theme === "dark" ? "light" : "dark")
          onClose()
        },
      },
      {
        id: "toggle-compact",
        label: "Toggle Compact Mode",
        description: "Switch UI density",
        icon: "📐",
        category: "view",
        keywords: ["compact", "dense", "ui"],
        action: () => {
          appStore.setCompactMode(!appStore.compactMode)
          onClose()
        },
      },
      {
        id: "toggle-overlay",
        label: "Toggle Overlay",
        description: "Show/hide overlay window",
        icon: "👁️",
        category: "view",
        keywords: ["overlay", "window", "toggle"],
        shortcut: "⌘⇧Space",
        action: () => {
          appStore.setOverlayVisible(!appStore.overlayVisible)
          onClose()
        },
      },

      // Action Commands
      {
        id: "take-screenshot",
        label: "Take Screenshot",
        description: "Capture current screen",
        icon: "📸",
        category: "action",
        keywords: ["screenshot", "capture", "screen"],
        shortcut: "⌘H",
        action: () => {
          // TODO: Call IPC
          console.log("Take screenshot")
          onClose()
        },
      },
      {
        id: "settings",
        label: "Open Settings",
        description: "Configure Horalix Halo",
        icon: "⚙️",
        category: "action",
        keywords: ["settings", "preferences", "config"],
        shortcut: "⌘,",
        action: () => {
          // TODO: Open settings
          console.log("Open settings")
          onClose()
        },
      },
    ],
    [sessionStore, appStore, settingsStore, onClose]
  )

  // Fuzzy search
  const filteredCommands = useMemo(() => {
    if (!search.trim()) return commands

    const searchLower = search.toLowerCase().trim()
    return commands
      .filter((cmd) => {
        const labelMatch = cmd.label.toLowerCase().includes(searchLower)
        const descMatch = cmd.description.toLowerCase().includes(searchLower)
        const keywordMatch = cmd.keywords.some((kw) =>
          kw.toLowerCase().includes(searchLower)
        )
        return labelMatch || descMatch || keywordMatch
      })
      .sort((a, b) => {
        // Prioritize label matches
        const aLabelMatch = a.label.toLowerCase().startsWith(searchLower)
        const bLabelMatch = b.label.toLowerCase().startsWith(searchLower)
        if (aLabelMatch && !bLabelMatch) return -1
        if (!aLabelMatch && bLabelMatch) return 1
        return 0
      })
  }, [commands, search])

  // Group commands by category
  const groupedCommands = useMemo(() => {
    const groups: Record<string, Command[]> = {}
    filteredCommands.forEach((cmd) => {
      if (!groups[cmd.category]) groups[cmd.category] = []
      groups[cmd.category].push(cmd)
    })
    return groups
  }, [filteredCommands])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault()
          setSelectedIndex((i) =>
            i < filteredCommands.length - 1 ? i + 1 : 0
          )
          break
        case "ArrowUp":
          e.preventDefault()
          setSelectedIndex((i) =>
            i > 0 ? i - 1 : filteredCommands.length - 1
          )
          break
        case "Enter":
          e.preventDefault()
          if (filteredCommands[selectedIndex]) {
            filteredCommands[selectedIndex].action()
          }
          break
        case "Escape":
          e.preventDefault()
          onClose()
          break
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, filteredCommands, selectedIndex, onClose])

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus()
      setSearch("")
      setSelectedIndex(0)
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
        onClick={onClose}
      />

      {/* Command Palette */}
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] pointer-events-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -20 }}
          className="w-full max-w-2xl pointer-events-auto"
        >
          <GlassCard className="overflow-hidden" padding="none">
            {/* Search Input */}
            <div className="p-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🔍</span>
                <input
                  ref={inputRef}
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value)
                    setSelectedIndex(0)
                  }}
                  placeholder="Search commands..."
                  className={cn(
                    "flex-1 bg-transparent border-none outline-none",
                    "text-white placeholder:text-slate-500",
                    "text-lg"
                  )}
                />
                <kbd className="px-2 py-1 text-xs rounded bg-white/10 text-slate-400">
                  ESC
                </kbd>
              </div>
            </div>

            {/* Commands List */}
            <div className="max-h-[60vh] overflow-y-auto">
              {Object.keys(groupedCommands).length === 0 ? (
                <div className="p-8 text-center text-slate-400">
                  <div className="text-4xl mb-2">🤷</div>
                  <div className="text-sm">No commands found</div>
                </div>
              ) : (
                Object.entries(groupedCommands).map(([category, cmds]) => (
                  <div key={category}>
                    <div className="px-4 py-2 text-xs font-medium text-slate-500 uppercase tracking-wide">
                      {category}
                    </div>
                    {cmds.map((cmd, index) => {
                      const globalIndex = filteredCommands.indexOf(cmd)
                      const isSelected = globalIndex === selectedIndex

                      return (
                        <button
                          key={cmd.id}
                          onClick={cmd.action}
                          onMouseEnter={() => setSelectedIndex(globalIndex)}
                          className={cn(
                            "w-full flex items-center gap-3 px-4 py-3",
                            "text-left transition-all",
                            isSelected
                              ? "bg-halo-purple-500/20"
                              : "hover:bg-white/5"
                          )}
                        >
                          <span className="text-2xl flex-shrink-0">
                            {cmd.icon}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-white">
                              {cmd.label}
                            </div>
                            <div className="text-xs text-slate-400 truncate">
                              {cmd.description}
                            </div>
                          </div>
                          {cmd.shortcut && (
                            <kbd className="px-2 py-1 text-xs rounded bg-white/10 text-slate-400 flex-shrink-0">
                              {cmd.shortcut}
                            </kbd>
                          )}
                        </button>
                      )
                    })}
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-white/10 flex items-center justify-between text-xs text-slate-500">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-white/10">↑</kbd>
                  <kbd className="px-1.5 py-0.5 rounded bg-white/10">↓</kbd>
                  navigate
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-white/10">⏎</kbd>
                  select
                </span>
              </div>
              <div>{filteredCommands.length} commands</div>
            </div>
          </GlassCard>
        </motion.div>
      </div>
    </>
  )
}
