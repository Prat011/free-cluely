/**
 * Horalix Halo Backend - License Model
 *
 * Manages license keys for automatic access when users purchase
 * Prevents unauthorized access and tracks license usage
 */

import { db } from '../database/db'
import { randomBytes } from 'crypto'

// ============================================================================
// LICENSE MODEL
// ============================================================================

export interface License {
  id: string
  licenseKey: string
  userId: string | null
  planId: 'plus' | 'ultra'
  status: 'active' | 'suspended' | 'expired'
  activatedAt: number | null
  expiresAt: number | null
  maxActivations: number
  currentActivations: number
  metadata: string | null // JSON metadata
  createdAt: number
  updatedAt: number
}

export class LicenseModel {
  /**
   * Generate a unique license key
   */
  static generateLicenseKey(): string {
    const prefix = 'HORALIX'
    const random = randomBytes(16).toString('hex').toUpperCase()
    // Format: HORALIX-XXXX-XXXX-XXXX-XXXX
    return `${prefix}-${random.slice(0, 4)}-${random.slice(4, 8)}-${random.slice(8, 12)}-${random.slice(12, 16)}`
  }

  /**
   * Create a new license
   */
  static create(params: {
    planId: 'plus' | 'ultra'
    userId?: string
    maxActivations?: number
    expiresInDays?: number
    metadata?: Record<string, any>
  }): License {
    const now = Date.now()
    const id = `lic_${now}_${Math.random().toString(36).slice(2)}`
    const licenseKey = this.generateLicenseKey()

    const expiresAt = params.expiresInDays ? now + params.expiresInDays * 24 * 60 * 60 * 1000 : null

    const metadataJson = params.metadata ? JSON.stringify(params.metadata) : null

    const stmt = db.prepare(`
      INSERT INTO licenses (
        id, licenseKey, userId, planId, status,
        activatedAt, expiresAt, maxActivations, currentActivations,
        metadata, createdAt, updatedAt
      )
      VALUES (?, ?, ?, ?, 'active', NULL, ?, ?, 0, ?, ?, ?)
    `)

    stmt.run(
      id,
      licenseKey,
      params.userId || null,
      params.planId,
      expiresAt,
      params.maxActivations || 1,
      metadataJson,
      now,
      now
    )

    return this.findById(id)!
  }

  /**
   * Find license by ID
   */
  static findById(id: string): License | null {
    const stmt = db.prepare('SELECT * FROM licenses WHERE id = ?')
    return stmt.get(id) as License | null
  }

  /**
   * Find license by key
   */
  static findByKey(licenseKey: string): License | null {
    const stmt = db.prepare('SELECT * FROM licenses WHERE licenseKey = ?')
    return stmt.get(licenseKey) as License | null
  }

  /**
   * Find licenses by user ID
   */
  static findByUserId(userId: string): License[] {
    const stmt = db.prepare('SELECT * FROM licenses WHERE userId = ? ORDER BY createdAt DESC')
    return stmt.all(userId) as License[]
  }

  /**
   * Activate a license for a user
   */
  static activate(licenseKey: string, userId: string): License {
    const license = this.findByKey(licenseKey)

    if (!license) {
      throw new Error('Invalid license key')
    }

    if (license.status !== 'active') {
      throw new Error(`License is ${license.status}`)
    }

    if (license.expiresAt && license.expiresAt < Date.now()) {
      throw new Error('License has expired')
    }

    if (license.userId && license.userId !== userId) {
      throw new Error('License is already activated by another user')
    }

    if (license.currentActivations >= license.maxActivations) {
      throw new Error('Maximum activations reached')
    }

    const now = Date.now()

    const stmt = db.prepare(`
      UPDATE licenses
      SET userId = ?, activatedAt = ?, currentActivations = currentActivations + 1, updatedAt = ?
      WHERE id = ?
    `)

    stmt.run(userId, now, now, license.id)

    return this.findById(license.id)!
  }

  /**
   * Deactivate a license
   */
  static deactivate(licenseKey: string): License {
    const license = this.findByKey(licenseKey)

    if (!license) {
      throw new Error('Invalid license key')
    }

    const now = Date.now()

    const stmt = db.prepare(`
      UPDATE licenses
      SET currentActivations = GREATEST(0, currentActivations - 1), updatedAt = ?
      WHERE id = ?
    `)

    stmt.run(now, license.id)

    return this.findById(license.id)!
  }

  /**
   * Suspend a license
   */
  static suspend(licenseKey: string): License {
    const license = this.findByKey(licenseKey)

    if (!license) {
      throw new Error('Invalid license key')
    }

    const now = Date.now()

    const stmt = db.prepare(`
      UPDATE licenses
      SET status = 'suspended', updatedAt = ?
      WHERE id = ?
    `)

    stmt.run(now, license.id)

    return this.findById(license.id)!
  }

  /**
   * Reactivate a suspended license
   */
  static reactivate(licenseKey: string): License {
    const license = this.findByKey(licenseKey)

    if (!license) {
      throw new Error('Invalid license key')
    }

    const now = Date.now()

    const stmt = db.prepare(`
      UPDATE licenses
      SET status = 'active', updatedAt = ?
      WHERE id = ?
    `)

    stmt.run(now, license.id)

    return this.findById(license.id)!
  }

  /**
   * Check if a license is valid and active
   */
  static isValid(licenseKey: string): boolean {
    const license = this.findByKey(licenseKey)

    if (!license) {
      return false
    }

    if (license.status !== 'active') {
      return false
    }

    if (license.expiresAt && license.expiresAt < Date.now()) {
      return false
    }

    return true
  }

  /**
   * Get active license for a user and plan
   */
  static getActiveLicense(userId: string, planId: 'plus' | 'ultra'): License | null {
    const stmt = db.prepare(`
      SELECT * FROM licenses
      WHERE userId = ? AND planId = ? AND status = 'active'
      AND (expiresAt IS NULL OR expiresAt > ?)
      ORDER BY createdAt DESC
      LIMIT 1
    `)

    return stmt.get(userId, planId, Date.now()) as License | null
  }

  /**
   * Extend license expiration
   */
  static extend(licenseKey: string, days: number): License {
    const license = this.findByKey(licenseKey)

    if (!license) {
      throw new Error('Invalid license key')
    }

    const now = Date.now()
    const extension = days * 24 * 60 * 60 * 1000

    let newExpiresAt: number
    if (license.expiresAt) {
      // Extend from current expiry
      newExpiresAt = license.expiresAt + extension
    } else {
      // Set new expiry from now
      newExpiresAt = now + extension
    }

    const stmt = db.prepare(`
      UPDATE licenses
      SET expiresAt = ?, updatedAt = ?
      WHERE id = ?
    `)

    stmt.run(newExpiresAt, now, license.id)

    return this.findById(license.id)!
  }

  /**
   * Delete a license
   */
  static delete(id: string): boolean {
    const stmt = db.prepare('DELETE FROM licenses WHERE id = ?')
    const result = stmt.run(id)
    return result.changes > 0
  }

  /**
   * Count total licenses
   */
  static count(): number {
    const stmt = db.prepare('SELECT COUNT(*) as count FROM licenses')
    const result = stmt.get() as { count: number }
    return result.count
  }

  /**
   * Get revenue stats
   */
  static getRevenueStats(): {
    totalLicenses: number
    activeLicenses: number
    plusLicenses: number
    ultraLicenses: number
  } {
    const total = db.prepare('SELECT COUNT(*) as count FROM licenses').get() as { count: number }

    const active = db.prepare("SELECT COUNT(*) as count FROM licenses WHERE status = 'active'").get() as {
      count: number
    }

    const plus = db.prepare("SELECT COUNT(*) as count FROM licenses WHERE planId = 'plus'").get() as {
      count: number
    }

    const ultra = db.prepare("SELECT COUNT(*) as count FROM licenses WHERE planId = 'ultra'").get() as {
      count: number
    }

    return {
      totalLicenses: total.count,
      activeLicenses: active.count,
      plusLicenses: plus.count,
      ultraLicenses: ultra.count,
    }
  }
}

export default LicenseModel
