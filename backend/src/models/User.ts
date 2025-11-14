/**
 * Horalix Halo Backend - User Model
 */

import { db } from '../database/db'
import { User } from '../types'
import { PlanId } from '@shared/plans'

// ============================================================================
// USER MODEL
// ============================================================================

export class UserModel {
  /**
   * Create a new user
   */
  static create(email: string, planId: PlanId = 'free'): User {
    const now = Date.now()
    const id = `user_${now}_${Math.random().toString(36).slice(2)}`

    const stmt = db.prepare(`
      INSERT INTO users (id, email, currentPlan, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?)
    `)

    stmt.run(id, email, planId, now, now)

    return this.findById(id)!
  }

  /**
   * Find user by ID
   */
  static findById(id: string): User | null {
    const stmt = db.prepare('SELECT * FROM users WHERE id = ?')
    return stmt.get(id) as User | null
  }

  /**
   * Find user by email
   */
  static findByEmail(email: string): User | null {
    const stmt = db.prepare('SELECT * FROM users WHERE email = ?')
    return stmt.get(email) as User | null
  }

  /**
   * Find or create user by email
   */
  static findOrCreate(email: string): User {
    const existing = this.findByEmail(email)
    if (existing) return existing
    return this.create(email)
  }

  /**
   * Update user's current plan
   */
  static updatePlan(userId: string, planId: PlanId): User {
    const stmt = db.prepare(`
      UPDATE users
      SET currentPlan = ?, updatedAt = ?
      WHERE id = ?
    `)

    stmt.run(planId, Date.now(), userId)

    return this.findById(userId)!
  }

  /**
   * Update user's billing customer ID
   */
  static updateBillingCustomerId(
    userId: string,
    billingCustomerId: string
  ): User {
    const stmt = db.prepare(`
      UPDATE users
      SET billingCustomerId = ?, updatedAt = ?
      WHERE id = ?
    `)

    stmt.run(billingCustomerId, Date.now(), userId)

    return this.findById(userId)!
  }

  /**
   * Record that user started a free trial
   */
  static recordFreeTrialStart(userId: string): User {
    const stmt = db.prepare(`
      UPDATE users
      SET lastFreeTrialStartedAt = ?, updatedAt = ?
      WHERE id = ?
    `)

    stmt.run(Date.now(), Date.now(), userId)

    return this.findById(userId)!
  }

  /**
   * Update user
   */
  static update(
    userId: string,
    updates: Partial<Omit<User, 'id' | 'createdAt'>>
  ): User {
    const allowedFields = [
      'email',
      'currentPlan',
      'billingCustomerId',
      'lastFreeTrialStartedAt',
    ]

    const fields = Object.keys(updates).filter((key) =>
      allowedFields.includes(key)
    )

    if (fields.length === 0) {
      return this.findById(userId)!
    }

    const setClause = fields.map((field) => `${field} = ?`).join(', ')
    const values = fields.map((field) => updates[field as keyof typeof updates])

    const stmt = db.prepare(`
      UPDATE users
      SET ${setClause}, updatedAt = ?
      WHERE id = ?
    `)

    stmt.run(...values, Date.now(), userId)

    return this.findById(userId)!
  }

  /**
   * Delete user (and all related data via CASCADE)
   */
  static delete(userId: string): boolean {
    const stmt = db.prepare('DELETE FROM users WHERE id = ?')
    const result = stmt.run(userId)
    return result.changes > 0
  }

  /**
   * Get all users (admin function)
   */
  static getAll(): User[] {
    const stmt = db.prepare('SELECT * FROM users ORDER BY createdAt DESC')
    return stmt.all() as User[]
  }

  /**
   * Count total users
   */
  static count(): number {
    const stmt = db.prepare('SELECT COUNT(*) as count FROM users')
    const result = stmt.get() as { count: number }
    return result.count
  }
}

export default UserModel
