/**
 * Horalix Halo Backend - Jest Setup
 *
 * Runs before all tests to set up the test environment
 */

import dotenv from 'dotenv'
import path from 'path'
import { afterAll } from '@jest/globals'

// Load test environment variables
dotenv.config({ path: path.join(__dirname, '../.env.test') })

// Set NODE_ENV to test
process.env.NODE_ENV = 'test'

// Mock console methods to reduce test output noise (optional)
// Uncomment if you want cleaner test output
// global.console = {
//   ...console,
//   log: jest.fn(),
//   debug: jest.fn(),
//   info: jest.fn(),
//   warn: jest.fn(),
// }

// Clean up after all tests
afterAll(async () => {
  // Close any open database connections
  // Close any open server connections
  // Clean up any test data
})
