/**
 * Horalix Halo Backend - Authentication Middleware
 *
 * Simple JWT-based authentication for API requests
 */

import { Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { AuthRequest, AuthenticationError } from '../types'
import UserModel from '../models/User'

// ============================================================================
// JWT CONFIGURATION
// ============================================================================

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production'

if (!process.env.JWT_SECRET) {
  console.warn(
    '⚠️  WARNING: JWT_SECRET not set in environment variables. Using default (INSECURE!)'
  )
}

// ============================================================================
// TOKEN GENERATION
// ============================================================================

/**
 * Generate JWT token for a user
 */
export function generateToken(userId: string, expiresIn: string = '30d'): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn })
}

/**
 * Verify JWT token and extract user ID
 */
export function verifyToken(token: string): { userId: string } {
  try {
    return jwt.verify(token, JWT_SECRET) as { userId: string }
  } catch (error) {
    throw new AuthenticationError('Invalid or expired token')
  }
}

// ============================================================================
// AUTHENTICATION MIDDLEWARE
// ============================================================================

/**
 * Middleware to require authentication
 * Extracts token from Authorization header and attaches user to request
 */
export async function requireAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization
    if (!authHeader) {
      throw new AuthenticationError('No authorization header provided')
    }

    // Expected format: "Bearer <token>"
    const parts = authHeader.split(' ')
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      throw new AuthenticationError('Invalid authorization header format. Expected: Bearer <token>')
    }

    const token = parts[1]

    // Verify token and extract user ID
    const { userId } = verifyToken(token)

    // Load user from database
    const user = UserModel.findById(userId)
    if (!user) {
      throw new AuthenticationError('User not found')
    }

    // Attach user to request
    req.userId = userId
    req.user = user

    next()
  } catch (error) {
    next(error)
  }
}

/**
 * Optional authentication middleware
 * Attaches user to request if token is provided, but doesn't require it
 */
export async function optionalAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader) {
      return next()
    }

    const parts = authHeader.split(' ')
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return next()
    }

    const token = parts[1]
    const { userId } = verifyToken(token)

    const user = UserModel.findById(userId)
    if (user) {
      req.userId = userId
      req.user = user
    }

    next()
  } catch (error) {
    // Ignore auth errors in optional mode
    next()
  }
}

// ============================================================================
// DEVELOPMENT HELPERS
// ============================================================================

/**
 * Create a user and generate a token (for development/testing)
 */
export function createUserAndToken(email: string): { user: any; token: string } {
  const user = UserModel.findOrCreate(email)
  const token = generateToken(user.id)
  return { user, token }
}

/**
 * Decode token without verifying (for debugging)
 */
export function decodeToken(token: string): any {
  return jwt.decode(token)
}
