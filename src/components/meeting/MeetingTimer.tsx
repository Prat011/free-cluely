/**
 * Horalix Halo - Meeting Timer
 *
 * Tracks meeting duration and enforces plan-based time limits.
 * Shows warnings as user approaches their limit.
 */

import React, { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useSubscription, useUsageStats } from "../../contexts/SubscriptionContext"

// ============================================================================
// TYPES
// ============================================================================

interface MeetingTimerProps {
  meetingId: string
  startedAt: number
  onTimeLimit?: () => void
  onWarning?: (minutesRemaining: number) => void
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
  }
  return `${minutes}:${String(secs).padStart(2, "0")}`
}

function getWarningLevel(percentUsed: number): "safe" | "warning" | "danger" {
  if (percentUsed >= 95) return "danger"
  if (percentUsed >= 80) return "warning"
  return "safe"
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const MeetingTimer: React.FC<MeetingTimerProps> = ({
  meetingId,
  startedAt,
  onTimeLimit,
  onWarning,
}) => {
  const { planConfig, getRemainingMinutes } = useSubscription()
  const { used: totalMinutesUsed } = useUsageStats()

  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [hasWarned5min, setHasWarned5min] = useState(false)
  const [hasWarned1min, setHasWarned1min] = useState(false)

  const maxMinutes = planConfig.features.maxMinutesPerMeeting
  const maxSeconds = maxMinutes * 60
  const remainingSeconds = maxSeconds - elapsedSeconds
  const percentUsed = (elapsedSeconds / maxSeconds) * 100
  const warningLevel = getWarningLevel(percentUsed)

  // ============================================================================
  // TIMER EFFECT
  // ============================================================================

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now()
      const elapsed = Math.floor((now - startedAt) / 1000)
      setElapsedSeconds(elapsed)

      // Check for warnings
      const remainingMinutes = Math.floor((maxSeconds - elapsed) / 60)

      if (remainingMinutes === 5 && !hasWarned5min) {
        setHasWarned5min(true)
        onWarning?.(5)
      }

      if (remainingMinutes === 1 && !hasWarned1min) {
        setHasWarned1min(true)
        onWarning?.(1)
      }

      // Check for time limit
      if (elapsed >= maxSeconds) {
        clearInterval(interval)
        onTimeLimit?.()
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [startedAt, maxSeconds, hasWarned5min, hasWarned1min, onTimeLimit, onWarning])

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="relative">
      {/* Timer Display */}
      <div className="flex items-center gap-4 p-4 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl">
        {/* Elapsed Time */}
        <div className="flex-1">
          <div className="text-xs text-gray-400 uppercase mb-1">Meeting Duration</div>
          <div
            className={`text-3xl font-mono font-bold ${
              warningLevel === "danger"
                ? "text-red-400"
                : warningLevel === "warning"
                ? "text-yellow-400"
                : "text-white"
            }`}
          >
            {formatDuration(elapsedSeconds)}
          </div>
        </div>

        {/* Remaining Time */}
        <div className="flex-1 text-right">
          <div className="text-xs text-gray-400 uppercase mb-1">Time Remaining</div>
          <div
            className={`text-2xl font-mono font-semibold ${
              warningLevel === "danger"
                ? "text-red-400"
                : warningLevel === "warning"
                ? "text-yellow-400"
                : "text-gray-300"
            }`}
          >
            {formatDuration(Math.max(0, remainingSeconds))}
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mt-3">
        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(percentUsed, 100)}%` }}
            className={`h-full ${
              warningLevel === "danger"
                ? "bg-gradient-to-r from-red-500 to-red-600"
                : warningLevel === "warning"
                ? "bg-gradient-to-r from-yellow-500 to-orange-500"
                : "bg-gradient-to-r from-purple-500 to-pink-500"
            }`}
          />
        </div>
        <div className="mt-1 text-xs text-gray-500 text-right">
          {maxMinutes} min max per meeting ({planConfig.marketing.name})
        </div>
      </div>

      {/* Warning Banner */}
      <AnimatePresence>
        {warningLevel === "warning" && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mt-3 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg"
          >
            <div className="flex items-start gap-2">
              <svg className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <div className="text-sm font-medium text-yellow-400">
                  Approaching Time Limit
                </div>
                <div className="text-xs text-yellow-300/80 mt-1">
                  You have {Math.floor(remainingSeconds / 60)} minutes left in this meeting. The meeting will auto-end when time expires.
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {warningLevel === "danger" && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg"
          >
            <div className="flex items-start gap-2">
              <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <div className="text-sm font-medium text-red-400">
                  Time Limit Reached Soon
                </div>
                <div className="text-xs text-red-300/80 mt-1">
                  Less than {Math.ceil(remainingSeconds / 60)} minute{Math.ceil(remainingSeconds / 60) !== 1 ? "s" : ""} remaining! Upgrade to Ultra for 120 min meetings.
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Monthly Usage Stats */}
      <div className="mt-3 p-3 bg-white/5 border border-white/10 rounded-lg">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-400">Monthly Usage:</span>
          <span className="text-white font-medium">
            {totalMinutesUsed} / {getRemainingMinutes() + totalMinutesUsed} min
          </span>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// COMPACT TIMER (for floating overlay)
// ============================================================================

export const CompactMeetingTimer: React.FC<{ startedAt: number; maxMinutes: number }> = ({
  startedAt,
  maxMinutes,
}) => {
  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  const maxSeconds = maxMinutes * 60
  const remainingSeconds = maxSeconds - elapsedSeconds
  const percentUsed = (elapsedSeconds / maxSeconds) * 100
  const warningLevel = getWarningLevel(percentUsed)

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now()
      const elapsed = Math.floor((now - startedAt) / 1000)
      setElapsedSeconds(elapsed)
    }, 1000)

    return () => clearInterval(interval)
  }, [startedAt])

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-black/40 backdrop-blur-sm border border-white/20 rounded-lg">
      <div
        className={`w-2 h-2 rounded-full ${
          warningLevel === "danger"
            ? "bg-red-500 animate-pulse"
            : warningLevel === "warning"
            ? "bg-yellow-500 animate-pulse"
            : "bg-green-500"
        }`}
      />
      <div className="text-sm font-mono text-white">{formatDuration(elapsedSeconds)}</div>
      <div className="text-xs text-gray-400">/ {maxMinutes}m</div>
    </div>
  )
}
