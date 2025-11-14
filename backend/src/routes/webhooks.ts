/**
 * Horalix Halo Backend - Webhook Routes
 *
 * Handle webhooks from external services (Lemon Squeezy)
 */

import { Router, Request, Response } from 'express'
import { asyncHandler } from '../middleware/errorHandler'
import { processWebhook, verifyWebhookSignature } from '../services/lemonsqueezy'
import { LemonSqueezyWebhook, ValidationError } from '../types'

const router = Router()

// ============================================================================
// POST /api/webhooks/lemonsqueezy - Handle Lemon Squeezy webhooks
// ============================================================================

router.post(
  '/lemonsqueezy',
  asyncHandler(async (req: Request, res: Response) => {
    // Get raw body for signature verification
    // Note: You'll need to configure Express to preserve raw body for this route
    const rawBody = JSON.stringify(req.body)

    // Get signature from header
    const signature = req.headers['x-signature'] as string

    if (!signature) {
      console.warn('⚠️  Webhook received without signature')
      // In production, you should reject webhooks without signatures
      // For development, we'll allow it
      if (process.env.NODE_ENV === 'production') {
        throw new ValidationError('Missing webhook signature')
      }
    }

    // Verify signature
    if (signature) {
      const isValid = verifyWebhookSignature(rawBody, signature)
      if (!isValid) {
        console.error('❌ Invalid webhook signature')
        throw new ValidationError('Invalid webhook signature')
      }
    }

    // Parse webhook payload
    const webhook = req.body as LemonSqueezyWebhook

    // Log webhook event
    console.log('📥 Lemon Squeezy webhook received:', {
      event: webhook.meta.event_name,
      id: webhook.data.id,
      type: webhook.data.type,
    })

    // Process webhook
    try {
      await processWebhook(webhook)

      // Respond with 200 OK
      res.json({
        message: 'Webhook processed successfully',
        event: webhook.meta.event_name,
      })
    } catch (error) {
      console.error('Error processing webhook:', error)

      // Still respond with 200 to prevent Lemon Squeezy from retrying
      // Log the error for manual investigation
      res.json({
        message: 'Webhook received but processing failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  })
)

// ============================================================================
// GET /api/webhooks/test - Test endpoint (development only)
// ============================================================================

if (process.env.NODE_ENV !== 'production') {
  router.get('/test', (req: Request, res: Response) => {
    res.json({
      message: 'Webhook endpoint is working',
      timestamp: Date.now(),
    })
  })

  // POST endpoint to simulate webhook events (development only)
  router.post('/test-event', asyncHandler(async (req: Request, res: Response) => {
    const webhook = req.body as LemonSqueezyWebhook

    console.log('🧪 Test webhook event:', webhook.meta.event_name)

    await processWebhook(webhook)

    res.json({
      message: 'Test webhook processed successfully',
      event: webhook.meta.event_name,
    })
  }))
}

export default router
