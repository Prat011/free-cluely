/**
 * Horalix Halo Backend - Meeting Model
 */

import { db } from '../database/db'
import { Meeting } from '../types'

// ============================================================================
// MEETING MODEL
// ============================================================================

export class MeetingModel {
  /**
   * Create a new meeting
   */
  static create(userId: string): Meeting {
    const now = Date.now()
    const id = `meeting_${now}_${Math.random().toString(36).slice(2)}`

    const stmt = db.prepare(`
      INSERT INTO meetings (id, userId, startedAt)
      VALUES (?, ?, ?)
    `)

    stmt.run(id, userId, now)

    return this.findById(id)!
  }

  /**
   * Find meeting by ID
   */
  static findById(id: string): Meeting | null {
    const stmt = db.prepare('SELECT * FROM meetings WHERE id = ?')
    return stmt.get(id) as Meeting | null
  }

  /**
   * Find all meetings for a user
   */
  static findAllByUserId(userId: string): Meeting[] {
    const stmt = db.prepare(`
      SELECT * FROM meetings
      WHERE userId = ?
      ORDER BY startedAt DESC
    `)
    return stmt.all(userId) as Meeting[]
  }

  /**
   * Find meetings within a date range
   */
  static findByDateRange(
    userId: string,
    startDate: number,
    endDate: number
  ): Meeting[] {
    const stmt = db.prepare(`
      SELECT * FROM meetings
      WHERE userId = ?
      AND startedAt >= ?
      AND startedAt <= ?
      ORDER BY startedAt DESC
    `)
    return stmt.all(userId, startDate, endDate) as Meeting[]
  }

  /**
   * End a meeting and calculate duration
   */
  static endMeeting(meetingId: string): Meeting {
    const meeting = this.findById(meetingId)
    if (!meeting) {
      throw new Error('Meeting not found')
    }

    const now = Date.now()
    const durationMinutes = Math.round((now - meeting.startedAt) / 1000 / 60)

    const stmt = db.prepare(`
      UPDATE meetings
      SET endedAt = ?, durationMinutes = ?
      WHERE id = ?
    `)

    stmt.run(now, durationMinutes, meetingId)

    return this.findById(meetingId)!
  }

  /**
   * Update meeting transcript path
   */
  static updateTranscriptPath(meetingId: string, path: string): Meeting {
    const stmt = db.prepare(`
      UPDATE meetings
      SET transcriptPath = ?
      WHERE id = ?
    `)

    stmt.run(path, meetingId)

    return this.findById(meetingId)!
  }

  /**
   * Update meeting recap path
   */
  static updateRecapPath(meetingId: string, path: string): Meeting {
    const stmt = db.prepare(`
      UPDATE meetings
      SET recapPath = ?
      WHERE id = ?
    `)

    stmt.run(path, meetingId)

    return this.findById(meetingId)!
  }

  /**
   * Update meeting
   */
  static update(
    meetingId: string,
    updates: Partial<Omit<Meeting, 'id' | 'userId' | 'startedAt'>>
  ): Meeting {
    const allowedFields = [
      'endedAt',
      'durationMinutes',
      'transcriptPath',
      'recapPath',
    ]

    const fields = Object.keys(updates).filter((key) =>
      allowedFields.includes(key)
    )

    if (fields.length === 0) {
      return this.findById(meetingId)!
    }

    const setClause = fields.map((field) => `${field} = ?`).join(', ')
    const values = fields.map((field) => updates[field as keyof typeof updates])

    const stmt = db.prepare(`
      UPDATE meetings
      SET ${setClause}
      WHERE id = ?
    `)

    stmt.run(...values, meetingId)

    return this.findById(meetingId)!
  }

  /**
   * Delete meeting
   */
  static delete(meetingId: string): boolean {
    const stmt = db.prepare('DELETE FROM meetings WHERE id = ?')
    const result = stmt.run(meetingId)
    return result.changes > 0
  }

  /**
   * Get total minutes used by user in a date range
   */
  static getTotalMinutes(
    userId: string,
    startDate: number,
    endDate: number
  ): number {
    const stmt = db.prepare(`
      SELECT COALESCE(SUM(durationMinutes), 0) as total
      FROM meetings
      WHERE userId = ?
      AND startedAt >= ?
      AND startedAt <= ?
      AND durationMinutes IS NOT NULL
    `)

    const result = stmt.get(userId, startDate, endDate) as { total: number }
    return result.total
  }

  /**
   * Count meetings by user in a date range
   */
  static countByDateRange(
    userId: string,
    startDate: number,
    endDate: number
  ): number {
    const stmt = db.prepare(`
      SELECT COUNT(*) as count
      FROM meetings
      WHERE userId = ?
      AND startedAt >= ?
      AND startedAt <= ?
    `)

    const result = stmt.get(userId, startDate, endDate) as { count: number }
    return result.count
  }

  /**
   * Get active (not ended) meeting for user
   */
  static findActiveMeeting(userId: string): Meeting | null {
    const stmt = db.prepare(`
      SELECT * FROM meetings
      WHERE userId = ?
      AND endedAt IS NULL
      ORDER BY startedAt DESC
      LIMIT 1
    `)
    return stmt.get(userId) as Meeting | null
  }

  /**
   * Count all meetings
   */
  static count(): number {
    const stmt = db.prepare('SELECT COUNT(*) as count FROM meetings')
    const result = stmt.get() as { count: number }
    return result.count
  }

  /**
   * Get recent meetings across all users (admin)
   */
  static getRecent(limit: number = 10): Meeting[] {
    const stmt = db.prepare(`
      SELECT * FROM meetings
      ORDER BY startedAt DESC
      LIMIT ?
    `)
    return stmt.all(limit) as Meeting[]
  }
}

export default MeetingModel
