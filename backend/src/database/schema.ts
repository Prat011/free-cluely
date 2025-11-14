/**
 * Horalix Halo Backend - Database Schema
 *
 * Creates and initializes all database tables
 */

import { db } from './db'

// ============================================================================
// SCHEMA CREATION
// ============================================================================

export function initializeDatabase(): void {
  console.log('Initializing database schema...')

  // Create Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      passwordHash TEXT,
      isEmailConfirmed INTEGER NOT NULL DEFAULT 0,
      emailConfirmToken TEXT,
      emailConfirmTokenExpires INTEGER,
      googleId TEXT UNIQUE,
      appleId TEXT UNIQUE,
      currentPlan TEXT NOT NULL DEFAULT 'free',
      billingCustomerId TEXT,
      lastFreeTrialStartedAt INTEGER,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    )
  `)

  // Create Subscriptions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      provider TEXT NOT NULL,
      providerSubscriptionId TEXT UNIQUE NOT NULL,
      planId TEXT NOT NULL,
      status TEXT NOT NULL,
      billingInterval TEXT NOT NULL,
      renewAt INTEGER,
      cancelAt INTEGER,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    )
  `)

  // Create Meetings table
  db.exec(`
    CREATE TABLE IF NOT EXISTS meetings (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      startedAt INTEGER NOT NULL,
      endedAt INTEGER,
      durationMinutes INTEGER,
      transcriptPath TEXT,
      recapPath TEXT,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    )
  `)

  // Create AiUsage table
  db.exec(`
    CREATE TABLE IF NOT EXISTS ai_usage (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      providerId TEXT NOT NULL,
      inputTokens INTEGER NOT NULL,
      outputTokens INTEGER NOT NULL,
      costUSD REAL NOT NULL,
      context TEXT NOT NULL,
      createdAt INTEGER NOT NULL,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    )
  `)

  // Create CalendarConnections table
  db.exec(`
    CREATE TABLE IF NOT EXISTS calendar_connections (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      provider TEXT NOT NULL,
      accessToken TEXT NOT NULL,
      refreshToken TEXT NOT NULL,
      expiresAt INTEGER NOT NULL,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    )
  `)

  // Create WebAuthn Credentials table
  db.exec(`
    CREATE TABLE IF NOT EXISTS webauthn_credentials (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      credentialId TEXT UNIQUE NOT NULL,
      publicKey TEXT NOT NULL,
      counter INTEGER NOT NULL DEFAULT 0,
      transports TEXT,
      deviceName TEXT,
      createdAt INTEGER NOT NULL,
      lastUsedAt INTEGER,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    )
  `)

  // Create indexes for better query performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_subscriptions_userId
    ON subscriptions(userId);
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_subscriptions_status
    ON subscriptions(status);
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_meetings_userId
    ON meetings(userId);
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_meetings_startedAt
    ON meetings(startedAt);
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_ai_usage_userId
    ON ai_usage(userId);
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_ai_usage_createdAt
    ON ai_usage(createdAt);
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_ai_usage_userId_createdAt
    ON ai_usage(userId, createdAt);
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_calendar_connections_userId
    ON calendar_connections(userId);
  `)

  console.log('Database schema initialized successfully!')
}

// ============================================================================
// SCHEMA MIGRATIONS (for future use)
// ============================================================================

/**
 * Check database version and run migrations if needed
 */
export function runMigrations(): void {
  // Create a version table if it doesn't exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY,
      appliedAt INTEGER NOT NULL
    )
  `)

  // Get current version
  const currentVersion =
    db.prepare('SELECT MAX(version) as version FROM schema_version').get() as {
      version: number | null
    }

  const version = currentVersion?.version || 0

  console.log(`Current schema version: ${version}`)

  // Migration 1: Add knowledge_documents table
  if (version < 1) {
    console.log('Running migration to version 1: Adding knowledge_documents table...')
    db.exec(`
      CREATE TABLE IF NOT EXISTS knowledge_documents (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        filename TEXT NOT NULL,
        originalFilename TEXT NOT NULL,
        fileType TEXT NOT NULL,
        fileSize INTEGER NOT NULL,
        filePath TEXT NOT NULL,
        extractedText TEXT,
        metadata TEXT,
        isProcessed INTEGER NOT NULL DEFAULT 0,
        processingError TEXT,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
      )
    `)

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_knowledge_documents_userId
      ON knowledge_documents(userId);
    `)

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_knowledge_documents_isProcessed
      ON knowledge_documents(isProcessed);
    `)

    db.prepare('INSERT INTO schema_version (version, appliedAt) VALUES (?, ?)').run(
      1,
      Date.now()
    )
    console.log('Migration to version 1 completed!')
  }
}

// ============================================================================
// DEVELOPMENT HELPERS
// ============================================================================

/**
 * Drop all tables (DANGEROUS - only for development)
 */
export function dropAllTables(): void {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Cannot drop tables in production!')
  }

  console.log('WARNING: Dropping all tables...')
  db.exec('DROP TABLE IF EXISTS calendar_connections')
  db.exec('DROP TABLE IF EXISTS ai_usage')
  db.exec('DROP TABLE IF EXISTS meetings')
  db.exec('DROP TABLE IF EXISTS subscriptions')
  db.exec('DROP TABLE IF EXISTS users')
  db.exec('DROP TABLE IF EXISTS schema_version')
  console.log('All tables dropped!')
}

/**
 * Reset database (drop and recreate)
 */
export function resetDatabase(): void {
  dropAllTables()
  initializeDatabase()
  runMigrations()
}
