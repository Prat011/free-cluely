/**
 * Horalix Halo Backend - Type Definitions
 */

import { Request } from 'express'
import { PlanId, BillingInterval } from '@shared/plans'

// ============================================================================
// DATABASE TYPES
// ============================================================================

export interface User {
  id: string
  email: string
  currentPlan: PlanId
  billingCustomerId: string | null
  lastFreeTrialStartedAt: number | null // Unix timestamp
  createdAt: number // Unix timestamp
  updatedAt: number // Unix timestamp
}

export interface Subscription {
  id: string
  userId: string
  provider: 'lemonsqueezy' // Can add 'stripe' later
  providerSubscriptionId: string
  planId: PlanId
  status: SubscriptionStatus
  billingInterval: BillingInterval
  renewAt: number | null // Unix timestamp
  cancelAt: number | null // Unix timestamp
  createdAt: number // Unix timestamp
  updatedAt: number // Unix timestamp
}

export type SubscriptionStatus =
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'expired'
  | 'on_trial'
  | 'paused'

export interface Meeting {
  id: string
  userId: string
  startedAt: number // Unix timestamp
  endedAt: number | null // Unix timestamp
  durationMinutes: number | null
  transcriptPath: string | null // File path to transcript
  recapPath: string | null // File path to recap
}

export interface AiUsage {
  id: string
  userId: string
  providerId: string
  inputTokens: number
  outputTokens: number
  costUSD: number
  context: 'transcription' | 'suggestion' | 'recap' | 'fact-check' | 'custom'
  createdAt: number // Unix timestamp
}

export interface WebAuthnCredential {
  id: string
  userId: string
  credentialId: string // Base64URL encoded credential ID
  publicKey: string // Base64URL encoded public key
  counter: number // Signature counter
  transports: string | null // JSON array of transport types
  deviceName: string | null // User-friendly device name
  createdAt: number // Unix timestamp
  lastUsedAt: number | null // Unix timestamp
}

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

export interface AuthRequest extends Request {
  userId?: string
  user?: User
}

export interface CreateCheckoutRequest {
  planId: PlanId
  billingInterval: BillingInterval
}

export interface CreateCheckoutResponse {
  checkoutUrl: string
}

export interface SubscriptionInfoResponse {
  subscription: Subscription | null
  user: User
  currentPlan: PlanId
  features: any // From shared/plans.ts
  canUseTrial: boolean
}

export interface UsageStatsResponse {
  currentPeriodStart: number
  currentPeriodEnd: number
  totalMinutesUsed: number
  maxMinutesAllowed: number | null
  totalMeetings: number
  maxMeetingsPerWeek: number | null
  aiCostThisPeriod: number
  maxAiCostAllowed: number
  remainingBudget: number
  budgetUsagePercent: number
}

export interface CanStartMeetingRequest {
  estimatedDurationMinutes: number
  estimatedAiCost?: number
}

export interface CanStartMeetingResponse {
  canStart: boolean
  reason?: string
  suggestions?: string[]
}

// ============================================================================
// LEMON SQUEEZY WEBHOOK TYPES
// ============================================================================

export interface LemonSqueezyWebhook {
  meta: {
    event_name: string
    custom_data?: {
      user_id?: string
    }
  }
  data: {
    id: string
    type: string
    attributes: {
      store_id: number
      customer_id: number
      order_id: number
      order_item_id: number
      product_id: number
      variant_id: number
      product_name: string
      variant_name: string
      user_name: string
      user_email: string
      status: string
      status_formatted: string
      card_brand: string | null
      card_last_four: string | null
      pause: any | null
      cancelled: boolean
      trial_ends_at: string | null
      billing_anchor: number
      first_subscription_item: any
      urls: {
        update_payment_method: string
        customer_portal: string
      }
      renews_at: string
      ends_at: string | null
      created_at: string
      updated_at: string
      test_mode: boolean
    }
  }
}

// ============================================================================
// ERROR TYPES
// ============================================================================

export class ApiError extends Error {
  statusCode: number
  isOperational: boolean

  constructor(message: string, statusCode: number, isOperational = true) {
    super(message)
    this.statusCode = statusCode
    this.isOperational = isOperational
    Error.captureStackTrace(this, this.constructor)
  }
}

export class ValidationError extends ApiError {
  constructor(message: string) {
    super(message, 400)
  }
}

export class AuthenticationError extends ApiError {
  constructor(message: string = 'Authentication required') {
    super(message, 401)
  }
}

export class ForbiddenError extends ApiError {
  constructor(message: string = 'Access forbidden') {
    super(message, 403)
  }
}

export class NotFoundError extends ApiError {
  constructor(message: string = 'Resource not found') {
    super(message, 404)
  }
}

export class ProfitSafetyError extends ApiError {
  constructor(message: string = 'AI budget exceeded for this billing period') {
    super(message, 402) // Payment Required
  }
}
