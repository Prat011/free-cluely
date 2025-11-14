/**
 * Horalix Halo - Subscription Context
 *
 * Manages user subscription state, feature access, and usage limits.
 * Provides centralized subscription data to all components.
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from "react"
import type { PlanId, PlanConfig } from "../../shared/plans"
import { PLANS } from "../../shared/plans"

// ============================================================================
// TYPES
// ============================================================================

export interface SubscriptionState {
  // Subscription info
  planId: PlanId
  planConfig: PlanConfig
  subscriptionStatus: "active" | "cancelled" | "expired" | "trial"

  // Usage tracking
  minutesUsedThisPeriod: number
  minutesLimit: number
  maxMinutesPerMeeting: number

  // Metadata
  renewsAt?: number
  trialEndsAt?: number

  // State
  isLoading: boolean
  error: string | null
}

export interface SubscriptionContextType extends SubscriptionState {
  // Actions
  refresh: () => Promise<void>
  canUseFeature: (featureKey: keyof PlanConfig["features"]) => boolean
  canStartMeeting: () => { allowed: boolean; reason?: string }
  getRemainingMinutes: () => number

  // Upgrade flow
  startCheckout: (targetPlan: PlanId, interval: "month" | "year") => Promise<void>
}

// ============================================================================
// CONTEXT
// ============================================================================

const SubscriptionContext = createContext<SubscriptionContextType | null>(null)

// ============================================================================
// PROVIDER
// ============================================================================

export const SubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [state, setState] = useState<SubscriptionState>({
    planId: "free",
    planConfig: PLANS.free,
    subscriptionStatus: "trial",
    minutesUsedThisPeriod: 0,
    minutesLimit: 20, // Free tier: 20 min max per meeting
    maxMinutesPerMeeting: 20,
    isLoading: true,
    error: null,
  })

  // ============================================================================
  // FETCH SUBSCRIPTION DATA
  // ============================================================================

  const fetchSubscription = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }))

      // Call backend API to get subscription data
      const response = await fetch("http://localhost:3001/api/subscription/me", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          // TODO: Add JWT token from auth context
          // Authorization: `Bearer ${authToken}`,
        },
      })

      if (!response.ok) {
        // If 401, user not authenticated - default to free tier
        if (response.status === 401) {
          setState({
            planId: "free",
            planConfig: PLANS.free,
            subscriptionStatus: "trial",
            minutesUsedThisPeriod: 0,
            minutesLimit: 20,
            maxMinutesPerMeeting: 20,
            isLoading: false,
            error: null,
          })
          return
        }

        throw new Error(`Subscription fetch failed: ${response.statusText}`)
      }

      const data = await response.json()

      // Update state with server data
      setState({
        planId: data.planId,
        planConfig: PLANS[data.planId],
        subscriptionStatus: data.status || "active",
        minutesUsedThisPeriod: data.minutesUsedThisPeriod || 0,
        minutesLimit: data.minutesLimit || PLANS[data.planId].features.maxMinutesPerMeeting,
        maxMinutesPerMeeting: PLANS[data.planId].features.maxMinutesPerMeeting,
        renewsAt: data.renewsAt,
        trialEndsAt: data.trialEndsAt,
        isLoading: false,
        error: null,
      })
    } catch (error) {
      console.error("[SubscriptionContext] Failed to fetch subscription:", error)
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }))
    }
  }, [])

  // Fetch on mount
  useEffect(() => {
    fetchSubscription()
  }, [fetchSubscription])

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      fetchSubscription()
    }, 5 * 60 * 1000)

    return () => clearInterval(interval)
  }, [fetchSubscription])

  // ============================================================================
  // FEATURE GATING HELPERS
  // ============================================================================

  const canUseFeature = useCallback(
    (featureKey: keyof PlanConfig["features"]): boolean => {
      const feature = state.planConfig.features[featureKey]

      // Boolean features
      if (typeof feature === "boolean") {
        return feature
      }

      // Numeric limits (like maxMeetingsPerWeek)
      if (typeof feature === "number") {
        return feature > 0
      }

      return false
    },
    [state.planConfig]
  )

  const canStartMeeting = useCallback((): { allowed: boolean; reason?: string } => {
    // Check if transcription is enabled
    if (!state.planConfig.features.realtimeTranscription) {
      return {
        allowed: false,
        reason: "Real-time transcription not available on your plan",
      }
    }

    // Check weekly meeting limit (for free tier)
    if (state.planConfig.features.maxMeetingsPerWeek !== undefined) {
      // TODO: Track meetings per week in backend
      // For now, just allow
    }

    // Check monthly minutes limit (for paid tiers)
    const remainingMinutes = getRemainingMinutes()
    if (remainingMinutes <= 0) {
      return {
        allowed: false,
        reason: `You've used all ${state.minutesLimit} minutes this month. Upgrade to continue.`,
      }
    }

    return { allowed: true }
  }, [state])

  const getRemainingMinutes = useCallback((): number => {
    return Math.max(0, state.minutesLimit - state.minutesUsedThisPeriod)
  }, [state.minutesLimit, state.minutesUsedThisPeriod])

  // ============================================================================
  // UPGRADE FLOW
  // ============================================================================

  const startCheckout = useCallback(
    async (targetPlan: PlanId, interval: "month" | "year") => {
      try {
        console.log(`[SubscriptionContext] Starting checkout for ${targetPlan}/${interval}`)

        const response = await fetch("http://localhost:3001/api/subscription/start-checkout", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            // TODO: Add JWT token from auth context
            // Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            planId: targetPlan,
            interval,
          }),
        })

        if (!response.ok) {
          throw new Error(`Checkout creation failed: ${response.statusText}`)
        }

        const data = await response.json()

        // Open checkout URL in external browser
        if (data.checkoutUrl) {
          // Use Electron's shell.openExternal
          if (window.electronAPI?.invoke) {
            await window.electronAPI.invoke("shell:openExternal", data.checkoutUrl)
          } else {
            // Fallback for web
            window.open(data.checkoutUrl, "_blank")
          }
        }

        // Refresh subscription after a delay (user will complete checkout)
        setTimeout(() => {
          fetchSubscription()
        }, 3000)
      } catch (error) {
        console.error("[SubscriptionContext] Checkout error:", error)
        throw error
      }
    },
    [fetchSubscription]
  )

  // ============================================================================
  // CONTEXT VALUE
  // ============================================================================

  const value: SubscriptionContextType = {
    ...state,
    refresh: fetchSubscription,
    canUseFeature,
    canStartMeeting,
    getRemainingMinutes,
    startCheckout,
  }

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  )
}

// ============================================================================
// HOOK
// ============================================================================

export const useSubscription = (): SubscriptionContextType => {
  const context = useContext(SubscriptionContext)
  if (!context) {
    throw new Error("useSubscription must be used within SubscriptionProvider")
  }
  return context
}

// ============================================================================
// CONVENIENCE HOOKS
// ============================================================================

/**
 * Hook to check if a specific feature is available
 */
export const useFeature = (featureKey: keyof PlanConfig["features"]): boolean => {
  const { canUseFeature } = useSubscription()
  return canUseFeature(featureKey)
}

/**
 * Hook to get plan information
 */
export const usePlan = () => {
  const { planId, planConfig, subscriptionStatus } = useSubscription()
  return { planId, planConfig, subscriptionStatus }
}

/**
 * Hook to check if user can start a meeting
 */
export const useCanStartMeeting = () => {
  const { canStartMeeting } = useSubscription()
  return canStartMeeting()
}

/**
 * Hook for usage stats
 */
export const useUsageStats = () => {
  const { minutesUsedThisPeriod, minutesLimit, getRemainingMinutes } = useSubscription()
  return {
    used: minutesUsedThisPeriod,
    limit: minutesLimit,
    remaining: getRemainingMinutes(),
    percentUsed: (minutesUsedThisPeriod / minutesLimit) * 100,
  }
}
