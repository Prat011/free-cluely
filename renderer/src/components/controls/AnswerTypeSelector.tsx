/**
 * Horalix Halo - AnswerTypeSelector Component
 *
 * Allows users to select answer type for precise response control.
 * 9 answer types with descriptions and icons.
 */

import React, { useState } from "react"
import { useSessionStore } from "../../store"
import { GlassCard, GlassButton, GlassPill } from "../glass"
import { cn } from "../../lib/utils"
import { motion, AnimatePresence } from "framer-motion"
import type { AnswerType } from "../../../../src/main/state/StateTypes"

export interface AnswerTypeOption {
  id: AnswerType
  label: string
  icon: string
  description: string
  color: "purple" | "indigo" | "teal" | "slate"
}

const ANSWER_TYPES: AnswerTypeOption[] = [
  {
    id: "auto",
    label: "Auto",
    icon: "🤖",
    description: "Let AI decide the best format",
    color: "slate",
  },
  {
    id: "short",
    label: "Short",
    icon: "⚡",
    description: "Brief, concise answers",
    color: "teal",
  },
  {
    id: "detailed",
    label: "Detailed",
    icon: "📚",
    description: "Comprehensive explanations",
    color: "indigo",
  },
  {
    id: "step-by-step",
    label: "Step-by-Step",
    icon: "🪜",
    description: "Numbered, sequential steps",
    color: "purple",
  },
  {
    id: "code-only",
    label: "Code Only",
    icon: "💻",
    description: "Just code, minimal talk",
    color: "teal",
  },
  {
    id: "eli5",
    label: "ELI5",
    icon: "👶",
    description: "Explain like I'm 5",
    color: "indigo",
  },
  {
    id: "concise",
    label: "Concise",
    icon: "🎯",
    description: "Essential info only",
    color: "teal",
  },
  {
    id: "conversational",
    label: "Conversational",
    icon: "💬",
    description: "Friendly, casual tone",
    color: "indigo",
  },
  {
    id: "academic",
    label: "Academic",
    icon: "🎓",
    description: "Formal, scholarly style",
    color: "purple",
  },
]

export interface AnswerTypeSelectorProps {
  compact?: boolean
  inline?: boolean
  className?: string
  onChange?: (type: AnswerType) => void
}

export const AnswerTypeSelector: React.FC<AnswerTypeSelectorProps> = ({
  compact = false,
  inline = false,
  className,
  onChange,
}) => {
  const { currentAnswerType, setAnswerType } = useSessionStore()
  const [isExpanded, setIsExpanded] = useState(false)

  const handleSelect = (type: AnswerType) => {
    setAnswerType(type)
    onChange?.(type)
    if (compact) {
      setIsExpanded(false)
    }
  }

  const currentOption =
    ANSWER_TYPES.find((opt) => opt.id === currentAnswerType) || ANSWER_TYPES[0]

  // Compact dropdown version
  if (compact) {
    return (
      <div className={cn("relative", className)}>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-lg",
            "bg-white/5 backdrop-blur-sm border border-white/10",
            "hover:bg-white/10 transition-all",
            "text-sm text-white"
          )}
        >
          <span>{currentOption.icon}</span>
          <span>{currentOption.label}</span>
          <svg
            className={cn(
              "w-4 h-4 transition-transform",
              isExpanded && "rotate-180"
            )}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={cn(
                "absolute top-full left-0 mt-2 z-50",
                "w-64 max-h-96 overflow-y-auto"
              )}
            >
              <GlassCard padding="sm">
                <div className="space-y-1">
                  {ANSWER_TYPES.map((option) => (
                    <button
                      key={option.id}
                      onClick={() => handleSelect(option.id)}
                      className={cn(
                        "w-full flex items-center gap-3 p-2 rounded-lg",
                        "text-left transition-all",
                        "hover:bg-white/10",
                        currentAnswerType === option.id
                          ? "bg-halo-purple-500/20 ring-1 ring-halo-purple-500"
                          : ""
                      )}
                    >
                      <span className="text-xl">{option.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-white">
                          {option.label}
                        </div>
                        <div className="text-xs text-slate-400 truncate">
                          {option.description}
                        </div>
                      </div>
                      {currentAnswerType === option.id && (
                        <svg
                          className="w-4 h-4 text-halo-purple-400 flex-shrink-0"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              </GlassCard>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Backdrop */}
        {isExpanded && (
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsExpanded(false)}
          />
        )}
      </div>
    )
  }

  // Inline chip version
  if (inline) {
    return (
      <div className={cn("flex items-center gap-2 flex-wrap", className)}>
        {ANSWER_TYPES.map((option) => (
          <button
            key={option.id}
            onClick={() => handleSelect(option.id)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium",
              "transition-all hover:scale-105",
              "flex items-center gap-1.5",
              currentAnswerType === option.id
                ? "bg-halo-gradient text-white shadow-glow"
                : "bg-white/5 text-slate-300 hover:bg-white/10"
            )}
          >
            <span>{option.icon}</span>
            <span>{option.label}</span>
          </button>
        ))}
      </div>
    )
  }

  // Full card grid version
  return (
    <GlassCard className={cn("p-4", className)} variant="default">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-white mb-1">Answer Type</h3>
        <p className="text-xs text-slate-400">
          Control how the AI formats its responses
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {ANSWER_TYPES.map((option, index) => (
          <motion.button
            key={option.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.03 }}
            onClick={() => handleSelect(option.id)}
            className={cn(
              "p-3 rounded-lg border transition-all",
              "hover:scale-105 active:scale-95",
              "text-left",
              currentAnswerType === option.id
                ? "bg-halo-gradient-subtle border-halo-purple-500 shadow-glow"
                : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20"
            )}
          >
            <div className="text-2xl mb-1">{option.icon}</div>
            <div className="text-xs font-medium text-white mb-0.5">
              {option.label}
            </div>
            <div className="text-[10px] text-slate-400 line-clamp-2">
              {option.description}
            </div>

            {/* Selected Indicator */}
            {currentAnswerType === option.id && (
              <div className="mt-2">
                <div className="w-full h-1 rounded-full bg-halo-gradient" />
              </div>
            )}
          </motion.button>
        ))}
      </div>

      {/* Current Selection Info */}
      <div className="mt-3 pt-3 border-t border-white/10">
        <div className="flex items-center gap-2">
          <GlassPill size="sm" variant="primary">
            Current
          </GlassPill>
          <span className="text-sm text-white">
            {currentOption.icon} {currentOption.label}
          </span>
          <span className="text-xs text-slate-400 ml-auto">
            {currentOption.description}
          </span>
        </div>
      </div>
    </GlassCard>
  )
}

// ============================================================================
// MINI VERSION (for header/toolbar)
// ============================================================================

export const MiniAnswerTypeSelector: React.FC<{
  className?: string
}> = ({ className }) => {
  const { currentAnswerType } = useSessionStore()
  const currentOption =
    ANSWER_TYPES.find((opt) => opt.id === currentAnswerType) || ANSWER_TYPES[0]

  return (
    <AnswerTypeSelector
      compact
      className={cn("min-w-[140px]", className)}
    />
  )
}
