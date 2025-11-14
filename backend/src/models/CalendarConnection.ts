/**
 * Horalix Halo Backend - Calendar Connection Model
 */

import { db } from "../database/db"

export interface CalendarConnection {
  id: string
  userId: string
  provider: "google" | "outlook" | "apple"
  accessToken: string
  refreshToken: string
  expiresAt: number
  createdAt: number
  updatedAt: number
}

export class CalendarConnectionModel {
  /**
   * Create a new calendar connection
   */
  static create(data: {
    userId: string
    provider: "google" | "outlook" | "apple"
    accessToken: string
    refreshToken: string
    expiresAt: number
  }): CalendarConnection {
    const id = `cal_${Date.now()}_${Math.random().toString(36).slice(2)}`
    const now = Date.now()

    const stmt = db.prepare(`
      INSERT INTO calendar_connections (id, userId, provider, accessToken, refreshToken, expiresAt, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)

    stmt.run(
      id,
      data.userId,
      data.provider,
      data.accessToken,
      data.refreshToken,
      data.expiresAt,
      now,
      now
    )

    return {
      id,
      ...data,
      createdAt: now,
      updatedAt: now,
    }
  }

  /**
   * Find calendar connection by user ID and provider
   */
  static findByUserAndProvider(
    userId: string,
    provider: "google" | "outlook" | "apple"
  ): CalendarConnection | null {
    const stmt = db.prepare(`
      SELECT * FROM calendar_connections
      WHERE userId = ? AND provider = ?
    `)

    return stmt.get(userId, provider) as CalendarConnection | null
  }

  /**
   * Find all calendar connections for a user
   */
  static findByUserId(userId: string): CalendarConnection[] {
    const stmt = db.prepare(`
      SELECT * FROM calendar_connections
      WHERE userId = ?
    `)

    return stmt.all(userId) as CalendarConnection[]
  }

  /**
   * Update access token
   */
  static updateTokens(
    id: string,
    accessToken: string,
    refreshToken: string,
    expiresAt: number
  ): void {
    const stmt = db.prepare(`
      UPDATE calendar_connections
      SET accessToken = ?, refreshToken = ?, expiresAt = ?, updatedAt = ?
      WHERE id = ?
    `)

    stmt.run(accessToken, refreshToken, expiresAt, Date.now(), id)
  }

  /**
   * Delete a calendar connection
   */
  static delete(id: string): void {
    const stmt = db.prepare(`
      DELETE FROM calendar_connections
      WHERE id = ?
    `)

    stmt.run(id)
  }

  /**
   * Check if token is expired
   */
  static isTokenExpired(connection: CalendarConnection): boolean {
    return connection.expiresAt <= Date.now()
  }
}
