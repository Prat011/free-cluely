/**
 * Horalix Halo Backend - AI Usage Model
 */

import { db } from '../database/db'
import { AiUsage } from '../types'
import { calculateRequestCost } from '@shared/aiCost'

// ============================================================================
// AI USAGE MODEL
// ============================================================================

export class AiUsageModel {
  /**
   * Create a new AI usage record
   */
  static create(params: {
    userId: string
    providerId: string
    inputTokens: number
    outputTokens: number
    context: AiUsage['context']
  }): AiUsage {
    const now = Date.now()
    const id = `usage_${now}_${Math.random().toString(36).slice(2)}`

    // Calculate cost
    const costUSD = calculateRequestCost(
      params.providerId,
      params.inputTokens,
      params.outputTokens
    )

    const stmt = db.prepare(`
      INSERT INTO ai_usage (
        id, userId, providerId, inputTokens, outputTokens, costUSD, context, createdAt
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)

    stmt.run(
      id,
      params.userId,
      params.providerId,
      params.inputTokens,
      params.outputTokens,
      costUSD,
      params.context,
      now
    )

    return this.findById(id)!
  }

  /**
   * Find usage record by ID
   */
  static findById(id: string): AiUsage | null {
    const stmt = db.prepare('SELECT * FROM ai_usage WHERE id = ?')
    return stmt.get(id) as AiUsage | null
  }

  /**
   * Find all usage records for a user
   */
  static findAllByUserId(userId: string): AiUsage[] {
    const stmt = db.prepare(`
      SELECT * FROM ai_usage
      WHERE userId = ?
      ORDER BY createdAt DESC
    `)
    return stmt.all(userId) as AiUsage[]
  }

  /**
   * Find usage records within a date range
   */
  static findByDateRange(
    userId: string,
    startDate: number,
    endDate: number
  ): AiUsage[] {
    const stmt = db.prepare(`
      SELECT * FROM ai_usage
      WHERE userId = ?
      AND createdAt >= ?
      AND createdAt <= ?
      ORDER BY createdAt DESC
    `)
    return stmt.all(userId, startDate, endDate) as AiUsage[]
  }

  /**
   * Get total AI cost for user in a date range
   */
  static getTotalCost(
    userId: string,
    startDate: number,
    endDate: number
  ): number {
    const stmt = db.prepare(`
      SELECT COALESCE(SUM(costUSD), 0) as total
      FROM ai_usage
      WHERE userId = ?
      AND createdAt >= ?
      AND createdAt <= ?
    `)

    const result = stmt.get(userId, startDate, endDate) as { total: number }
    return result.total
  }

  /**
   * Get total tokens used by user in a date range
   */
  static getTotalTokens(
    userId: string,
    startDate: number,
    endDate: number
  ): { inputTokens: number; outputTokens: number } {
    const stmt = db.prepare(`
      SELECT
        COALESCE(SUM(inputTokens), 0) as inputTokens,
        COALESCE(SUM(outputTokens), 0) as outputTokens
      FROM ai_usage
      WHERE userId = ?
      AND createdAt >= ?
      AND createdAt <= ?
    `)

    const result = stmt.get(userId, startDate, endDate) as {
      inputTokens: number
      outputTokens: number
    }
    return result
  }

  /**
   * Get usage breakdown by provider
   */
  static getUsageByProvider(
    userId: string,
    startDate: number,
    endDate: number
  ): Array<{
    providerId: string
    totalCost: number
    totalInputTokens: number
    totalOutputTokens: number
    requestCount: number
  }> {
    const stmt = db.prepare(`
      SELECT
        providerId,
        SUM(costUSD) as totalCost,
        SUM(inputTokens) as totalInputTokens,
        SUM(outputTokens) as totalOutputTokens,
        COUNT(*) as requestCount
      FROM ai_usage
      WHERE userId = ?
      AND createdAt >= ?
      AND createdAt <= ?
      GROUP BY providerId
      ORDER BY totalCost DESC
    `)

    return stmt.all(userId, startDate, endDate) as Array<{
      providerId: string
      totalCost: number
      totalInputTokens: number
      totalOutputTokens: number
      requestCount: number
    }>
  }

  /**
   * Get usage breakdown by context
   */
  static getUsageByContext(
    userId: string,
    startDate: number,
    endDate: number
  ): Array<{
    context: string
    totalCost: number
    requestCount: number
  }> {
    const stmt = db.prepare(`
      SELECT
        context,
        SUM(costUSD) as totalCost,
        COUNT(*) as requestCount
      FROM ai_usage
      WHERE userId = ?
      AND createdAt >= ?
      AND createdAt <= ?
      GROUP BY context
      ORDER BY totalCost DESC
    `)

    return stmt.all(userId, startDate, endDate) as Array<{
      context: string
      totalCost: number
      requestCount: number
    }>
  }

  /**
   * Delete usage records
   */
  static delete(usageId: string): boolean {
    const stmt = db.prepare('DELETE FROM ai_usage WHERE id = ?')
    const result = stmt.run(usageId)
    return result.changes > 0
  }

  /**
   * Delete all usage records for a user
   */
  static deleteByUserId(userId: string): number {
    const stmt = db.prepare('DELETE FROM ai_usage WHERE userId = ?')
    const result = stmt.run(userId)
    return result.changes
  }

  /**
   * Count total usage records
   */
  static count(): number {
    const stmt = db.prepare('SELECT COUNT(*) as count FROM ai_usage')
    const result = stmt.get() as { count: number }
    return result.count
  }

  /**
   * Get total cost across all users (admin)
   */
  static getTotalCostAllUsers(): number {
    const stmt = db.prepare('SELECT COALESCE(SUM(costUSD), 0) as total FROM ai_usage')
    const result = stmt.get() as { total: number }
    return result.total
  }

  /**
   * Get top spenders (admin)
   */
  static getTopSpenders(limit: number = 10): Array<{
    userId: string
    totalCost: number
    requestCount: number
  }> {
    const stmt = db.prepare(`
      SELECT
        userId,
        SUM(costUSD) as totalCost,
        COUNT(*) as requestCount
      FROM ai_usage
      GROUP BY userId
      ORDER BY totalCost DESC
      LIMIT ?
    `)

    return stmt.all(limit) as Array<{
      userId: string
      totalCost: number
      requestCount: number
    }>
  }
}

export default AiUsageModel
