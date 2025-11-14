/**
 * Horalix Halo Backend - Database Connection
 *
 * SQLite database connection using better-sqlite3
 */

import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

// ============================================================================
// DATABASE SETUP
// ============================================================================

const DATABASE_PATH =
  process.env.DATABASE_PATH || path.join(__dirname, '../../horalix-backend.db')

// Ensure the directory exists
const dbDir = path.dirname(DATABASE_PATH)
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true })
}

// Initialize database connection
export const db: Database.Database = new Database(DATABASE_PATH, {
  verbose: process.env.NODE_ENV === 'development' ? console.log : undefined,
})

// Enable foreign keys
db.pragma('foreign_keys = ON')

// Enable Write-Ahead Logging for better performance
db.pragma('journal_mode = WAL')

// ============================================================================
// DATABASE HELPERS
// ============================================================================

/**
 * Execute a transaction
 */
export function transaction<T>(fn: () => T): T {
  const txn = db.transaction(fn)
  return txn()
}

/**
 * Close database connection (for graceful shutdown)
 */
export function closeDatabase(): void {
  db.close()
}

/**
 * Get database instance (for direct access when needed)
 */
export function getDatabase(): Database.Database {
  return db
}

// ============================================================================
// GRACEFUL SHUTDOWN
// ============================================================================

process.on('SIGINT', () => {
  console.log('Closing database connection...')
  closeDatabase()
  process.exit(0)
})

process.on('SIGTERM', () => {
  console.log('Closing database connection...')
  closeDatabase()
  process.exit(0)
})

export default db
