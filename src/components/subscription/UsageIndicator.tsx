/**
 * Horalix Halo - Usage Indicator
 *
 * Displays subscription plan, usage stats, and upgrade prompts.
 */

import React from "react"
import { useSubscription, useUsageStats, usePlan } from "../../contexts/SubscriptionContext"
import { motion } from "framer-motion"

// ============================================================================
// TYPES
// ============================================================================

interface UsageIndicatorProps {
  variant?: "compact" | "detailed"
  showUpgradeButton?: boolean
}

// ============================================================================
// COMPONENT
// ============================================================================

export const UsageIndicator: React.FC<UsageIndicatorProps> = ({
  variant = "compact",
  showUpgradeButton = true,
}) => {
  const { planId, planConfig, subscriptionStatus } = usePlan()
  const { used, limit, remaining, percentUsed } = useUsageStats()
  const { startCheckout } = useSubscription()

  const handleUpgrade = async () => {
    const targetPlan = planId === "free" ? "plus" : "ultra"
    try {
      await startCheckout(targetPlan, "month")
    } catch (error) {
      console.error("[UsageIndicator] Upgrade error:", error)
    }
  }

  // Color based on usage percentage
  const getUsageColor = () => {
    if (percentUsed >= 90) return "text-red-400"
    if (percentUsed >= 70) return "text-yellow-400"
    return "text-green-400"
  }

  const getProgressColor = () => {
    if (percentUsed >= 90) return "from-red-500 to-red-600"
    if (percentUsed >= 70) return "from-yellow-500 to-yellow-600"
    return "from-purple-500 to-pink-500"
  }

  const getPlanBadgeColor = () => {
    if (planId === "ultra") return "from-yellow-500 to-orange-500"
    if (planId === "plus") return "from-purple-500 to-pink-500"
    return "from-gray-500 to-gray-600"
  }

  // ============================================================================
  // COMPACT VARIANT
  // ============================================================================

  if (variant === "compact") {
    return (
      <div className="flex items-center gap-3 px-4 py-2 bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg">
        {/* Plan Badge */}
        <div className={`px-3 py-1 rounded-md bg-gradient-to-r ${getPlanBadgeColor()} text-white text-xs font-semibold uppercase`}>
          {planConfig.marketing.name}
        </div>

        {/* Usage Stats */}
        <div className="flex items-center gap-2">
          <span className={`text-sm font-medium ${getUsageColor()}`}>
            {remaining} min
          </span>
          <span className="text-gray-500 text-xs">left this month</span>
        </div>

        {/* Upgrade Button */}
        {showUpgradeButton && planId !== "ultra" && (
          <button
            onClick={handleUpgrade}
            className="ml-auto px-3 py-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-medium rounded-md hover:from-purple-600 hover:to-pink-600 transition-all"
          >
            Upgrade
          </button>
        )}
      </div>
    )
  }

  // ============================================================================
  // DETAILED VARIANT
  // ============================================================================

  return (
    <div className="p-6 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-white mb-1">
            {planConfig.marketing.name}
          </h3>
          <p className="text-sm text-gray-400">{planConfig.marketing.tagline}</p>
        </div>
        <div className={`px-4 py-2 rounded-lg bg-gradient-to-r ${getPlanBadgeColor()} text-white font-semibold uppercase text-sm`}>
          {subscriptionStatus === "trial" ? "Trial" : subscriptionStatus}
        </div>
      </div>

      {/* Usage Progress Bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-400">Meeting Minutes Used</span>
          <span className={`text-sm font-medium ${getUsageColor()}`}>
            {used} / {limit} min
          </span>
        </div>
        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(percentUsed, 100)}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className={`h-full bg-gradient-to-r ${getProgressColor()}`}
          />
        </div>
        <div className="mt-1 text-xs text-gray-500">
          {remaining} minutes remaining this month
        </div>
      </div>

      {/* Features */}
      <div className="mb-4">
        <div className="text-xs font-semibold text-gray-400 uppercase mb-2">
          Plan Features
        </div>
        <div className="grid grid-cols-2 gap-2">
          {planConfig.marketing.bullets.map((bullet, index) => (
            <div key={index} className="flex items-start gap-2">
              <svg
                className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <span className="text-sm text-gray-300">{bullet}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Upgrade Button */}
      {showUpgradeButton && planId !== "ultra" && (
        <button
          onClick={handleUpgrade}
          className="w-full px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all shadow-lg shadow-purple-500/20"
        >
          {planId === "free" ? "Upgrade to Plus" : "Upgrade to Ultra"}
        </button>
      )}

      {/* Low Balance Warning */}
      {percentUsed >= 80 && (
        <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
          <div className="flex items-start gap-2">
            <svg
              className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <div>
              <div className="text-sm font-medium text-yellow-400 mb-1">
                Running Low on Minutes
              </div>
              <div className="text-xs text-yellow-300/80">
                You have {remaining} minutes left. Consider upgrading to avoid interruption.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// MINI BADGE (for navbar/header)
// ============================================================================

export const PlanBadge: React.FC = () => {
  const { planId, planConfig } = usePlan()

  const getBadgeColor = () => {
    if (planId === "ultra") return "from-yellow-500 to-orange-500"
    if (planId === "plus") return "from-purple-500 to-pink-500"
    return "from-gray-500 to-gray-600"
  }

  return (
    <div
      className={`px-3 py-1 rounded-md bg-gradient-to-r ${getBadgeColor()} text-white text-xs font-semibold uppercase cursor-pointer hover:opacity-80 transition-opacity`}
      title={planConfig.marketing.tagline}
    >
      {planConfig.marketing.name}
    </div>
  )
}
