/**
 * Horalix Halo Backend - Usage Service
 *
 * Handles usage tracking, limits, and profit-safety calculations
 */

import UserModel from '../models/User'
import SubscriptionModel from '../models/Subscription'
import MeetingModel from '../models/Meeting'
import AiUsageModel from '../models/AiUsage'
import { PLANS, getPlanConfig } from '@shared/plans'
import { calculateMaxAiSpend } from '@shared/aiCost'
import { User } from '../types'

// ============================================================================
// FREE TRIAL HELPERS
// ============================================================================

/**
 * Check if user can start a free trial meeting
 * Free trial rules:
 * - 1 meeting per week
 * - Max 20 minutes per meeting
 * - Can restart trial after 7 days from last trial
 */
export function canStartFreeTrial(user: User): {
  canStart: boolean
  reason?: string
} {
  // If user is not on free plan, they don't need trial
  if (user.currentPlan !== 'free') {
    return { canStart: true }
  }

  const now = Date.now()
  const oneWeek = 7 * 24 * 60 * 60 * 1000

  // Check if user has started a trial before
  if (!user.lastFreeTrialStartedAt) {
    return { canStart: true }
  }

  // Check if 7 days have passed since last trial
  const timeSinceLastTrial = now - user.lastFreeTrialStartedAt
  if (timeSinceLastTrial < oneWeek) {
    const daysRemaining = Math.ceil((oneWeek - timeSinceLastTrial) / (24 * 60 * 60 * 1000))
    return {
      canStart: false,
      reason: `Free trial is limited to 1 meeting per week. You can start another trial in ${daysRemaining} day${daysRemaining > 1 ? 's' : ''}.`,
    }
  }

  return { canStart: true }
}

// ============================================================================
// BILLING PERIOD HELPERS
// ============================================================================

/**
 * Get current billing period for a user
 * Returns start and end timestamps
 */
export function getCurrentBillingPeriod(userId: string): {
  start: number
  end: number
} {
  const subscription = SubscriptionModel.findActiveByUserId(userId)

  if (!subscription) {
    // No active subscription, use current month
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).getTime()
    return { start, end }
  }

  // Use subscription renewal date
  if (!subscription.renewAt) {
    // Fallback to current month
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).getTime()
    return { start, end }
  }

  const renewAt = new Date(subscription.renewAt)
  const now = new Date()

  // Calculate billing period boundaries
  let start: Date
  let end: Date

  if (subscription.billingInterval === 'yearly') {
    // Yearly billing
    const yearsDiff = now.getFullYear() - renewAt.getFullYear()
    start = new Date(renewAt)
    start.setFullYear(renewAt.getFullYear() + yearsDiff)

    if (start > now) {
      start.setFullYear(start.getFullYear() - 1)
    }

    end = new Date(start)
    end.setFullYear(end.getFullYear() + 1)
    end.setMilliseconds(-1)
  } else {
    // Monthly billing
    start = new Date(renewAt)
    start.setMonth(now.getMonth())
    start.setFullYear(now.getFullYear())

    if (start > now) {
      start.setMonth(start.getMonth() - 1)
    }

    end = new Date(start)
    end.setMonth(end.getMonth() + 1)
    end.setMilliseconds(-1)
  }

  return {
    start: start.getTime(),
    end: end.getTime(),
  }
}

// ============================================================================
// AI COST TRACKING
// ============================================================================

/**
 * Get total AI cost for user in current billing period
 */
export async function getUserAiCostThisPeriod(userId: string): Promise<number> {
  const period = getCurrentBillingPeriod(userId)
  return AiUsageModel.getTotalCost(userId, period.start, period.end)
}

/**
 * Check if user can afford a new AI request
 */
export async function canUserAffordNewRequest(
  userId: string,
  estimatedCost: number
): Promise<boolean> {
  const user = UserModel.findById(userId)
  if (!user) return false

  // Get user's plan and calculate max allowed spend
  const planConfig = PLANS[user.currentPlan]
  const monthlyRevenue =
    user.currentPlan === 'free' ? 0 : planConfig.pricing.monthly

  const maxAllowedSpend = calculateMaxAiSpend(monthlyRevenue)

  // Get current spend
  const currentSpend = await getUserAiCostThisPeriod(userId)

  // Check if new request would exceed limit
  return currentSpend + estimatedCost <= maxAllowedSpend
}

// ============================================================================
// MEETING USAGE TRACKING
// ============================================================================

/**
 * Get user's meeting usage stats for current billing period
 */
export async function getUserMeetingStats(userId: string): Promise<{
  totalMinutesUsed: number
  maxMinutesAllowed: number | null
  totalMeetings: number
  maxMeetingsPerWeek: number | null
  hasActiveMeeting: boolean
}> {
  const user = UserModel.findById(userId)
  if (!user) {
    throw new Error('User not found')
  }

  const planConfig = getPlanConfig(user.currentPlan)
  const period = getCurrentBillingPeriod(userId)

  // Get total minutes used
  const totalMinutesUsed = MeetingModel.getTotalMinutes(
    userId,
    period.start,
    period.end
  )

  // Get total meetings
  const totalMeetings = MeetingModel.countByDateRange(
    userId,
    period.start,
    period.end
  )

  // Check for active meeting
  const activeMeeting = MeetingModel.findActiveMeeting(userId)

  return {
    totalMinutesUsed,
    maxMinutesAllowed: planConfig.features.maxMinutesPerMonth || null,
    totalMeetings,
    maxMeetingsPerWeek: planConfig.features.maxMeetingsPerWeek || null,
    hasActiveMeeting: activeMeeting !== null,
  }
}

/**
 * Check if user can start a new meeting
 */
export async function canStartMeeting(
  userId: string,
  estimatedDurationMinutes: number = 30
): Promise<{
  canStart: boolean
  reason?: string
  suggestions?: string[]
}> {
  const user = UserModel.findById(userId)
  if (!user) {
    return {
      canStart: false,
      reason: 'User not found',
    }
  }

  const planConfig = getPlanConfig(user.currentPlan)

  // Check if there's already an active meeting
  const activeMeeting = MeetingModel.findActiveMeeting(userId)
  if (activeMeeting) {
    return {
      canStart: false,
      reason: 'You already have an active meeting. Please end it before starting a new one.',
    }
  }

  // Check free trial limits
  if (user.currentPlan === 'free') {
    const trialCheck = canStartFreeTrial(user)
    if (!trialCheck.canStart) {
      return {
        canStart: false,
        reason: trialCheck.reason,
        suggestions: [
          'Upgrade to Halo Plus for unlimited meetings',
          'Wait for your trial week to reset',
        ],
      }
    }

    // Check if estimated duration exceeds free limit
    if (estimatedDurationMinutes > planConfig.features.maxMinutesPerMeeting) {
      return {
        canStart: false,
        reason: `Free trial meetings are limited to ${planConfig.features.maxMinutesPerMeeting} minutes. Your estimated duration is ${estimatedDurationMinutes} minutes.`,
        suggestions: [
          `Keep your meeting under ${planConfig.features.maxMinutesPerMeeting} minutes`,
          'Upgrade to Halo Plus for longer meetings',
        ],
      }
    }
  }

  // Check monthly minute limits for paid plans
  if (planConfig.features.maxMinutesPerMonth) {
    const stats = await getUserMeetingStats(userId)

    if (
      stats.totalMinutesUsed + estimatedDurationMinutes >
      planConfig.features.maxMinutesPerMonth
    ) {
      return {
        canStart: false,
        reason: `You've used ${stats.totalMinutesUsed} of ${planConfig.features.maxMinutesPerMonth} minutes this month. This meeting would exceed your limit.`,
        suggestions: [
          'Wait for your billing period to reset',
          user.currentPlan === 'plus'
            ? 'Upgrade to Halo Ultra for more minutes'
            : null,
        ].filter(Boolean) as string[],
      }
    }
  }

  return { canStart: true }
}

// ============================================================================
// COMPLETE USAGE STATS
// ============================================================================

/**
 * Get comprehensive usage statistics for a user
 */
export async function getCompleteUsageStats(userId: string) {
  const user = UserModel.findById(userId)
  if (!user) {
    throw new Error('User not found')
  }

  const period = getCurrentBillingPeriod(userId)
  const planConfig = getPlanConfig(user.currentPlan)

  // Get meeting stats
  const meetingStats = await getUserMeetingStats(userId)

  // Get AI cost stats
  const aiCost = await getUserAiCostThisPeriod(userId)
  const monthlyRevenue =
    user.currentPlan === 'free' ? 0 : planConfig.pricing.monthly
  const maxAiCost = calculateMaxAiSpend(monthlyRevenue)
  const remainingBudget = Math.max(0, maxAiCost - aiCost)
  const budgetUsagePercent =
    maxAiCost > 0 ? Math.min(100, (aiCost / maxAiCost) * 100) : 0

  return {
    currentPeriodStart: period.start,
    currentPeriodEnd: period.end,
    ...meetingStats,
    aiCostThisPeriod: aiCost,
    maxAiCostAllowed: maxAiCost,
    remainingBudget,
    budgetUsagePercent,
  }
}
