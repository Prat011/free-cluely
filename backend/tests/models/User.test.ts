/**
 * Horalix Halo Backend - User Model Tests
 *
 * Unit tests for User model authentication methods
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals'
import UserModel from '../../src/models/User'
import { db } from '../../src/database/db'
import { initializeDatabase } from '../../src/database/schema'

describe('User Model', () => {
  beforeAll(() => {
    // Initialize test database
    initializeDatabase()
  })

  beforeEach(() => {
    // Clean up users table before each test
    db.exec('DELETE FROM users')
  })

  afterAll(() => {
    // Clean up database
    db.close()
  })

  describe('create', () => {
    it('should create a new user with default free plan', () => {
      const email = 'test@example.com'
      const user = UserModel.create(email)

      expect(user).toBeDefined()
      expect(user.email).toBe(email)
      expect(user.currentPlan).toBe('free')
      expect(user.id).toMatch(/^user_/)
      expect(user.createdAt).toBeDefined()
      expect(user.updatedAt).toBeDefined()
    })

    it('should create user with specified plan', () => {
      const email = 'test@example.com'
      const user = UserModel.create(email, 'plus')

      expect(user.currentPlan).toBe('plus')
    })
  })

  describe('findByEmail', () => {
    it('should find user by email', () => {
      const email = 'test@example.com'
      const created = UserModel.create(email)
      const found = UserModel.findByEmail(email)

      expect(found).toBeDefined()
      expect(found?.id).toBe(created.id)
      expect(found?.email).toBe(email)
    })

    it('should return null for non-existent email', () => {
      const found = UserModel.findByEmail('nonexistent@example.com')
      expect(found).toBeNull()
    })
  })

  describe('findOrCreate', () => {
    it('should find existing user', () => {
      const email = 'test@example.com'
      const created = UserModel.create(email)
      const found = UserModel.findOrCreate(email)

      expect(found.id).toBe(created.id)
    })

    it('should create new user if not exists', () => {
      const email = 'new@example.com'
      const user = UserModel.findOrCreate(email)

      expect(user).toBeDefined()
      expect(user.email).toBe(email)
      expect(user.currentPlan).toBe('free')
    })
  })

  describe('createWithPassword', () => {
    it('should create user with hashed password', async () => {
      const email = 'test@example.com'
      const password = 'StrongPassword123!'
      const user = await UserModel.createWithPassword(email, password)

      expect(user).toBeDefined()
      expect(user.email).toBe(email)

      // Check that passwordHash exists (not exposed in User type, but in DB)
      const dbUser: any = UserModel.findById((user as any).id)
      expect(dbUser.passwordHash).toBeDefined()
      expect(dbUser.passwordHash).not.toBe(password) // Should be hashed
      expect(dbUser.isEmailConfirmed).toBe(0)
      expect(dbUser.emailConfirmToken).toBeDefined()
      expect(dbUser.emailConfirmTokenExpires).toBeGreaterThan(Date.now())
    })

    it('should generate different hashes for same password', async () => {
      const password = 'StrongPassword123!'
      const user1 = await UserModel.createWithPassword('user1@example.com', password)
      const user2 = await UserModel.createWithPassword('user2@example.com', password)

      const dbUser1: any = UserModel.findById((user1 as any).id)
      const dbUser2: any = UserModel.findById((user2 as any).id)

      expect(dbUser1.passwordHash).not.toBe(dbUser2.passwordHash)
    })
  })

  describe('verifyPassword', () => {
    it('should verify correct password', async () => {
      const email = 'test@example.com'
      const password = 'StrongPassword123!'
      await UserModel.createWithPassword(email, password)

      const user = await UserModel.verifyPassword(email, password)
      expect(user).toBeDefined()
      expect(user?.email).toBe(email)
    })

    it('should reject incorrect password', async () => {
      const email = 'test@example.com'
      const password = 'StrongPassword123!'
      await UserModel.createWithPassword(email, password)

      const user = await UserModel.verifyPassword(email, 'WrongPassword')
      expect(user).toBeNull()
    })

    it('should return null for non-existent user', async () => {
      const user = await UserModel.verifyPassword('nonexistent@example.com', 'password')
      expect(user).toBeNull()
    })

    it('should return null for user without password', async () => {
      const email = 'test@example.com'
      UserModel.create(email) // Create user without password

      const user = await UserModel.verifyPassword(email, 'password')
      expect(user).toBeNull()
    })
  })

  describe('confirmEmail', () => {
    it('should confirm email with valid token', async () => {
      const email = 'test@example.com'
      const password = 'StrongPassword123!'
      const user = await UserModel.createWithPassword(email, password)

      const dbUser: any = UserModel.findById((user as any).id)
      const token = dbUser.emailConfirmToken

      const confirmedUser = UserModel.confirmEmail(token)
      expect(confirmedUser).toBeDefined()

      const updated: any = UserModel.findById((user as any).id)
      expect(updated.isEmailConfirmed).toBe(1)
      expect(updated.emailConfirmToken).toBeNull()
      expect(updated.emailConfirmTokenExpires).toBeNull()
    })

    it('should return null for invalid token', () => {
      const confirmedUser = UserModel.confirmEmail('invalid_token')
      expect(confirmedUser).toBeNull()
    })

    it('should return null for expired token', async () => {
      const email = 'test@example.com'
      const password = 'StrongPassword123!'
      const user = await UserModel.createWithPassword(email, password)

      // Manually expire the token
      const expiredTime = Date.now() - 1000 // 1 second ago
      db.prepare('UPDATE users SET emailConfirmTokenExpires = ? WHERE id = ?').run(
        expiredTime,
        (user as any).id
      )

      const dbUser: any = UserModel.findById((user as any).id)
      const token = dbUser.emailConfirmToken

      const confirmedUser = UserModel.confirmEmail(token)
      expect(confirmedUser).toBeNull()
    })
  })

  describe('findOrCreateByGoogleId', () => {
    it('should create new user with Google ID', () => {
      const googleId = 'google_123456'
      const email = 'test@example.com'
      const user = UserModel.findOrCreateByGoogleId(googleId, email)

      expect(user).toBeDefined()
      expect(user.email).toBe(email)

      const dbUser: any = user
      expect(dbUser.googleId).toBe(googleId)
      expect(dbUser.isEmailConfirmed).toBe(1) // OAuth users are auto-confirmed
    })

    it('should find existing user by Google ID', () => {
      const googleId = 'google_123456'
      const email = 'test@example.com'
      const created = UserModel.findOrCreateByGoogleId(googleId, email)
      const found = UserModel.findOrCreateByGoogleId(googleId, email)

      expect(found.id).toBe(created.id)
    })

    it('should link Google ID to existing user with same email', () => {
      const email = 'test@example.com'
      const existingUser = UserModel.create(email)

      const googleId = 'google_123456'
      const linkedUser = UserModel.findOrCreateByGoogleId(googleId, email)

      expect(linkedUser.id).toBe(existingUser.id)

      const dbUser: any = linkedUser
      expect(dbUser.googleId).toBe(googleId)
      expect(dbUser.isEmailConfirmed).toBe(1)
    })
  })

  describe('updatePlan', () => {
    it('should update user plan', () => {
      const user = UserModel.create('test@example.com', 'free')
      const updated = UserModel.updatePlan(user.id, 'plus')

      expect(updated.currentPlan).toBe('plus')
    })
  })

  describe('delete', () => {
    it('should delete user', () => {
      const user = UserModel.create('test@example.com')
      const deleted = UserModel.delete(user.id)

      expect(deleted).toBe(true)

      const found = UserModel.findById(user.id)
      expect(found).toBeNull()
    })

    it('should return false for non-existent user', () => {
      const deleted = UserModel.delete('nonexistent_id')
      expect(deleted).toBe(false)
    })
  })

  describe('count', () => {
    it('should count users', () => {
      expect(UserModel.count()).toBe(0)

      UserModel.create('user1@example.com')
      expect(UserModel.count()).toBe(1)

      UserModel.create('user2@example.com')
      expect(UserModel.count()).toBe(2)
    })
  })
})
