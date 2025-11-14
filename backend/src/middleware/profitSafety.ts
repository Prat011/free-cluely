/**
 * Horalix Halo Backend - Profit Safety Middleware
 *
 * Ensures that AI spending never exceeds 50% of user revenue
 * This is critical for maintaining profitability
 */

import { Response, NextFunction } from 'express'
import { AuthRequest, ProfitSafetyError } from '../types'
import { canUserAffordNewRequest, getUserAiCostThisPeriod } from '../services/usage'
import { PLANS } from '@shared/plans'
import { estimateRequestCost } from '@shared/aiCost'

// ============================================================================
// PROFIT SAFETY MIDDLEWARE
// ============================================================================

/**
 * Middleware to check if user can afford an AI request
 *
 * Usage:
 * 1. Add to route as middleware: app.post('/api/ai', requireAuth, profitSafety, ...)
 * 2. Optionally pass estimated cost in request body: { estimatedTokens: 5000 }
 *
 * The middleware will:
 * - Calculate user's max allowed AI spend based on their plan
 * - Check current spend for this billing period
 * - Compare with estimated cost of the new request
 * - Block request if it would exceed 50% of revenue
 */
export async function profitSafety(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Require authentication
    if (!req.userId || !req.user) {
      throw new ProfitSafetyError('Authentication required for profit safety check')
    }

    const userId = req.userId
    const user = req.user

    // Get user's current plan
    const planConfig = PLANS[user.currentPlan]

    // Calculate max allowed AI spend (50% of revenue)
    let monthlyRevenue = 0
    if (user.currentPlan === 'plus') {
      monthlyRevenue = planConfig.pricing.monthly
    } else if (user.currentPlan === 'ultra') {
      monthlyRevenue = planConfig.pricing.monthly
    }
    // Free users have $0 revenue, so they get a small allowance

    // Get estimated cost from request body
    const estimatedTokens = (req.body?.estimatedTokens as number) || 5000 // Default estimate
    const providerId = (req.body?.providerId as string) || 'deepseek-chat' // Default to cheapest
    const estimatedCost = estimateRequestCost(providerId, estimatedTokens, 500)

    // Check if user can afford this request
    const canAfford = await canUserAffordNewRequest(userId, estimatedCost)

    if (!canAfford) {
      // Get current usage for helpful error message
      const currentCost = await getUserAiCostThisPeriod(userId)
      const maxAllowedCost = monthlyRevenue / 2

      throw new ProfitSafetyError(
        `AI budget exceeded. You've used $${currentCost.toFixed(2)} of $${maxAllowedCost.toFixed(2)} this billing period. ` +
          `Upgrade your plan to continue using AI features.`
      )
    }

    // User can afford the request, proceed
    next()
  } catch (error) {
    next(error)
  }
}

/**
 * Middleware to check profit safety with custom estimated cost
 * Use this when you know the exact cost ahead of time
 */
export function profitSafetyWithCost(estimatedCost: number) {
  return async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.userId || !req.user) {
        throw new ProfitSafetyError('Authentication required for profit safety check')
      }

      const userId = req.userId
      const canAfford = await canUserAffordNewRequest(userId, estimatedCost)

      if (!canAfford) {
        const currentCost = await getUserAiCostThisPeriod(userId)
        const user = req.user
        const planConfig = PLANS[user.currentPlan]
        const monthlyRevenue =
          user.currentPlan === 'free' ? 0 : planConfig.pricing.monthly
        const maxAllowedCost = monthlyRevenue / 2

        throw new ProfitSafetyError(
          `AI budget exceeded. You've used $${currentCost.toFixed(2)} of $${maxAllowedCost.toFixed(2)} this billing period. ` +
            `Upgrade your plan to continue using AI features.`
        )
      }

      next()
    } catch (error) {
      next(error)
    }
  }
}

/**
 * Middleware to warn (but not block) if user is approaching their limit
 * Adds a warning to the response headers
 */
export async function profitSafetyWarning(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.userId || !req.user) {
      return next()
    }

    const userId = req.userId
    const user = req.user
    const currentCost = await getUserAiCostThisPeriod(userId)

    const planConfig = PLANS[user.currentPlan]
    const monthlyRevenue =
      user.currentPlan === 'free' ? 0 : planConfig.pricing.monthly
    const maxAllowedCost = monthlyRevenue / 2

    const usagePercent = (currentCost / maxAllowedCost) * 100

    // Warn if over 75% of budget
    if (usagePercent >= 75) {
      res.setHeader(
        'X-AI-Budget-Warning',
        `You've used ${usagePercent.toFixed(0)}% of your AI budget this period`
      )
    }

    next()
  } catch (error) {
    // Don't block request on warning errors
    next()
  }
}
