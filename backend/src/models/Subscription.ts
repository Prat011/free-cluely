/**
 * Horalix Halo Backend - Subscription Model
 */

import { db } from '../database/db'
import { Subscription, SubscriptionStatus } from '../types'
import { PlanId, BillingInterval } from '@shared/plans'

// ============================================================================
// SUBSCRIPTION MODEL
// ============================================================================

export class SubscriptionModel {
  /**
   * Create a new subscription
   */
  static create(params: {
    userId: string
    provider: 'lemonsqueezy'
    providerSubscriptionId: string
    planId: PlanId
    status: SubscriptionStatus
    billingInterval: BillingInterval
    renewAt?: number
    cancelAt?: number
  }): Subscription {
    const now = Date.now()
    const id = `sub_${now}_${Math.random().toString(36).slice(2)}`

    const stmt = db.prepare(`
      INSERT INTO subscriptions (
        id, userId, provider, providerSubscriptionId, planId, status,
        billingInterval, renewAt, cancelAt, createdAt, updatedAt
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    stmt.run(
      id,
      params.userId,
      params.provider,
      params.providerSubscriptionId,
      params.planId,
      params.status,
      params.billingInterval,
      params.renewAt || null,
      params.cancelAt || null,
      now,
      now
    )

    return this.findById(id)!
  }

  /**
   * Find subscription by ID
   */
  static findById(id: string): Subscription | null {
    const stmt = db.prepare('SELECT * FROM subscriptions WHERE id = ?')
    return stmt.get(id) as Subscription | null
  }

  /**
   * Find subscription by provider subscription ID
   */
  static findByProviderSubscriptionId(
    providerSubscriptionId: string
  ): Subscription | null {
    const stmt = db.prepare(
      'SELECT * FROM subscriptions WHERE providerSubscriptionId = ?'
    )
    return stmt.get(providerSubscriptionId) as Subscription | null
  }

  /**
   * Find active subscription for a user
   */
  static findActiveByUserId(userId: string): Subscription | null {
    const stmt = db.prepare(`
      SELECT * FROM subscriptions
      WHERE userId = ? AND status = 'active'
      ORDER BY createdAt DESC
      LIMIT 1
    `)
    return stmt.get(userId) as Subscription | null
  }

  /**
   * Find all subscriptions for a user
   */
  static findAllByUserId(userId: string): Subscription[] {
    const stmt = db.prepare(`
      SELECT * FROM subscriptions
      WHERE userId = ?
      ORDER BY createdAt DESC
    `)
    return stmt.all(userId) as Subscription[]
  }

  /**
   * Update subscription status
   */
  static updateStatus(
    subscriptionId: string,
    status: SubscriptionStatus
  ): Subscription {
    const stmt = db.prepare(`
      UPDATE subscriptions
      SET status = ?, updatedAt = ?
      WHERE id = ?
    `)

    stmt.run(status, Date.now(), subscriptionId)

    return this.findById(subscriptionId)!
  }

  /**
   * Update subscription
   */
  static update(
    subscriptionId: string,
    updates: Partial<Omit<Subscription, 'id' | 'createdAt'>>
  ): Subscription {
    const allowedFields = [
      'status',
      'planId',
      'billingInterval',
      'renewAt',
      'cancelAt',
    ]

    const fields = Object.keys(updates).filter((key) =>
      allowedFields.includes(key)
    )

    if (fields.length === 0) {
      return this.findById(subscriptionId)!
    }

    const setClause = fields.map((field) => `${field} = ?`).join(', ')
    const values = fields.map((field) => updates[field as keyof typeof updates])

    const stmt = db.prepare(`
      UPDATE subscriptions
      SET ${setClause}, updatedAt = ?
      WHERE id = ?
    `)

    stmt.run(...values, Date.now(), subscriptionId)

    return this.findById(subscriptionId)!
  }

  /**
   * Cancel subscription
   */
  static cancel(subscriptionId: string, cancelAt?: number): Subscription {
    return this.update(subscriptionId, {
      status: 'canceled',
      cancelAt: cancelAt || Date.now(),
    })
  }

  /**
   * Delete subscription
   */
  static delete(subscriptionId: string): boolean {
    const stmt = db.prepare('DELETE FROM subscriptions WHERE id = ?')
    const result = stmt.run(subscriptionId)
    return result.changes > 0
  }

  /**
   * Get all active subscriptions (for admin/monitoring)
   */
  static getAllActive(): Subscription[] {
    const stmt = db.prepare(`
      SELECT * FROM subscriptions
      WHERE status = 'active'
      ORDER BY createdAt DESC
    `)
    return stmt.all() as Subscription[]
  }

  /**
   * Count total subscriptions
   */
  static count(): number {
    const stmt = db.prepare('SELECT COUNT(*) as count FROM subscriptions')
    const result = stmt.get() as { count: number }
    return result.count
  }

  /**
   * Count active subscriptions
   */
  static countActive(): number {
    const stmt = db.prepare(
      "SELECT COUNT(*) as count FROM subscriptions WHERE status = 'active'"
    )
    const result = stmt.get() as { count: number }
    return result.count
  }
}

export default SubscriptionModel
