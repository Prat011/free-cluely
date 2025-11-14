/**
 * Horalix Halo Backend - WebAuthn Credential Model
 *
 * Manages WebAuthn credentials for biometric authentication
 * (Windows Hello, Touch ID, Face ID, fingerprint readers)
 */

import { db } from '../database/db'
import { WebAuthnCredential } from '../types'

// ============================================================================
// WEBAUTHN CREDENTIAL MODEL
// ============================================================================

export class WebAuthnCredentialModel {
  /**
   * Create a new WebAuthn credential
   */
  static create(params: {
    userId: string
    credentialId: string
    publicKey: string
    counter: number
    transports?: string[]
    deviceName?: string
  }): WebAuthnCredential {
    const now = Date.now()
    const id = `webauthn_${now}_${Math.random().toString(36).slice(2)}`

    // Serialize transports to JSON if provided
    const transportsJson = params.transports
      ? JSON.stringify(params.transports)
      : null

    const stmt = db.prepare(`
      INSERT INTO webauthn_credentials (
        id, userId, credentialId, publicKey, counter,
        transports, deviceName, createdAt, lastUsedAt
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)
    `)

    stmt.run(
      id,
      params.userId,
      params.credentialId,
      params.publicKey,
      params.counter,
      transportsJson,
      params.deviceName || null,
      now
    )

    return this.findById(id)!
  }

  /**
   * Find credential by ID
   */
  static findById(id: string): WebAuthnCredential | null {
    const stmt = db.prepare('SELECT * FROM webauthn_credentials WHERE id = ?')
    return stmt.get(id) as WebAuthnCredential | null
  }

  /**
   * Find credential by credentialId
   */
  static findByCredentialId(credentialId: string): WebAuthnCredential | null {
    const stmt = db.prepare(
      'SELECT * FROM webauthn_credentials WHERE credentialId = ?'
    )
    return stmt.get(credentialId) as WebAuthnCredential | null
  }

  /**
   * Find all credentials for a user
   */
  static findByUserId(userId: string): WebAuthnCredential[] {
    const stmt = db.prepare(`
      SELECT * FROM webauthn_credentials
      WHERE userId = ?
      ORDER BY createdAt DESC
    `)
    return stmt.all(userId) as WebAuthnCredential[]
  }

  /**
   * Update credential counter (called after successful authentication)
   */
  static updateCounter(credentialId: string, newCounter: number): WebAuthnCredential {
    const now = Date.now()

    const stmt = db.prepare(`
      UPDATE webauthn_credentials
      SET counter = ?, lastUsedAt = ?
      WHERE credentialId = ?
    `)

    stmt.run(newCounter, now, credentialId)

    return this.findByCredentialId(credentialId)!
  }

  /**
   * Update device name
   */
  static updateDeviceName(id: string, deviceName: string): WebAuthnCredential {
    const stmt = db.prepare(`
      UPDATE webauthn_credentials
      SET deviceName = ?
      WHERE id = ?
    `)

    stmt.run(deviceName, id)

    return this.findById(id)!
  }

  /**
   * Delete credential
   */
  static delete(id: string): boolean {
    const stmt = db.prepare('DELETE FROM webauthn_credentials WHERE id = ?')
    const result = stmt.run(id)
    return result.changes > 0
  }

  /**
   * Delete all credentials for a user
   */
  static deleteByUserId(userId: string): number {
    const stmt = db.prepare('DELETE FROM webauthn_credentials WHERE userId = ?')
    const result = stmt.run(userId)
    return result.changes
  }

  /**
   * Count credentials for a user
   */
  static countByUserId(userId: string): number {
    const stmt = db.prepare(
      'SELECT COUNT(*) as count FROM webauthn_credentials WHERE userId = ?'
    )
    const result = stmt.get(userId) as { count: number }
    return result.count
  }

  /**
   * Check if user has any WebAuthn credentials
   */
  static hasCredentials(userId: string): boolean {
    return this.countByUserId(userId) > 0
  }

  /**
   * Parse transports from JSON string
   */
  static parseTransports(credential: WebAuthnCredential): string[] {
    if (!credential.transports) {
      return []
    }

    try {
      return JSON.parse(credential.transports)
    } catch (error) {
      console.error('[WebAuthn] Failed to parse transports:', error)
      return []
    }
  }

  /**
   * Get credential with parsed transports
   */
  static getCredentialWithTransports(credential: WebAuthnCredential): WebAuthnCredential & { transportsParsed: string[] } {
    return {
      ...credential,
      transportsParsed: this.parseTransports(credential),
    }
  }

  /**
   * Get all credentials for user with parsed transports
   */
  static findByUserIdWithTransports(userId: string): Array<WebAuthnCredential & { transportsParsed: string[] }> {
    const credentials = this.findByUserId(userId)
    return credentials.map(c => this.getCredentialWithTransports(c))
  }
}

export default WebAuthnCredentialModel
