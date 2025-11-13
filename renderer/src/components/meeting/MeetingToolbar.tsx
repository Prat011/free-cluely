/**
 * Horalix Halo - MeetingToolbar Component
 *
 * Quick action buttons for meeting assistance.
 * 9 specialized meeting actions with instant prompts.
 */

import React from "react"
import { useSessionStore } from "../../store"
import { GlassCard, GlassButton, GlassPill } from "../glass"
import { cn } from "../../lib/utils"
import { motion, AnimatePresence } from "framer-motion"

export interface MeetingAction {
  id: string
  label: string
  icon: string
  description: string
  shortcut?: string
  variant?: "primary" | "secondary" | "ghost" | "danger"
}

const MEETING_ACTIONS: MeetingAction[] = [
  {
    id: "quick-summary",
    label: "Quick Summary",
    icon: "📝",
    description: "Summarize the discussion so far",
    shortcut: "⌘1",
    variant: "primary",
  },
  {
    id: "action-items",
    label: "Action Items",
    icon: "✅",
    description: "Extract todos and action items",
    shortcut: "⌘2",
    variant: "secondary",
  },
  {
    id: "key-decisions",
    label: "Key Decisions",
    icon: "🎯",
    description: "Highlight important decisions made",
    shortcut: "⌘3",
    variant: "secondary",
  },
  {
    id: "follow-ups",
    label: "Follow-ups",
    icon: "🔔",
    description: "Suggest follow-up questions",
    shortcut: "⌘4",
    variant: "secondary",
  },
  {
    id: "explain-technical",
    label: "Explain Technical",
    icon: "🔬",
    description: "Explain technical concepts discussed",
    shortcut: "⌘5",
    variant: "ghost",
  },
  {
    id: "clarify-point",
    label: "Clarify Point",
    icon: "💡",
    description: "Ask clarifying questions",
    shortcut: "⌘6",
    variant: "ghost",
  },
  {
    id: "counter-argument",
    label: "Counter-Argument",
    icon: "⚖️",
    description: "Present alternative viewpoints",
    shortcut: "⌘7",
    variant: "ghost",
  },
  {
    id: "generate-response",
    label: "Generate Response",
    icon: "💬",
    description: "Draft a response to a point",
    shortcut: "⌘8",
    variant: "ghost",
  },
  {
    id: "email-draft",
    label: "Email Draft",
    icon: "📧",
    description: "Create follow-up email",
    shortcut: "⌘9",
    variant: "ghost",
  },
]

export interface MeetingToolbarProps {
  compact?: boolean
  className?: string
}

export const MeetingToolbar: React.FC<MeetingToolbarProps> = ({
  compact = false,
  className,
}) => {
  const { currentMode, isProcessing, addMessage, setProcessing } =
    useSessionStore()
  const [lastUsedAction, setLastUsedAction] = React.useState<string | null>(
    null
  )

  const handleAction = async (action: MeetingAction) => {
    if (isProcessing) return

    setLastUsedAction(action.id)

    // Build the meeting action prompt
    const prompt = buildMeetingActionPrompt(action.id)

    // Add as user message (hidden from UI)
    addMessage({
      sessionId: "",
      role: "user",
      content: prompt,
      metadata: {
        meetingAction: action.id,
        hidden: true, // Don't show in chat UI
      },
    })

    setProcessing(true)

    // TODO: Call LLM Engine via IPC
    // For now, simulate
    setTimeout(() => {
      addMessage({
        sessionId: "",
        role: "assistant",
        content: `This is a simulated ${action.label} response. LLM integration coming next!`,
        metadata: {
          meetingAction: action.id,
        },
      })
      setProcessing(false)
      setLastUsedAction(null)
    }, 1500)
  }

  // Only show toolbar in meeting mode
  if (currentMode !== "meeting") {
    return null
  }

  if (compact) {
    return (
      <GlassCard
        className={cn("p-2", className)}
        variant="subtle"
        blur="sm"
      >
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
          {MEETING_ACTIONS.map((action) => (
            <button
              key={action.id}
              onClick={() => handleAction(action)}
              disabled={isProcessing}
              className={cn(
                "flex-shrink-0 w-10 h-10 rounded-lg",
                "flex items-center justify-center",
                "text-xl transition-all",
                "hover:bg-white/10 hover:scale-110",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                lastUsedAction === action.id &&
                  "bg-halo-purple-500/20 ring-2 ring-halo-purple-500"
              )}
              title={`${action.label} (${action.shortcut})`}
            >
              {action.icon}
            </button>
          ))}
        </div>
      </GlassCard>
    )
  }

  return (
    <GlassCard className={cn("p-4", className)} variant="default">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <span className="text-lg">🎙️</span>
          Meeting Actions
        </h3>
        <GlassPill size="sm" variant="info">
          {currentMode}
        </GlassPill>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {MEETING_ACTIONS.map((action, index) => (
          <motion.div
            key={action.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <GlassButton
              variant={action.variant || "ghost"}
              size="sm"
              glow={action.variant === "primary"}
              onClick={() => handleAction(action)}
              disabled={isProcessing}
              loading={lastUsedAction === action.id && isProcessing}
              className={cn(
                "w-full justify-start text-left h-auto py-2 px-3",
                lastUsedAction === action.id && "ring-2 ring-halo-purple-500"
              )}
            >
              <div className="flex items-center gap-2 w-full">
                <span className="text-lg flex-shrink-0">{action.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">
                    {action.label}
                  </div>
                  {action.shortcut && (
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      {action.shortcut}
                    </div>
                  )}
                </div>
              </div>
            </GlassButton>
          </motion.div>
        ))}
      </div>

      {/* Hint Text */}
      <div className="mt-3 pt-3 border-t border-white/10">
        <p className="text-xs text-slate-400 text-center">
          Quick actions work with the current meeting transcript
        </p>
      </div>
    </GlassCard>
  )
}

// ============================================================================
// MEETING ACTION PROMPT BUILDER
// ============================================================================

function buildMeetingActionPrompt(actionId: string): string {
  // TODO: Integrate with transcript segments from store
  // For now, return basic prompts

  const prompts: Record<string, string> = {
    "quick-summary":
      "Please provide a concise summary of the meeting discussion so far. Focus on main topics and key points.",
    "action-items":
      "Extract all action items, todos, and tasks mentioned in the meeting. Format as a checklist with owners if mentioned.",
    "key-decisions":
      "Highlight the key decisions that have been made in this meeting. Include who made the decision if clear.",
    "follow-ups":
      "Suggest relevant follow-up questions or topics that should be discussed based on the current conversation.",
    "explain-technical":
      "Explain any technical concepts or jargon that were discussed in the meeting in simpler terms.",
    "clarify-point":
      "Generate clarifying questions about points that may need more detail or explanation.",
    "counter-argument":
      "Present alternative viewpoints or counter-arguments to the main points discussed.",
    "generate-response":
      "Help me draft a response to a point that was made in the meeting. Be diplomatic and constructive.",
    "email-draft":
      "Draft a follow-up email summarizing the meeting, action items, and next steps.",
  }

  return prompts[actionId] || "Please analyze the meeting transcript."
}

// ============================================================================
// COMPACT VERSION (for toolbar integration)
// ============================================================================

export interface CompactMeetingActionsProps {
  onActionClick?: (actionId: string) => void
  className?: string
}

export const CompactMeetingActions: React.FC<CompactMeetingActionsProps> = ({
  onActionClick,
  className,
}) => {
  return (
    <div className={cn("flex items-center gap-1", className)}>
      {MEETING_ACTIONS.slice(0, 5).map((action) => (
        <button
          key={action.id}
          onClick={() => onActionClick?.(action.id)}
          className={cn(
            "w-8 h-8 rounded-md",
            "flex items-center justify-center",
            "text-lg transition-all",
            "hover:bg-white/10 hover:scale-110",
            "active:scale-95"
          )}
          title={action.label}
        >
          {action.icon}
        </button>
      ))}
    </div>
  )
}
