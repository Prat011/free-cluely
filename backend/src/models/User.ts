/**
 * Horalix Halo Backend - User Model
 */

import { db } from '../database/db'
import { User } from '../types'
import { PlanId } from '@shared/plans'
import bcrypt from 'bcrypt'
import { randomBytes } from 'crypto'

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

  // ============================================================================
  // AUTHENTICATION METHODS
  // ============================================================================

  /**
   * Create user with password (email/password signup)
   */
  static async createWithPassword(email: string, password: string): Promise<User> {
    const now = Date.now()
    const id = `user_${now}_${Math.random().toString(36).slice(2)}`

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12)

    // Generate email confirmation token
    const emailConfirmToken = randomBytes(32).toString('hex')
    const emailConfirmTokenExpires = now + 24 * 60 * 60 * 1000 // 24 hours

    const stmt = db.prepare(`
      INSERT INTO users (
        id, email, passwordHash, isEmailConfirmed,
        emailConfirmToken, emailConfirmTokenExpires,
        currentPlan, createdAt, updatedAt
      )
      VALUES (?, ?, ?, 0, ?, ?, 'free', ?, ?)
    `)

    stmt.run(id, email, passwordHash, emailConfirmToken, emailConfirmTokenExpires, now, now)

    const user = this.findById(id)!
    return user as any
  }

  /**
   * Verify password
   */
  static async verifyPassword(email: string, password: string): Promise<User | null> {
    const stmt = db.prepare('SELECT * FROM users WHERE email = ?')
    const user = stmt.get(email) as any

    if (!user || !user.passwordHash) {
      return null
    }

    const isValid = await bcrypt.compare(password, user.passwordHash)
    if (!isValid) {
      return null
    }

    return user
  }

  /**
   * Confirm email with token
   */
  static confirmEmail(token: string): User | null {
    const stmt = db.prepare(`
      SELECT * FROM users
      WHERE emailConfirmToken = ?
      AND emailConfirmTokenExpires > ?
    `)

    const user = stmt.get(token, Date.now()) as any

    if (!user) {
      return null
    }

    // Mark email as confirmed
    const updateStmt = db.prepare(`
      UPDATE users
      SET isEmailConfirmed = 1,
          emailConfirmToken = NULL,
          emailConfirmTokenExpires = NULL,
          updatedAt = ?
      WHERE id = ?
    `)

    updateStmt.run(Date.now(), user.id)

    return this.findById(user.id)!
  }

  /**
   * Generate new email confirmation token
   */
  static generateEmailConfirmToken(userId: string): string {
    const token = randomBytes(32).toString('hex')
    const expires = Date.now() + 24 * 60 * 60 * 1000 // 24 hours

    const stmt = db.prepare(`
      UPDATE users
      SET emailConfirmToken = ?,
          emailConfirmTokenExpires = ?,
          updatedAt = ?
      WHERE id = ?
    `)

    stmt.run(token, expires, Date.now(), userId)

    return token
  }

  /**
   * Generate password reset token
   */
  static generatePasswordResetToken(email: string): string | null {
    const user = this.findByEmail(email)
    if (!user) {
      return null
    }

    const token = randomBytes(32).toString('hex')
    const expires = Date.now() + 60 * 60 * 1000 // 1 hour

    const stmt = db.prepare(`
      UPDATE users
      SET emailConfirmToken = ?,
          emailConfirmTokenExpires = ?,
          updatedAt = ?
      WHERE id = ?
    `)

    stmt.run(token, expires, Date.now(), (user as any).id)

    return token
  }

  /**
   * Reset password with token
   */
  static async resetPassword(token: string, newPassword: string): Promise<User | null> {
    const stmt = db.prepare(`
      SELECT * FROM users
      WHERE emailConfirmToken = ?
      AND emailConfirmTokenExpires > ?
    `)

    const user = stmt.get(token, Date.now()) as any

    if (!user) {
      return null
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 12)

    // Update password and clear token
    const updateStmt = db.prepare(`
      UPDATE users
      SET passwordHash = ?,
          emailConfirmToken = NULL,
          emailConfirmTokenExpires = NULL,
          updatedAt = ?
      WHERE id = ?
    `)

    updateStmt.run(passwordHash, Date.now(), user.id)

    return this.findById(user.id)!
  }

  /**
   * Find or create user by Google ID
   */
  static findOrCreateByGoogleId(googleId: string, email: string): User {
    // Try to find by Google ID
    let stmt = db.prepare('SELECT * FROM users WHERE googleId = ?')
    let user = stmt.get(googleId) as any

    if (user) {
      return user
    }

    // Try to find by email
    user = this.findByEmail(email) as any

    if (user) {
      // Link Google ID to existing account
      const updateStmt = db.prepare(`
        UPDATE users
        SET googleId = ?, isEmailConfirmed = 1, updatedAt = ?
        WHERE id = ?
      `)
      updateStmt.run(googleId, Date.now(), user.id)
      return this.findById(user.id)!
    }

    // Create new user
    const now = Date.now()
    const id = `user_${now}_${Math.random().toString(36).slice(2)}`

    const insertStmt = db.prepare(`
      INSERT INTO users (
        id, email, googleId, isEmailConfirmed,
        currentPlan, createdAt, updatedAt
      )
      VALUES (?, ?, ?, 1, 'free', ?, ?)
    `)

    insertStmt.run(id, email, googleId, now, now)

    return this.findById(id)!
  }

  /**
   * Find or create user by Apple ID
   */
  static findOrCreateByAppleId(appleId: string, email: string): User {
    // Try to find by Apple ID
    let stmt = db.prepare('SELECT * FROM users WHERE appleId = ?')
    let user = stmt.get(appleId) as any

    if (user) {
      return user
    }

    // Try to find by email
    user = this.findByEmail(email) as any

    if (user) {
      // Link Apple ID to existing account
      const updateStmt = db.prepare(`
        UPDATE users
        SET appleId = ?, isEmailConfirmed = 1, updatedAt = ?
        WHERE id = ?
      `)
      updateStmt.run(appleId, Date.now(), user.id)
      return this.findById(user.id)!
    }

    // Create new user
    const now = Date.now()
    const id = `user_${now}_${Math.random().toString(36).slice(2)}`

    const insertStmt = db.prepare(`
      INSERT INTO users (
        id, email, appleId, isEmailConfirmed,
        currentPlan, createdAt, updatedAt
      )
      VALUES (?, ?, ?, 1, 'free', ?, ?)
    `)

    insertStmt.run(id, email, appleId, now, now)

    return this.findById(id)!
  }
}

export default UserModel
