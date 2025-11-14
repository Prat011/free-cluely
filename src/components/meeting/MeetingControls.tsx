/**
 * Horalix Halo - Meeting Controls
 *
 * In-meeting assistance buttons with real-time AI help.
 * Provides instant suggestions, fact-checking, and recaps during calls.
 */

import React, { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useSubscription, useFeature } from "../../contexts/SubscriptionContext"
import { FactCheckGate } from "../subscription/FeatureGate"

// ============================================================================
// TYPES
// ============================================================================

interface MeetingControlsProps {
  meetingId: string
  transcript?: string
  onSuggestion?: (suggestion: string) => void
  onRecap?: (recap: string) => void
}

type ActionType = "suggest" | "followup" | "factcheck" | "recap"

interface ActionButton {
  type: ActionType
  label: string
  icon: React.ReactNode
  gradient: string
  requiresFeature?: keyof import("../../../shared/plans").PlanConfig["features"]
}

// ============================================================================
// ACTION BUTTONS CONFIG
// ============================================================================

const ACTION_BUTTONS: ActionButton[] = [
  {
    type: "suggest",
    label: "What should I say?",
    gradient: "from-purple-500 to-pink-500",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
  },
  {
    type: "followup",
    label: "Follow-up question",
    gradient: "from-blue-500 to-cyan-500",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    type: "factcheck",
    label: "Fact check",
    gradient: "from-green-500 to-emerald-500",
    requiresFeature: "factCheckButton",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    type: "recap",
    label: "Recap now",
    gradient: "from-orange-500 to-red-500",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
  },
]

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const MeetingControls: React.FC<MeetingControlsProps> = ({
  meetingId,
  transcript = "",
  onSuggestion,
  onRecap,
}) => {
  const { canUseFeature } = useSubscription()
  const [activeAction, setActiveAction] = useState<ActionType | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  // ============================================================================
  // ACTION HANDLERS
  // ============================================================================

  const handleAction = async (type: ActionType) => {
    setActiveAction(type)
    setIsProcessing(true)
    setResult(null)

    try {
      const prompt = getPromptForAction(type, transcript)

      // Call LLM engine via IPC
      const response = await window.electronAPI?.invoke("llm:generate", {
        modelId: "deepseek-chat", // Use fast model for in-meeting assistance
        messages: [
          {
            role: "system",
            content: "You are Horalix Halo, an AI meeting assistant. Be concise, actionable, and helpful.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        maxTokens: 300,
        temperature: 0.7,
      })

      const aiResult = response.content || "No suggestion available."
      setResult(aiResult)

      // Call callbacks
      if (type === "suggest" && onSuggestion) {
        onSuggestion(aiResult)
      } else if (type === "recap" && onRecap) {
        onRecap(aiResult)
      }
    } catch (error) {
      console.error(`[MeetingControls] ${type} error:`, error)
      setResult("Sorry, I couldn't process that request. Please try again.")
    } finally {
      setIsProcessing(false)
    }
  }

  const getPromptForAction = (type: ActionType, transcript: string): string => {
    const recentTranscript = transcript.slice(-1000) // Last 1000 chars

    switch (type) {
      case "suggest":
        return `Based on this meeting transcript, suggest what I should say next to move the conversation forward productively:\n\n${recentTranscript}\n\nProvide 2-3 specific suggestions, each 1-2 sentences max.`

      case "followup":
        return `Based on this meeting transcript, suggest insightful follow-up questions I could ask:\n\n${recentTranscript}\n\nProvide 3 specific questions that would deepen the discussion.`

      case "factcheck":
        return `Review this meeting transcript and identify any claims that should be fact-checked:\n\n${recentTranscript}\n\nList any factual claims made and note if they seem accurate or need verification.`

      case "recap":
        return `Provide a quick recap of this meeting so far:\n\n${recentTranscript}\n\nInclude: Key points discussed, decisions made, action items. Keep it under 5 bullet points.`

      default:
        return recentTranscript
    }
  }

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="p-6 bg-gradient-to-br from-[#0f0f23] via-[#1a1a2e] to-[#0f0f23]">
      {/* Action Buttons */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {ACTION_BUTTONS.map((button) => {
          const isLocked = button.requiresFeature && !canUseFeature(button.requiresFeature)
          const isActive = activeAction === button.type

          return (
            <motion.button
              key={button.type}
              onClick={() => !isLocked && handleAction(button.type)}
              disabled={isProcessing || isLocked}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`relative p-4 rounded-xl bg-white/5 backdrop-blur-sm border transition-all ${
                isActive
                  ? "border-white/40 shadow-lg"
                  : isLocked
                  ? "border-white/5 opacity-50 cursor-not-allowed"
                  : "border-white/10 hover:border-white/20"
              }`}
            >
              {/* Gradient Background */}
              <div
                className={`absolute inset-0 rounded-xl bg-gradient-to-r ${button.gradient} opacity-0 group-hover:opacity-10 transition-opacity`}
              />

              {/* Content */}
              <div className="relative flex flex-col items-center gap-2">
                <div className={`p-2 rounded-lg bg-gradient-to-r ${button.gradient}`}>
                  {button.icon}
                </div>
                <span className="text-sm font-medium text-white text-center">
                  {button.label}
                </span>

                {/* Lock Icon */}
                {isLocked && (
                  <div className="absolute top-0 right-0">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                )}
              </div>
            </motion.button>
          )
        })}
      </div>

      {/* Result Panel */}
      <AnimatePresence>
        {(isProcessing || result) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="p-6 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl"
          >
            {isProcessing ? (
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-gray-400">Thinking...</span>
              </div>
            ) : result ? (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-white">
                    {ACTION_BUTTONS.find((b) => b.type === activeAction)?.label}
                  </h4>
                  <button
                    onClick={() => {
                      setActiveAction(null)
                      setResult(null)
                    }}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="prose prose-invert prose-sm max-w-none">
                  <div className="text-gray-300 whitespace-pre-wrap">{result}</div>
                </div>
              </div>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Transcript Preview */}
      {transcript && (
        <div className="mt-6">
          <h4 className="text-sm font-semibold text-gray-400 uppercase mb-2">
            Live Transcript
          </h4>
          <div className="p-4 bg-black/20 border border-white/5 rounded-lg max-h-32 overflow-y-auto">
            <p className="text-sm text-gray-400 leading-relaxed">
              {transcript.slice(-500) || "Waiting for audio..."}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// COMPACT FLOATING CONTROLS (for overlay during meetings)
// ============================================================================

export const FloatingMeetingControls: React.FC<MeetingControlsProps> = ({
  meetingId,
  transcript,
  onSuggestion,
  onRecap,
}) => {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <AnimatePresence>
        {isExpanded ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            className="bg-gradient-to-br from-[#0f0f23] via-[#1a1a2e] to-[#0f0f23] backdrop-blur-lg border border-white/20 rounded-2xl shadow-2xl p-6 max-w-md"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Meeting Assistant</h3>
              <button
                onClick={() => setIsExpanded(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <MeetingControls
              meetingId={meetingId}
              transcript={transcript}
              onSuggestion={onSuggestion}
              onRecap={onRecap}
            />
          </motion.div>
        ) : (
          <motion.button
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0 }}
            onClick={() => setIsExpanded(true)}
            className="w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full shadow-2xl shadow-purple-500/50 flex items-center justify-center hover:scale-110 transition-transform"
          >
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}
