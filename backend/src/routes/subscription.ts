/**
 * Horalix Halo Backend - Subscription Routes
 *
 * Handle subscription management and checkout
 */

import { Router } from 'express'
import { requireAuth } from '../middleware/auth'
import { asyncHandler, requireFields } from '../middleware/errorHandler'
import { createCheckoutUrl } from '../services/lemonsqueezy'
import { canStartFreeTrial } from '../services/usage'
import SubscriptionModel from '../models/Subscription'
import UserModel from '../models/User'
import { PLANS, getPlanConfig } from '@shared/plans'
import {
  AuthRequest,
  CreateCheckoutRequest,
  CreateCheckoutResponse,
  SubscriptionInfoResponse,
  ValidationError,
} from '../types'

const router = Router()

// ============================================================================
// GET /api/subscription/me - Get current subscription info
// ============================================================================

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const userId = req.userId!
    const user = req.user!

    // Get active subscription
    const subscription = SubscriptionModel.findActiveByUserId(userId)

    // Get plan configuration
    const planConfig = getPlanConfig(user.currentPlan)

    // Check if user can use free trial
    const trialCheck = canStartFreeTrial(user)

    const response: SubscriptionInfoResponse = {
      subscription,
      user,
      currentPlan: user.currentPlan,
      features: planConfig.features,
      canUseTrial: trialCheck.canStart,
    }

    res.json(response)
  })
)

// ============================================================================
// POST /api/subscription/start-checkout - Create checkout URL
// ============================================================================

router.post(
  '/start-checkout',
  requireAuth,
  requireFields('planId', 'billingInterval'),
  asyncHandler(async (req: AuthRequest, res) => {
    const userId = req.userId!
    const { planId, billingInterval } = req.body as CreateCheckoutRequest

    // Validate plan ID
    if (!PLANS[planId]) {
      throw new ValidationError('Invalid plan ID')
    }

    if (planId === 'free') {
      throw new ValidationError('Cannot checkout for free plan')
    }

    // Validate billing interval
    if (billingInterval !== 'monthly' && billingInterval !== 'yearly') {
      throw new ValidationError('Invalid billing interval. Must be monthly or yearly')
    }

    // Check if user already has an active subscription
    const existingSubscription = SubscriptionModel.findActiveByUserId(userId)
    if (existingSubscription) {
      // TODO: In production, you might want to allow plan changes
      throw new ValidationError(
        'You already have an active subscription. Please cancel it first to change plans.'
      )
    }

    // Create checkout URL
    const checkoutUrl = await createCheckoutUrl(userId, planId, billingInterval)

    const response: CreateCheckoutResponse = {
      checkoutUrl,
    }

    res.json(response)
  })
)

// ============================================================================
// GET /api/subscription/history - Get subscription history
// ============================================================================

router.get(
  '/history',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const userId = req.userId!

    // Get all subscriptions for user
    const subscriptions = SubscriptionModel.findAllByUserId(userId)

    res.json({
      subscriptions,
    })
  })
)

// ============================================================================
// POST /api/subscription/cancel - Cancel subscription
// ============================================================================

router.post(
  '/cancel',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const userId = req.userId!

    // Get active subscription
    const subscription = SubscriptionModel.findActiveByUserId(userId)
    if (!subscription) {
      throw new ValidationError('No active subscription found')
    }

    // Cancel subscription
    // Note: In a real implementation, you would also need to call the Lemon Squeezy API
    // to cancel the subscription on their end
    const canceledSubscription = SubscriptionModel.cancel(subscription.id)

    // Downgrade user to free plan
    UserModel.updatePlan(userId, 'free')

    res.json({
      message: 'Subscription cancelled successfully',
      subscription: canceledSubscription,
    })
  })
)

// ============================================================================
// GET /api/subscription/plans - Get available plans
// ============================================================================

router.get('/plans', (req, res) => {
  // Return all plan configurations
  const plans = Object.values(PLANS).map((plan) => ({
    id: plan.id,
    name: plan.marketing.name,
    tagline: plan.marketing.tagline,
    label: plan.marketing.label,
    microCopy: plan.marketing.microCopy,
    bullets: plan.marketing.bullets,
    pricing: plan.pricing,
    features: plan.features,
  }))

  res.json({ plans })
})

export default router
