/**
 * Horalix Halo - SessionEngine
 *
 * Manages session persistence with SQLite.
 * Stores sessions, messages, context items, and transcripts.
 */

import Database from "better-sqlite3"
import { app } from "electron"
import path from "path"
import type {
  HaloSession,
  Message,
  ContextItem,
  TranscriptSegment,
  SessionMode,
  SessionStatus,
} from "../../state/StateTypes"

export interface SessionEngineConfig {
  dbPath?: string
  enableWAL?: boolean // Write-Ahead Logging for better performance
  enableForeignKeys?: boolean
}

export interface SessionQuery {
  mode?: SessionMode
  status?: SessionStatus
  searchText?: string
  limit?: number
  offset?: number
  sortBy?: "started_at" | "ended_at" | "name"
  sortOrder?: "asc" | "desc"
}

export interface SessionStats {
  totalSessions: number
  activeSessions: number
  totalMessages: number
  totalContextItems: number
  totalTranscripts: number
  diskUsageMB: number
}

export class SessionEngine {
  private db: Database.Database
  private isInitialized = false

  constructor(private config: SessionEngineConfig = {}) {
    const dbPath =
      config.dbPath ||
      path.join(app.getPath("userData"), "horalix-sessions.db")

    this.db = new Database(dbPath)

    if (config.enableWAL !== false) {
      this.db.pragma("journal_mode = WAL")
    }

    if (config.enableForeignKeys !== false) {
      this.db.pragma("foreign_keys = ON")
    }
  }

  /**
   * Initialize database schema
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return

    // Sessions table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        mode TEXT NOT NULL,
        status TEXT NOT NULL,
        started_at INTEGER NOT NULL,
        ended_at INTEGER,
        paused_at INTEGER,
        metadata TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_sessions_mode ON sessions(mode);
      CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
      CREATE INDEX IF NOT EXISTS idx_sessions_started ON sessions(started_at DESC);
    `)

    // Messages table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        reasoning_content TEXT,
        created_at INTEGER NOT NULL,
        metadata TEXT,
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_messages_role ON messages(role);
    `)

    // Context Items table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS context_items (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        type TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        pinned INTEGER DEFAULT 0,
        data TEXT NOT NULL,
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_context_session ON context_items(session_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_context_type ON context_items(type);
      CREATE INDEX IF NOT EXISTS idx_context_pinned ON context_items(pinned);
    `)

    // Transcript Segments table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS transcript_segments (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        text TEXT NOT NULL,
        start_time INTEGER NOT NULL,
        end_time INTEGER NOT NULL,
        speaker TEXT,
        speaker_name TEXT,
        confidence REAL,
        source TEXT NOT NULL,
        language TEXT,
        is_final INTEGER NOT NULL DEFAULT 1,
        words TEXT,
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_transcript_session ON transcript_segments(session_id, start_time);
      CREATE INDEX IF NOT EXISTS idx_transcript_speaker ON transcript_segments(speaker);
    `)

    // Full-text search for messages
    this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
        message_id,
        content,
        tokenize = 'porter'
      );
    `)

    this.isInitialized = true
    console.log("[SessionEngine] Initialized successfully")
  }

  // ==========================================================================
  // SESSION OPERATIONS
  // ==========================================================================

  /**
   * Create a new session
   */
  createSession(session: HaloSession): void {
    const stmt = this.db.prepare(`
      INSERT INTO sessions (
        id, name, mode, status, started_at, ended_at, paused_at, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)

    stmt.run(
      session.id,
      session.name,
      session.mode,
      session.status,
      session.startedAt,
      session.endedAt || null,
      session.pausedAt || null,
      session.metadata ? JSON.stringify(session.metadata) : null
    )
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): HaloSession | null {
    const stmt = this.db.prepare("SELECT * FROM sessions WHERE id = ?")
    const row = stmt.get(sessionId) as any

    if (!row) return null

    return this.rowToSession(row)
  }

  /**
   * Update session
   */
  updateSession(
    sessionId: string,
    updates: Partial<HaloSession>
  ): void {
    const fields: string[] = []
    const values: any[] = []

    if (updates.name !== undefined) {
      fields.push("name = ?")
      values.push(updates.name)
    }
    if (updates.mode !== undefined) {
      fields.push("mode = ?")
      values.push(updates.mode)
    }
    if (updates.status !== undefined) {
      fields.push("status = ?")
      values.push(updates.status)
    }
    if (updates.endedAt !== undefined) {
      fields.push("ended_at = ?")
      values.push(updates.endedAt)
    }
    if (updates.pausedAt !== undefined) {
      fields.push("paused_at = ?")
      values.push(updates.pausedAt)
    }
    if (updates.metadata !== undefined) {
      fields.push("metadata = ?")
      values.push(JSON.stringify(updates.metadata))
    }

    if (fields.length === 0) {
      return // No updates to apply
    }

    values.push(sessionId)

    const stmt = this.db.prepare(`
      UPDATE sessions
      SET ${fields.join(", ")}
      WHERE id = ?
    `)

    stmt.run(...values)
  }

  /**
   * Delete session (cascades to all related data)
   */
  deleteSession(sessionId: string): void {
    const stmt = this.db.prepare("DELETE FROM sessions WHERE id = ?")
    stmt.run(sessionId)
  }

  /**
   * Query sessions
   */
  querySessions(query: SessionQuery = {}): HaloSession[] {
    let sql = "SELECT * FROM sessions WHERE 1=1"
    const params: any[] = []

    if (query.mode) {
      sql += " AND mode = ?"
      params.push(query.mode)
    }

    if (query.status) {
      sql += " AND status = ?"
      params.push(query.status)
    }

    if (query.searchText) {
      sql += " AND (name LIKE ? OR metadata LIKE ?)"
      const searchPattern = `%${query.searchText}%`
      params.push(searchPattern, searchPattern)
    }

    // Sorting
    const sortBy = query.sortBy || "started_at"
    const sortOrder = query.sortOrder || "desc"
    sql += ` ORDER BY ${sortBy} ${sortOrder}`

    // Pagination
    if (query.limit) {
      sql += " LIMIT ?"
      params.push(query.limit)
    }

    if (query.offset) {
      sql += " OFFSET ?"
      params.push(query.offset)
    }

    const stmt = this.db.prepare(sql)
    const rows = stmt.all(...params) as any[]

    return rows.map((row) => this.rowToSession(row))
  }

  /**
   * Get recent sessions
   */
  getRecentSessions(limit = 10): HaloSession[] {
    return this.querySessions({
      sortBy: "started_at",
      sortOrder: "desc",
      limit,
    })
  }

  // ==========================================================================
  // MESSAGE OPERATIONS
  // ==========================================================================

  /**
   * Add message to session
   */
  addMessage(message: Message): void {
    const stmt = this.db.prepare(`
      INSERT INTO messages (
        id, session_id, role, content, reasoning_content, created_at, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `)

    stmt.run(
      message.id,
      message.sessionId,
      message.role,
      message.content,
      message.reasoningContent || null,
      message.createdAt,
      message.metadata ? JSON.stringify(message.metadata) : null
    )

    // Add to FTS index
    const ftsStmt = this.db.prepare(`
      INSERT INTO messages_fts (message_id, content)
      VALUES (?, ?)
    `)
    ftsStmt.run(message.id, message.content)

    // Update session updated_at
    this.updateSession(message.sessionId, {})
  }

  /**
   * Get messages for session
   */
  getMessages(sessionId: string, limit?: number): Message[] {
    let sql = "SELECT * FROM messages WHERE session_id = ? ORDER BY created_at"

    if (limit) {
      sql += " LIMIT ?"
    }

    const stmt = this.db.prepare(sql)
    const rows = limit
      ? stmt.all(sessionId, limit)
      : stmt.all(sessionId)

    return (rows as any[]).map((row) => this.rowToMessage(row))
  }

  /**
   * Search messages across all sessions
   */
  searchMessages(searchText: string, limit = 50): Message[] {
    const stmt = this.db.prepare(`
      SELECT m.* FROM messages m
      JOIN messages_fts fts ON m.id = fts.message_id
      WHERE messages_fts MATCH ?
      ORDER BY m.created_at DESC
      LIMIT ?
    `)

    const rows = stmt.all(searchText, limit) as any[]
    return rows.map((row) => this.rowToMessage(row))
  }

  // ==========================================================================
  // CONTEXT ITEM OPERATIONS
  // ==========================================================================

  /**
   * Add context item
   */
  addContextItem(item: ContextItem): void {
    const stmt = this.db.prepare(`
      INSERT INTO context_items (
        id, session_id, type, created_at, pinned, data
      ) VALUES (?, ?, ?, ?, ?, ?)
    `)

    stmt.run(
      item.id,
      item.sessionId,
      item.type,
      item.createdAt,
      item.pinned ? 1 : 0,
      JSON.stringify(item)
    )
  }

  /**
   * Get context items for session
   */
  getContextItems(sessionId: string): ContextItem[] {
    const stmt = this.db.prepare(`
      SELECT * FROM context_items
      WHERE session_id = ?
      ORDER BY pinned DESC, created_at DESC
    `)

    const rows = stmt.all(sessionId) as any[]
    return rows.map((row) => this.rowToContextItem(row))
  }

  /**
   * Update context item (e.g., pin/unpin)
   */
  updateContextItem(itemId: string, updates: Partial<ContextItem>): void {
    const fields: string[] = []
    const values: any[] = []

    if (updates.pinned !== undefined) {
      fields.push("pinned = ?")
      values.push(updates.pinned ? 1 : 0)
    }

    if (fields.length === 0) return

    values.push(itemId)

    const stmt = this.db.prepare(`
      UPDATE context_items
      SET ${fields.join(", ")}
      WHERE id = ?
    `)

    stmt.run(...values)
  }

  /**
   * Delete context item
   */
  deleteContextItem(itemId: string): void {
    const stmt = this.db.prepare("DELETE FROM context_items WHERE id = ?")
    stmt.run(itemId)
  }

  // ==========================================================================
  // TRANSCRIPT OPERATIONS
  // ==========================================================================

  /**
   * Add transcript segment
   */
  addTranscriptSegment(segment: TranscriptSegment): void {
    const stmt = this.db.prepare(`
      INSERT INTO transcript_segments (
        id, session_id, text, start_time, end_time, speaker, speaker_name, confidence, source, language, is_final, words
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    stmt.run(
      segment.id,
      segment.sessionId,
      segment.text,
      segment.startTime,
      segment.endTime,
      segment.speaker || null,
      segment.speakerName || null,
      segment.confidence || null,
      segment.source,
      segment.language || null,
      segment.isFinal ? 1 : 0,
      segment.words ? JSON.stringify(segment.words) : null
    )
  }

  /**
   * Get transcript segments for session
   */
  getTranscriptSegments(sessionId: string): TranscriptSegment[] {
    const stmt = this.db.prepare(`
      SELECT * FROM transcript_segments
      WHERE session_id = ?
      ORDER BY start_time
    `)

    const rows = stmt.all(sessionId) as any[]
    return rows.map((row) => this.rowToTranscriptSegment(row))
  }

  // ==========================================================================
  // STATISTICS
  // ==========================================================================

  /**
   * Get database statistics
   */
  getStats(): SessionStats {
    const totalSessions = this.db
      .prepare("SELECT COUNT(*) as count FROM sessions")
      .get() as any

    const activeSessions = this.db
      .prepare("SELECT COUNT(*) as count FROM sessions WHERE status = 'active'")
      .get() as any

    const totalMessages = this.db
      .prepare("SELECT COUNT(*) as count FROM messages")
      .get() as any

    const totalContextItems = this.db
      .prepare("SELECT COUNT(*) as count FROM context_items")
      .get() as any

    const totalTranscripts = this.db
      .prepare("SELECT COUNT(*) as count FROM transcript_segments")
      .get() as any

    // Get database file size
    const dbPath = this.db.name
    const fs = require("fs")
    const stats = fs.statSync(dbPath)
    const diskUsageMB = stats.size / (1024 * 1024)

    return {
      totalSessions: totalSessions.count,
      activeSessions: activeSessions.count,
      totalMessages: totalMessages.count,
      totalContextItems: totalContextItems.count,
      totalTranscripts: totalTranscripts.count,
      diskUsageMB: Math.round(diskUsageMB * 100) / 100,
    }
  }

  // ==========================================================================
  // UTILITIES
  // ==========================================================================

  /**
   * Vacuum database (optimize and reclaim space)
   */
  vacuum(): void {
    this.db.exec("VACUUM")
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close()
    this.isInitialized = false
  }

  // ==========================================================================
  // PRIVATE HELPERS
  // ==========================================================================

  private rowToSession(row: any): HaloSession {
    return {
      id: row.id,
      name: row.name,
      mode: row.mode as SessionMode,
      status: row.status as SessionStatus,
      startedAt: row.started_at,
      endedAt: row.ended_at || undefined,
      pausedAt: row.paused_at || undefined,
      contextItemIds: [],
      transcriptSegmentIds: [],
      messageIds: [],
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    }
  }

  private rowToMessage(row: any): Message {
    return {
      id: row.id,
      sessionId: row.session_id,
      role: row.role,
      content: row.content,
      reasoningContent: row.reasoning_content || undefined,
      createdAt: row.created_at,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    }
  }

  private rowToContextItem(row: any): ContextItem {
    return JSON.parse(row.data) as ContextItem
  }

  private rowToTranscriptSegment(row: any): TranscriptSegment {
    return {
      id: row.id,
      sessionId: row.session_id,
      text: row.text,
      startTime: row.start_time,
      endTime: row.end_time,
      speaker: row.speaker || undefined,
      speakerName: row.speaker_name || undefined,
      confidence: row.confidence || undefined,
      source: row.source,
      language: row.language || undefined,
      isFinal: row.is_final === 1,
      words: row.words ? JSON.parse(row.words) : undefined,
    }
  }
}
