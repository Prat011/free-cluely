/**
 * Horalix Halo - Feature Gate Component
 *
 * Conditional rendering based on subscription plan features.
 * Optionally shows upgrade prompt when feature is locked.
 */

import React from "react"
import { useSubscription } from "../../contexts/SubscriptionContext"
import type { PlanConfig } from "../../../shared/plans"

// ============================================================================
// TYPES
// ============================================================================

interface FeatureGateProps {
  feature: keyof PlanConfig["features"]
  children: React.ReactNode
  fallback?: React.ReactNode
  showUpgradePrompt?: boolean
}

interface UpgradePromptProps {
  feature: keyof PlanConfig["features"]
}

// ============================================================================
// UPGRADE PROMPT
// ============================================================================

const UpgradePrompt: React.FC<UpgradePromptProps> = ({ feature }) => {
  const { planId, startCheckout } = useSubscription()

  const handleUpgrade = async () => {
    // Determine which plan to upgrade to based on feature
    const targetPlan = planId === "free" ? "plus" : "ultra"
    try {
      await startCheckout(targetPlan, "month")
    } catch (error) {
      console.error("[FeatureGate] Upgrade error:", error)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center p-6 border border-purple-500/20 rounded-lg bg-purple-500/5">
      <div className="text-purple-400 mb-2">
        <svg
          className="w-12 h-12"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
          />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-white mb-1">Premium Feature</h3>
      <p className="text-gray-400 text-sm text-center mb-4">
        Upgrade your plan to unlock {getFeatureLabel(feature)}
      </p>
      <button
        onClick={handleUpgrade}
        className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg font-medium hover:from-purple-600 hover:to-pink-600 transition-all"
      >
        Upgrade Now
      </button>
    </div>
  )
}

// ============================================================================
// FEATURE GATE
// ============================================================================

export const FeatureGate: React.FC<FeatureGateProps> = ({
  feature,
  children,
  fallback,
  showUpgradePrompt = false,
}) => {
  const { canUseFeature } = useSubscription()

  const hasAccess = canUseFeature(feature)

  if (hasAccess) {
    return <>{children}</>
  }

  // Show custom fallback if provided
  if (fallback) {
    return <>{fallback}</>
  }

  // Show upgrade prompt if requested
  if (showUpgradePrompt) {
    return <UpgradePrompt feature={feature} />
  }

  // Otherwise render nothing
  return null
}

// ============================================================================
// HELPERS
// ============================================================================

function getFeatureLabel(feature: keyof PlanConfig["features"]): string {
  const labels: Record<keyof PlanConfig["features"], string> = {
    realtimeTranscription: "real-time transcription",
    inMeetingButtons: "in-meeting assistance",
    basicRecap: "meeting recaps",
    factCheckButton: "fact checking",
    advancedRecaps: "advanced AI recaps",
    multiAiEngine: "multi-AI engine selection",
    customKnowledge: "custom knowledge uploads",
    maxMeetingsPerWeek: "unlimited meetings",
    maxMinutesPerMeeting: "longer meetings",
  }

  return labels[feature] || "this feature"
}

// ============================================================================
// CONVENIENCE COMPONENTS
// ============================================================================

/**
 * Gate for multi-AI engine selection (Ultra only)
 */
export const MultiAiGate: React.FC<{
  children: React.ReactNode
  showUpgradePrompt?: boolean
}> = ({ children, showUpgradePrompt = true }) => (
  <FeatureGate
    feature="multiAiEngine"
    showUpgradePrompt={showUpgradePrompt}
  >
    {children}
  </FeatureGate>
)

/**
 * Gate for custom knowledge uploads (Ultra only)
 */
export const CustomKnowledgeGate: React.FC<{
  children: React.ReactNode
  showUpgradePrompt?: boolean
}> = ({ children, showUpgradePrompt = true }) => (
  <FeatureGate
    feature="customKnowledge"
    showUpgradePrompt={showUpgradePrompt}
  >
    {children}
  </FeatureGate>
)

/**
 * Gate for advanced recaps (Plus and Ultra)
 */
export const AdvancedRecapGate: React.FC<{
  children: React.ReactNode
  showUpgradePrompt?: boolean
}> = ({ children, showUpgradePrompt = true }) => (
  <FeatureGate
    feature="advancedRecaps"
    showUpgradePrompt={showUpgradePrompt}
  >
    {children}
  </FeatureGate>
)

/**
 * Gate for fact checking (Plus and Ultra)
 */
export const FactCheckGate: React.FC<{
  children: React.ReactNode
  showUpgradePrompt?: boolean
}> = ({ children, showUpgradePrompt = true }) => (
  <FeatureGate
    feature="factCheckButton"
    showUpgradePrompt={showUpgradePrompt}
  >
    {children}
  </FeatureGate>
)
