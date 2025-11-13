/**
 * Horalix Halo - ContextPanel Component
 *
 * Displays and manages context items with tabs.
 * Screenshots, transcripts, notes, clipboard history.
 */

import React, { useState } from "react"
import { useSessionStore } from "../../store"
import { GlassCard, GlassButton, GlassPill } from "../glass"
import { cn, formatRelativeTime } from "../../lib/utils"
import { motion, AnimatePresence } from "framer-motion"

type ContextTab = "screenshots" | "transcript" | "notes" | "clipboard"

export const ContextPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ContextTab>("screenshots")

  const {
    contextItems,
    selectedContextIds,
    transcriptSegments,
    toggleContextSelection,
    removeContextItem,
    pinContextItem,
  } = useSessionStore()

  // Filter context items by type
  const screenshots = contextItems.filter((item) => item.type === "screenshot")
  const notes = contextItems.filter((item) => item.type === "note")
  const clipboardItems = contextItems.filter(
    (item) => item.type === "clipboard"
  )

  const tabs: { id: ContextTab; label: string; count: number }[] = [
    { id: "screenshots", label: "Screens", count: screenshots.length },
    { id: "transcript", label: "Transcript", count: transcriptSegments.length },
    { id: "notes", label: "Notes", count: notes.length },
    { id: "clipboard", label: "Clipboard", count: clipboardItems.length },
  ]

  return (
    <GlassCard className="flex flex-col h-full" padding="none">
      {/* Header with Tabs */}
      <div className="border-b border-white/10">
        <div className="flex items-center justify-between p-4">
          <h2 className="text-lg font-semibold text-white">Context</h2>
          {selectedContextIds.length > 0 && (
            <GlassPill size="sm" variant="primary">
              {selectedContextIds.length} selected
            </GlassPill>
          )}
        </div>

        <div className="flex gap-1 px-4 pb-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-all",
                "hover:bg-white/10",
                activeTab === tab.id
                  ? "bg-white/10 text-white"
                  : "text-slate-400"
              )}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className="ml-2 text-xs opacity-60">({tab.count})</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <AnimatePresence mode="wait">
          {activeTab === "screenshots" && (
            <ScreenshotsTab
              screenshots={screenshots as any}
              selectedIds={selectedContextIds}
              onToggleSelect={toggleContextSelection}
              onRemove={removeContextItem}
              onPin={pinContextItem}
            />
          )}

          {activeTab === "transcript" && (
            <TranscriptTab segments={transcriptSegments} />
          )}

          {activeTab === "notes" && (
            <NotesTab
              notes={notes as any}
              selectedIds={selectedContextIds}
              onToggleSelect={toggleContextSelection}
              onRemove={removeContextItem}
            />
          )}

          {activeTab === "clipboard" && (
            <ClipboardTab
              items={clipboardItems as any}
              selectedIds={selectedContextIds}
              onToggleSelect={toggleContextSelection}
              onRemove={removeContextItem}
            />
          )}
        </AnimatePresence>
      </div>
    </GlassCard>
  )
}

// ============================================================================
// SCREENSHOTS TAB
// ============================================================================

interface ScreenshotsTabProps {
  screenshots: any[]
  selectedIds: string[]
  onToggleSelect: (id: string) => void
  onRemove: (id: string) => void
  onPin: (id: string) => void
}

const ScreenshotsTab: React.FC<ScreenshotsTabProps> = ({
  screenshots,
  selectedIds,
  onToggleSelect,
  onRemove,
  onPin,
}) => {
  if (screenshots.length === 0) {
    return (
      <EmptyState
        icon="📸"
        title="No screenshots yet"
        description="Press ⌘H to capture your screen"
      />
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="grid grid-cols-2 gap-3"
    >
      {screenshots.map((screenshot) => (
        <GlassCard
          key={screenshot.id}
          variant={selectedIds.includes(screenshot.id) ? "glow" : "default"}
          padding="sm"
          hover
          className="cursor-pointer relative group"
          onClick={() => onToggleSelect(screenshot.id)}
        >
          {/* Thumbnail */}
          <div className="aspect-video bg-slate-800 rounded-lg mb-2 overflow-hidden">
            <div className="w-full h-full flex items-center justify-center text-slate-600">
              📸
            </div>
          </div>

          {/* Info */}
          <div className="text-xs text-slate-400">
            <div className="truncate">
              {screenshot.sourceApp || "Unknown"}
            </div>
            <div>{formatRelativeTime(screenshot.createdAt)}</div>
          </div>

          {/* Actions */}
          <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => {
                e.stopPropagation()
                onPin(screenshot.id)
              }}
              className="w-6 h-6 rounded-md bg-slate-900/80 backdrop-blur-sm flex items-center justify-center hover:bg-slate-800"
            >
              📌
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onRemove(screenshot.id)
              }}
              className="w-6 h-6 rounded-md bg-slate-900/80 backdrop-blur-sm flex items-center justify-center hover:bg-red-500/20"
            >
              🗑️
            </button>
          </div>

          {/* Pinned Indicator */}
          {screenshot.pinned && (
            <div className="absolute top-2 left-2">
              <GlassPill size="sm" variant="warning">
                Pinned
              </GlassPill>
            </div>
          )}

          {/* Selected Indicator */}
          {selectedIds.includes(screenshot.id) && (
            <div className="absolute inset-0 rounded-lg border-2 border-halo-purple-500 pointer-events-none" />
          )}
        </GlassCard>
      ))}
    </motion.div>
  )
}

// ============================================================================
// TRANSCRIPT TAB
// ============================================================================

interface TranscriptTabProps {
  segments: any[]
}

const TranscriptTab: React.FC<TranscriptTabProps> = ({ segments }) => {
  if (segments.length === 0) {
    return (
      <EmptyState
        icon="🎤"
        title="No transcript yet"
        description="Start a meeting to see real-time transcription"
      />
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-3"
    >
      {segments.map((segment) => (
        <GlassCard key={segment.id} variant="subtle" padding="md">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                {segment.speaker && (
                  <GlassPill size="sm" variant="info">
                    {segment.speaker}
                  </GlassPill>
                )}
                <span className="text-xs text-slate-500">
                  {formatRelativeTime(segment.startTime)}
                </span>
              </div>
              <p className="text-sm text-white">{segment.text}</p>
            </div>
            {segment.confidence && (
              <div className="text-xs text-slate-500">
                {Math.round(segment.confidence * 100)}%
              </div>
            )}
          </div>
        </GlassCard>
      ))}
    </motion.div>
  )
}

// ============================================================================
// NOTES TAB
// ============================================================================

interface NotesTabProps {
  notes: any[]
  selectedIds: string[]
  onToggleSelect: (id: string) => void
  onRemove: (id: string) => void
}

const NotesTab: React.FC<NotesTabProps> = ({
  notes,
  selectedIds,
  onToggleSelect,
  onRemove,
}) => {
  if (notes.length === 0) {
    return (
      <EmptyState
        icon="📝"
        title="No notes yet"
        description="Add notes to remember important points"
      />
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-3"
    >
      {notes.map((note) => (
        <GlassCard
          key={note.id}
          variant={selectedIds.includes(note.id) ? "glow" : "default"}
          padding="md"
          hover
          className="cursor-pointer group"
          onClick={() => onToggleSelect(note.id)}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              {note.title && (
                <h4 className="text-sm font-medium text-white mb-1">
                  {note.title}
                </h4>
              )}
              <p className="text-sm text-slate-300 line-clamp-3">
                {note.text}
              </p>
              <div className="mt-2 text-xs text-slate-500">
                {formatRelativeTime(note.createdAt)}
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onRemove(note.id)
              }}
              className="opacity-0 group-hover:opacity-100 transition-opacity"
            >
              🗑️
            </button>
          </div>
        </GlassCard>
      ))}
    </motion.div>
  )
}

// ============================================================================
// CLIPBOARD TAB
// ============================================================================

interface ClipboardTabProps {
  items: any[]
  selectedIds: string[]
  onToggleSelect: (id: string) => void
  onRemove: (id: string) => void
}

const ClipboardTab: React.FC<ClipboardTabProps> = ({
  items,
  selectedIds,
  onToggleSelect,
  onRemove,
}) => {
  if (items.length === 0) {
    return (
      <EmptyState
        icon="📋"
        title="No clipboard history"
        description="Copied text will appear here automatically"
      />
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-3"
    >
      {items.map((item) => (
        <GlassCard
          key={item.id}
          variant={selectedIds.includes(item.id) ? "glow" : "default"}
          padding="md"
          hover
          className="cursor-pointer group"
          onClick={() => onToggleSelect(item.id)}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <p className="text-sm text-white line-clamp-3 font-mono">
                {item.text}
              </p>
              <div className="mt-2 text-xs text-slate-500">
                {formatRelativeTime(item.createdAt)}
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onRemove(item.id)
              }}
              className="opacity-0 group-hover:opacity-100 transition-opacity"
            >
              🗑️
            </button>
          </div>
        </GlassCard>
      ))}
    </motion.div>
  )
}

// ============================================================================
// EMPTY STATE
// ============================================================================

interface EmptyStateProps {
  icon: string
  title: string
  description: string
}

const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center h-64 text-center"
    >
      <div className="text-6xl mb-4">{icon}</div>
      <h3 className="text-lg font-medium text-white mb-2">{title}</h3>
      <p className="text-sm text-slate-400 max-w-xs">{description}</p>
    </motion.div>
  )
}
