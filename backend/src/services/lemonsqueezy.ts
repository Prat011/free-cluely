/**
 * Horalix Halo Backend - Lemon Squeezy Service
 *
 * Handles Lemon Squeezy API interactions and webhook processing
 */

import crypto from 'crypto'
import { PLANS } from '@shared/plans'
import { PlanId, BillingInterval } from '@shared/plans'
import UserModel from '../models/User'
import SubscriptionModel from '../models/Subscription'
import { LemonSqueezyWebhook, SubscriptionStatus } from '../types'

// ============================================================================
// CONFIGURATION
// ============================================================================

const LEMON_SQUEEZY_API_KEY = process.env.LEMON_SQUEEZY_API_KEY
const LEMON_SQUEEZY_STORE_ID = process.env.LEMON_SQUEEZY_STORE_ID
const LEMON_SQUEEZY_WEBHOOK_SECRET = process.env.LEMON_SQUEEZY_WEBHOOK_SECRET

const VARIANT_IDS = {
  plus_monthly: process.env.LEMON_SQUEEZY_PLUS_MONTHLY_VARIANT_ID,
  plus_yearly: process.env.LEMON_SQUEEZY_PLUS_YEARLY_VARIANT_ID,
  ultra_monthly: process.env.LEMON_SQUEEZY_ULTRA_MONTHLY_VARIANT_ID,
  ultra_yearly: process.env.LEMON_SQUEEZY_ULTRA_YEARLY_VARIANT_ID,
}

// ============================================================================
// API HELPERS
// ============================================================================

/**
 * Make a request to Lemon Squeezy API
 */
async function lemonSqueezyRequest(
  endpoint: string,
  options: RequestInit = {}
): Promise<any> {
  if (!LEMON_SQUEEZY_API_KEY) {
    throw new Error('LEMON_SQUEEZY_API_KEY not configured')
  }

  const url = `https://api.lemonsqueezy.com/v1${endpoint}`

  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: 'application/vnd.api+json',
      'Content-Type': 'application/vnd.api+json',
      Authorization: `Bearer ${LEMON_SQUEEZY_API_KEY}`,
      ...options.headers,
    },
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Lemon Squeezy API error: ${response.status} - ${error}`)
  }

  return response.json()
}

// ============================================================================
// CHECKOUT
// ============================================================================

/**
 * Create a checkout URL for a user to subscribe to a plan
 */
export async function createCheckoutUrl(
  userId: string,
  planId: PlanId,
  billingInterval: BillingInterval
): Promise<string> {
  if (planId === 'free') {
    throw new Error('Cannot create checkout for free plan')
  }

  // Get variant ID
  const variantKey =
    `${planId}_${billingInterval}` as keyof typeof VARIANT_IDS
  const variantId = VARIANT_IDS[variantKey]

  if (!variantId) {
    throw new Error(
      `No Lemon Squeezy variant ID configured for ${planId} ${billingInterval}. ` +
        `Please set LEMON_SQUEEZY_${planId.toUpperCase()}_${billingInterval.toUpperCase()}_VARIANT_ID in environment variables.`
    )
  }

  if (!LEMON_SQUEEZY_STORE_ID) {
    throw new Error('LEMON_SQUEEZY_STORE_ID not configured')
  }

  // Get user info
  const user = UserModel.findById(userId)
  if (!user) {
    throw new Error('User not found')
  }

  // Create checkout
  // TODO: This is a simplified version. See Lemon Squeezy API docs for full implementation
  // https://docs.lemonsqueezy.com/api/checkouts
  const checkout = await lemonSqueezyRequest('/checkouts', {
    method: 'POST',
    body: JSON.stringify({
      data: {
        type: 'checkouts',
        attributes: {
          checkout_data: {
            email: user.email,
            custom: {
              user_id: userId,
            },
          },
        },
        relationships: {
          store: {
            data: {
              type: 'stores',
              id: LEMON_SQUEEZY_STORE_ID,
            },
          },
          variant: {
            data: {
              type: 'variants',
              id: variantId,
            },
          },
        },
      },
    }),
  })

  // Extract checkout URL
  const checkoutUrl = checkout.data.attributes.url

  if (!checkoutUrl) {
    throw new Error('Failed to create checkout URL')
  }

  return checkoutUrl
}

// ============================================================================
// WEBHOOK SIGNATURE VERIFICATION
// ============================================================================

/**
 * Verify webhook signature from Lemon Squeezy
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string
): boolean {
  if (!LEMON_SQUEEZY_WEBHOOK_SECRET) {
    console.warn('⚠️  LEMON_SQUEEZY_WEBHOOK_SECRET not set. Skipping signature verification (INSECURE!)')
    return true
  }

  // TODO: Implement actual signature verification
  // Lemon Squeezy uses HMAC-SHA256
  // See: https://docs.lemonsqueezy.com/guides/developer-guide/webhooks#signing-requests

  const hmac = crypto.createHmac('sha256', LEMON_SQUEEZY_WEBHOOK_SECRET)
  hmac.update(payload)
  const digest = hmac.digest('hex')

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(digest)
  )
}

// ============================================================================
// WEBHOOK PROCESSING
// ============================================================================

/**
 * Process Lemon Squeezy webhook events
 */
export async function processWebhook(
  webhook: LemonSqueezyWebhook
): Promise<void> {
  const eventName = webhook.meta.event_name
  const data = webhook.data.attributes

  console.log(`Processing Lemon Squeezy webhook: ${eventName}`)

  switch (eventName) {
    case 'subscription_created':
      await handleSubscriptionCreated(webhook)
      break

    case 'subscription_updated':
      await handleSubscriptionUpdated(webhook)
      break

    case 'subscription_cancelled':
      await handleSubscriptionCancelled(webhook)
      break

    case 'subscription_resumed':
      await handleSubscriptionResumed(webhook)
      break

    case 'subscription_expired':
      await handleSubscriptionExpired(webhook)
      break

    case 'subscription_paused':
      await handleSubscriptionPaused(webhook)
      break

    case 'subscription_unpaused':
      await handleSubscriptionUnpaused(webhook)
      break

    case 'subscription_payment_success':
      await handlePaymentSuccess(webhook)
      break

    case 'subscription_payment_failed':
      await handlePaymentFailed(webhook)
      break

    default:
      console.log(`Unhandled webhook event: ${eventName}`)
  }
}

// ============================================================================
// WEBHOOK HANDLERS
// ============================================================================

async function handleSubscriptionCreated(
  webhook: LemonSqueezyWebhook
): Promise<void> {
  const data = webhook.data.attributes
  const userId = webhook.meta.custom_data?.user_id

  if (!userId) {
    throw new Error('No user_id in webhook custom_data')
  }

  // Determine plan and billing interval from variant
  const variantId = data.variant_id.toString()
  const { planId, billingInterval } = getplanFromVariantId(variantId)

  // Create subscription record
  const subscription = SubscriptionModel.create({
    userId,
    provider: 'lemonsqueezy',
    providerSubscriptionId: webhook.data.id,
    planId,
    status: mapLemonSqueezyStatus(data.status),
    billingInterval,
    renewAt: data.renews_at ? new Date(data.renews_at).getTime() : null,
    cancelAt: data.ends_at ? new Date(data.ends_at).getTime() : null,
  })

  // Update user's current plan
  UserModel.updatePlan(userId, planId)

  // Update billing customer ID
  if (data.customer_id) {
    UserModel.updateBillingCustomerId(userId, data.customer_id.toString())
  }

  console.log(`Subscription created: ${subscription.id} for user ${userId}`)
}

async function handleSubscriptionUpdated(
  webhook: LemonSqueezyWebhook
): Promise<void> {
  const data = webhook.data.attributes
  const subscription = SubscriptionModel.findByProviderSubscriptionId(
    webhook.data.id
  )

  if (!subscription) {
    console.warn(`Subscription not found: ${webhook.data.id}`)
    return
  }

  // Update subscription
  SubscriptionModel.update(subscription.id, {
    status: mapLemonSqueezyStatus(data.status),
    renewAt: data.renews_at ? new Date(data.renews_at).getTime() : null,
    cancelAt: data.ends_at ? new Date(data.ends_at).getTime() : null,
  })

  console.log(`Subscription updated: ${subscription.id}`)
}

async function handleSubscriptionCancelled(
  webhook: LemonSqueezyWebhook
): Promise<void> {
  const data = webhook.data.attributes
  const subscription = SubscriptionModel.findByProviderSubscriptionId(
    webhook.data.id
  )

  if (!subscription) {
    console.warn(`Subscription not found: ${webhook.data.id}`)
    return
  }

  // Update subscription status
  SubscriptionModel.update(subscription.id, {
    status: 'canceled',
    cancelAt: data.ends_at ? new Date(data.ends_at).getTime() : Date.now(),
  })

  // Downgrade user to free plan
  UserModel.updatePlan(subscription.userId, 'free')

  console.log(`Subscription cancelled: ${subscription.id}`)
}

async function handleSubscriptionResumed(
  webhook: LemonSqueezyWebhook
): Promise<void> {
  const data = webhook.data.attributes
  const subscription = SubscriptionModel.findByProviderSubscriptionId(
    webhook.data.id
  )

  if (!subscription) {
    console.warn(`Subscription not found: ${webhook.data.id}`)
    return
  }

  // Update subscription status
  SubscriptionModel.update(subscription.id, {
    status: 'active',
    cancelAt: null,
  })

  // Update user's plan
  UserModel.updatePlan(subscription.userId, subscription.planId)

  console.log(`Subscription resumed: ${subscription.id}`)
}

async function handleSubscriptionExpired(
  webhook: LemonSqueezyWebhook
): Promise<void> {
  const subscription = SubscriptionModel.findByProviderSubscriptionId(
    webhook.data.id
  )

  if (!subscription) {
    console.warn(`Subscription not found: ${webhook.data.id}`)
    return
  }

  // Update subscription status
  SubscriptionModel.update(subscription.id, {
    status: 'expired',
  })

  // Downgrade user to free plan
  UserModel.updatePlan(subscription.userId, 'free')

  console.log(`Subscription expired: ${subscription.id}`)
}

async function handleSubscriptionPaused(
  webhook: LemonSqueezyWebhook
): Promise<void> {
  const subscription = SubscriptionModel.findByProviderSubscriptionId(
    webhook.data.id
  )

  if (!subscription) {
    console.warn(`Subscription not found: ${webhook.data.id}`)
    return
  }

  SubscriptionModel.update(subscription.id, {
    status: 'paused',
  })

  console.log(`Subscription paused: ${subscription.id}`)
}

async function handleSubscriptionUnpaused(
  webhook: LemonSqueezyWebhook
): Promise<void> {
  const subscription = SubscriptionModel.findByProviderSubscriptionId(
    webhook.data.id
  )

  if (!subscription) {
    console.warn(`Subscription not found: ${webhook.data.id}`)
    return
  }

  SubscriptionModel.update(subscription.id, {
    status: 'active',
  })

  console.log(`Subscription unpaused: ${subscription.id}`)
}

async function handlePaymentSuccess(
  webhook: LemonSqueezyWebhook
): Promise<void> {
  const data = webhook.data.attributes
  const subscription = SubscriptionModel.findByProviderSubscriptionId(
    webhook.data.id
  )

  if (!subscription) {
    console.warn(`Subscription not found: ${webhook.data.id}`)
    return
  }

  // Update renewal date
  SubscriptionModel.update(subscription.id, {
    renewAt: data.renews_at ? new Date(data.renews_at).getTime() : null,
  })

  console.log(`Payment succeeded for subscription: ${subscription.id}`)
}

async function handlePaymentFailed(
  webhook: LemonSqueezyWebhook
): Promise<void> {
  const subscription = SubscriptionModel.findByProviderSubscriptionId(
    webhook.data.id
  )

  if (!subscription) {
    console.warn(`Subscription not found: ${webhook.data.id}`)
    return
  }

  // Update status to past_due
  SubscriptionModel.update(subscription.id, {
    status: 'past_due',
  })

  console.log(`Payment failed for subscription: ${subscription.id}`)
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Map Lemon Squeezy status to our internal status
 */
function mapLemonSqueezyStatus(lsStatus: string): SubscriptionStatus {
  const statusMap: Record<string, SubscriptionStatus> = {
    active: 'active',
    past_due: 'past_due',
    cancelled: 'canceled',
    expired: 'expired',
    on_trial: 'on_trial',
    paused: 'paused',
  }

  return statusMap[lsStatus] || 'active'
}

/**
 * Get plan and billing interval from variant ID
 */
function getplanFromVariantId(variantId: string): {
  planId: PlanId
  billingInterval: BillingInterval
} {
  // Reverse lookup in VARIANT_IDS
  for (const [key, id] of Object.entries(VARIANT_IDS)) {
    if (id === variantId) {
      const [plan, interval] = key.split('_') as [PlanId, BillingInterval]
      return { planId: plan, billingInterval: interval }
    }
  }

  // Default fallback
  console.warn(`Unknown variant ID: ${variantId}, defaulting to plus monthly`)
  return { planId: 'plus', billingInterval: 'monthly' }
}
