/**
 * Horalix Halo Backend - Knowledge Document Model
 *
 * Manages uploaded documents for custom knowledge feature (Ultra tier)
 */

import { db } from '../database/db'
import { KnowledgeDocument } from '../types'

// ============================================================================
// KNOWLEDGE DOCUMENT MODEL
// ============================================================================

export class KnowledgeDocumentModel {
  /**
   * Create a new knowledge document record
   */
  static create(params: {
    userId: string
    filename: string
    originalFilename: string
    fileType: string
    fileSize: number
    filePath: string
  }): KnowledgeDocument {
    const now = Date.now()
    const id = `doc_${now}_${Math.random().toString(36).slice(2)}`

    const stmt = db.prepare(`
      INSERT INTO knowledge_documents (
        id, userId, filename, originalFilename, fileType, fileSize,
        filePath, extractedText, metadata, isProcessed, processingError,
        createdAt, updatedAt
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, 0, NULL, ?, ?)
    `)

    stmt.run(
      id,
      params.userId,
      params.filename,
      params.originalFilename,
      params.fileType,
      params.fileSize,
      params.filePath,
      now,
      now
    )

    return this.findById(id)!
  }

  /**
   * Find document by ID
   */
  static findById(id: string): KnowledgeDocument | null {
    const stmt = db.prepare('SELECT * FROM knowledge_documents WHERE id = ?')
    return stmt.get(id) as KnowledgeDocument | null
  }

  /**
   * Find all documents for a user
   */
  static findByUserId(userId: string): KnowledgeDocument[] {
    const stmt = db.prepare(`
      SELECT * FROM knowledge_documents
      WHERE userId = ?
      ORDER BY createdAt DESC
    `)
    return stmt.all(userId) as KnowledgeDocument[]
  }

  /**
   * Find processed documents for a user
   */
  static findProcessedByUserId(userId: string): KnowledgeDocument[] {
    const stmt = db.prepare(`
      SELECT * FROM knowledge_documents
      WHERE userId = ? AND isProcessed = 1
      ORDER BY createdAt DESC
    `)
    return stmt.all(userId) as KnowledgeDocument[]
  }

  /**
   * Find pending documents (not yet processed)
   */
  static findPending(): KnowledgeDocument[] {
    const stmt = db.prepare(`
      SELECT * FROM knowledge_documents
      WHERE isProcessed = 0 AND processingError IS NULL
      ORDER BY createdAt ASC
      LIMIT 100
    `)
    return stmt.all() as KnowledgeDocument[]
  }

  /**
   * Update extracted text and mark as processed
   */
  static updateExtractedText(
    id: string,
    extractedText: string,
    metadata?: Record<string, any>
  ): KnowledgeDocument {
    const now = Date.now()
    const metadataJson = metadata ? JSON.stringify(metadata) : null

    const stmt = db.prepare(`
      UPDATE knowledge_documents
      SET extractedText = ?, metadata = ?, isProcessed = 1,
          processingError = NULL, updatedAt = ?
      WHERE id = ?
    `)

    stmt.run(extractedText, metadataJson, now, id)

    return this.findById(id)!
  }

  /**
   * Mark document processing as failed
   */
  static markProcessingFailed(id: string, error: string): KnowledgeDocument {
    const now = Date.now()

    const stmt = db.prepare(`
      UPDATE knowledge_documents
      SET processingError = ?, isProcessed = 0, updatedAt = ?
      WHERE id = ?
    `)

    stmt.run(error, now, id)

    return this.findById(id)!
  }

  /**
   * Delete document
   */
  static delete(id: string): boolean {
    const stmt = db.prepare('DELETE FROM knowledge_documents WHERE id = ?')
    const result = stmt.run(id)
    return result.changes > 0
  }

  /**
   * Delete all documents for a user
   */
  static deleteByUserId(userId: string): number {
    const stmt = db.prepare('DELETE FROM knowledge_documents WHERE userId = ?')
    const result = stmt.run(userId)
    return result.changes
  }

  /**
   * Count documents for a user
   */
  static countByUserId(userId: string): number {
    const stmt = db.prepare(
      'SELECT COUNT(*) as count FROM knowledge_documents WHERE userId = ?'
    )
    const result = stmt.get(userId) as { count: number }
    return result.count
  }

  /**
   * Count processed documents for a user
   */
  static countProcessedByUserId(userId: string): number {
    const stmt = db.prepare(
      'SELECT COUNT(*) as count FROM knowledge_documents WHERE userId = ? AND isProcessed = 1'
    )
    const result = stmt.get(userId) as { count: number }
    return result.count
  }

  /**
   * Get total storage size for user
   */
  static getTotalSizeByUserId(userId: string): number {
    const stmt = db.prepare(
      'SELECT SUM(fileSize) as totalSize FROM knowledge_documents WHERE userId = ?'
    )
    const result = stmt.get(userId) as { totalSize: number | null }
    return result.totalSize || 0
  }

  /**
   * Search documents by text content
   */
  static searchByText(userId: string, query: string): KnowledgeDocument[] {
    const stmt = db.prepare(`
      SELECT * FROM knowledge_documents
      WHERE userId = ? AND isProcessed = 1
      AND (
        extractedText LIKE ? OR
        originalFilename LIKE ?
      )
      ORDER BY createdAt DESC
      LIMIT 50
    `)

    const searchTerm = `%${query}%`
    return stmt.all(userId, searchTerm, searchTerm) as KnowledgeDocument[]
  }

  /**
   * Get all extracted text for a user (for context injection)
   */
  static getAllExtractedText(userId: string): string {
    const docs = this.findProcessedByUserId(userId)

    return docs
      .map((doc) => {
        const text = doc.extractedText || ''
        return `\n--- Document: ${doc.originalFilename} ---\n${text}`
      })
      .join('\n\n')
  }

  /**
   * Parse metadata from JSON string
   */
  static parseMetadata(doc: KnowledgeDocument): Record<string, any> | null {
    if (!doc.metadata) {
      return null
    }

    try {
      return JSON.parse(doc.metadata)
    } catch (error) {
      console.error('[KnowledgeDocument] Failed to parse metadata:', error)
      return null
    }
  }
}

export default KnowledgeDocumentModel
