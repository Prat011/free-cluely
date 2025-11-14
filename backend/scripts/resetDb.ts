/**
 * Horalix Halo Backend - Database Reset Script
 *
 * WARNING: This will delete all data!
 * Only use in development.
 */

import dotenv from 'dotenv'
import path from 'path'
import readline from 'readline'

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') })

import { resetDatabase } from '../src/database/schema'

// ============================================================================
// CONFIRMATION PROMPT
// ============================================================================

function askQuestion(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise((resolve) =>
    rl.question(query, (answer) => {
      rl.close()
      resolve(answer)
    })
  )
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('⚠️  DATABASE RESET SCRIPT')
  console.log('================================')
  console.log('')
  console.log('This will DELETE ALL DATA in the database!')
  console.log('This action CANNOT be undone.')
  console.log('')

  if (process.env.NODE_ENV === 'production') {
    console.error('❌ Cannot run in production mode!')
    process.exit(1)
  }

  const answer = await askQuestion('Are you sure you want to continue? (yes/no): ')

  if (answer.toLowerCase() !== 'yes') {
    console.log('❌ Aborted.')
    process.exit(0)
  }

  console.log('')
  console.log('🗑️  Resetting database...')

  try {
    resetDatabase()
    console.log('✅ Database reset successfully!')
    console.log('')
    console.log('The database is now empty and ready to use.')
  } catch (error) {
    console.error('❌ Error resetting database:', error)
    process.exit(1)
  }

  process.exit(0)
}

main()
