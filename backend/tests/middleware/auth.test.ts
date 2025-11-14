/**
 * Horalix Halo Backend - Auth Middleware Tests
 *
 * Unit tests for authentication middleware and token generation
 */

import { describe, it, expect, beforeAll } from '@jest/globals'
import { generateToken, verifyToken } from '../../src/middleware/auth'
import jwt from 'jsonwebtoken'

// Set JWT_SECRET for tests
process.env.JWT_SECRET = 'test_jwt_secret_key_for_testing_only'

describe('Auth Middleware', () => {
  describe('generateToken', () => {
    it('should generate a valid JWT token', () => {
      const userId = 'user_12345'
      const token = generateToken(userId)

      expect(token).toBeDefined()
      expect(typeof token).toBe('string')
      expect(token.split('.')).toHaveLength(3) // JWT has 3 parts
    })

    it('should include userId in token payload', () => {
      const userId = 'user_12345'
      const token = generateToken(userId)

      const decoded: any = jwt.verify(token, process.env.JWT_SECRET!)
      expect(decoded.userId).toBe(userId)
    })

    it('should set default expiration to 30 days', () => {
      const userId = 'user_12345'
      const token = generateToken(userId)

      const decoded: any = jwt.verify(token, process.env.JWT_SECRET!)
      const now = Math.floor(Date.now() / 1000)
      const thirtyDays = 30 * 24 * 60 * 60

      // Token should expire in approximately 30 days
      expect(decoded.exp).toBeGreaterThan(now + thirtyDays - 60) // Allow 1 min margin
      expect(decoded.exp).toBeLessThan(now + thirtyDays + 60)
    })

    it('should allow custom expiration time', () => {
      const userId = 'user_12345'
      const token = generateToken(userId, '1h')

      const decoded: any = jwt.verify(token, process.env.JWT_SECRET!)
      const now = Math.floor(Date.now() / 1000)
      const oneHour = 60 * 60

      // Token should expire in approximately 1 hour
      expect(decoded.exp).toBeGreaterThan(now + oneHour - 60)
      expect(decoded.exp).toBeLessThan(now + oneHour + 60)
    })

    it('should generate different tokens for different users', () => {
      const token1 = generateToken('user_1')
      const token2 = generateToken('user_2')

      expect(token1).not.toBe(token2)
    })

    it('should generate different tokens for same user (due to iat)', (done) => {
      const userId = 'user_12345'
      const token1 = generateToken(userId)

      // Wait 1 second to ensure different iat
      setTimeout(() => {
        const token2 = generateToken(userId)
        expect(token1).not.toBe(token2)
        done()
      }, 1000)
    })
  })

  describe('verifyToken', () => {
    it('should verify valid token', () => {
      const userId = 'user_12345'
      const token = generateToken(userId)

      const decoded = verifyToken(token)
      expect(decoded).toBeDefined()
      expect(decoded.userId).toBe(userId)
    })

    it('should throw error for invalid token', () => {
      expect(() => {
        verifyToken('invalid_token')
      }).toThrow()
    })

    it('should throw error for token with wrong secret', () => {
      const token = jwt.sign({ userId: 'user_12345' }, 'wrong_secret', { expiresIn: '30d' })

      expect(() => {
        verifyToken(token)
      }).toThrow()
    })

    it('should throw error for expired token', () => {
      const userId = 'user_12345'
      const token = jwt.sign({ userId }, process.env.JWT_SECRET!, { expiresIn: '0s' })

      // Wait for token to expire
      setTimeout(() => {
        expect(() => {
          verifyToken(token)
        }).toThrow()
      }, 100)
    })

    it('should throw error for malformed token', () => {
      expect(() => {
        verifyToken('not.a.token')
      }).toThrow()

      expect(() => {
        verifyToken('header.payload') // Missing signature
      }).toThrow()
    })
  })

  describe('token security', () => {
    it('should not expose secret in token', () => {
      const userId = 'user_12345'
      const token = generateToken(userId)

      // Decode without verification to check payload
      const parts = token.split('.')
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString())

      expect(payload.userId).toBe(userId)
      expect(payload.secret).toBeUndefined()
      expect(payload).not.toHaveProperty('JWT_SECRET')
    })

    it('should not allow token tampering', () => {
      const userId = 'user_12345'
      const token = generateToken(userId)

      // Try to tamper with the payload
      const parts = token.split('.')
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString())
      payload.userId = 'hacker_12345' // Change userId

      const tamperedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url')
      const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`

      // Verification should fail
      expect(() => {
        verifyToken(tamperedToken)
      }).toThrow()
    })
  })
})
