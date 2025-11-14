/**
 * Horalix Halo Backend - WebAuthn Biometric Authentication Routes
 *
 * Handles biometric authentication via Windows Hello, Touch ID, Face ID, etc.
 * Uses the @simplewebauthn/server library for WebAuthn protocol implementation
 */

import express from 'express'
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server'
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from '@simplewebauthn/server/script/deps'
import { auth, requireAuth, generateToken } from '../middleware/auth'
import { AuthRequest } from '../types'
import { UserModel } from '../models/User'
import { WebAuthnCredentialModel } from '../models/WebAuthnCredential'

const router = express.Router()

// ============================================================================
// CONFIGURATION
// ============================================================================

const RP_NAME = 'Horalix Halo'
const RP_ID = process.env.WEBAUTHN_RP_ID || 'localhost' // Should be your domain
const ORIGIN = process.env.WEBAUTHN_ORIGIN || 'http://localhost:3000'

// Store challenges temporarily (in production, use Redis or similar)
// Map<userId, challenge>
const registrationChallenges = new Map<string, string>()
const authenticationChallenges = new Map<string, string>()

// ============================================================================
// REGISTRATION ENDPOINTS
// ============================================================================

/**
 * POST /api/auth/webauthn/register-options
 * Generate registration options for WebAuthn credential
 * Requires authentication (user must be logged in)
 */
router.post('/register-options', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const user = req.user!

    // Get existing credentials for this user
    const existingCredentials = WebAuthnCredentialModel.findByUserId(userId)

    // Generate registration options
    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: RP_ID,
      userID: new Uint8Array(Buffer.from(userId)),
      userName: user.email,
      userDisplayName: user.email,
      // Don't prompt users to re-register already-registered authenticators
      excludeCredentials: existingCredentials.map((cred) => ({
        id: cred.credentialId,
        transports: WebAuthnCredentialModel.parseTransports(cred) as any,
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
        authenticatorAttachment: 'platform', // Prefer built-in authenticators (Touch ID, Windows Hello)
      },
      attestationType: 'none',
    })

    // Store challenge temporarily
    registrationChallenges.set(userId, options.challenge)

    // Auto-expire challenge after 5 minutes
    setTimeout(() => {
      registrationChallenges.delete(userId)
    }, 5 * 60 * 1000)

    res.json({
      success: true,
      options,
    })
  } catch (error) {
    console.error('[WebAuthn] Registration options error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to generate registration options',
    })
  }
})

/**
 * POST /api/auth/webauthn/register-verify
 * Verify and store WebAuthn credential
 * Requires authentication (user must be logged in)
 */
router.post('/register-verify', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const { credential, deviceName } = req.body as {
      credential: RegistrationResponseJSON
      deviceName?: string
    }

    if (!credential) {
      return res.status(400).json({
        success: false,
        error: 'Missing credential data',
      })
    }

    // Get stored challenge
    const expectedChallenge = registrationChallenges.get(userId)
    if (!expectedChallenge) {
      return res.status(400).json({
        success: false,
        error: 'No registration in progress or challenge expired',
      })
    }

    // Verify registration response
    const verification = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
    })

    if (!verification.verified || !verification.registrationInfo) {
      return res.status(400).json({
        success: false,
        error: 'Registration verification failed',
      })
    }

    const { credentialPublicKey, credentialID, counter } =
      verification.registrationInfo

    // Store credential in database
    const storedCredential = WebAuthnCredentialModel.create({
      userId,
      credentialId: Buffer.from(credentialID).toString('base64url'),
      publicKey: Buffer.from(credentialPublicKey).toString('base64url'),
      counter,
      transports: credential.response.transports,
      deviceName: deviceName || 'Biometric Device',
    })

    // Clear challenge
    registrationChallenges.delete(userId)

    res.json({
      success: true,
      credential: {
        id: storedCredential.id,
        deviceName: storedCredential.deviceName,
        createdAt: storedCredential.createdAt,
      },
    })
  } catch (error) {
    console.error('[WebAuthn] Registration verification error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to verify registration',
    })
  }
})

// ============================================================================
// AUTHENTICATION ENDPOINTS
// ============================================================================

/**
 * POST /api/auth/webauthn/login-options
 * Generate authentication options for WebAuthn login
 * No authentication required (this is the login endpoint)
 */
router.post('/login-options', async (req, res) => {
  try {
    const { email } = req.body

    if (!email || typeof email !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Email is required',
      })
    }

    // Find user by email
    const user = UserModel.findByEmail(email)
    if (!user) {
      // Don't reveal if user exists (security best practice)
      return res.status(400).json({
        success: false,
        error: 'Invalid email or no biometric credentials registered',
      })
    }

    // Get user's credentials
    const credentials = WebAuthnCredentialModel.findByUserId((user as any).id)

    if (credentials.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No biometric credentials registered for this account',
      })
    }

    // Generate authentication options
    const options = await generateAuthenticationOptions({
      rpID: RP_ID,
      allowCredentials: credentials.map((cred) => ({
        id: cred.credentialId,
        transports: WebAuthnCredentialModel.parseTransports(cred) as any,
      })),
      userVerification: 'preferred',
    })

    // Store challenge temporarily
    authenticationChallenges.set((user as any).id, options.challenge)

    // Auto-expire challenge after 5 minutes
    setTimeout(() => {
      authenticationChallenges.delete((user as any).id)
    }, 5 * 60 * 1000)

    res.json({
      success: true,
      options,
      userId: (user as any).id, // Send userId so we can verify later
    })
  } catch (error) {
    console.error('[WebAuthn] Authentication options error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to generate authentication options',
    })
  }
})

/**
 * POST /api/auth/webauthn/login-verify
 * Verify WebAuthn authentication and issue JWT
 * No authentication required (this is the login endpoint)
 */
router.post('/login-verify', async (req, res) => {
  try {
    const { userId, credential } = req.body as {
      userId: string
      credential: AuthenticationResponseJSON
    }

    if (!userId || !credential) {
      return res.status(400).json({
        success: false,
        error: 'Missing userId or credential data',
      })
    }

    // Get stored challenge
    const expectedChallenge = authenticationChallenges.get(userId)
    if (!expectedChallenge) {
      return res.status(400).json({
        success: false,
        error: 'No authentication in progress or challenge expired',
      })
    }

    // Get user
    const user = UserModel.findById(userId)
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      })
    }

    // Get credential from database
    const credentialId = credential.id
    const storedCredential = WebAuthnCredentialModel.findByCredentialId(credentialId)

    if (!storedCredential) {
      return res.status(404).json({
        success: false,
        error: 'Credential not found',
      })
    }

    // Verify credential belongs to this user
    if (storedCredential.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Credential does not belong to this user',
      })
    }

    // Verify authentication response
    const verification = await verifyAuthenticationResponse({
      response: credential,
      expectedChallenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      authenticator: {
        credentialID: storedCredential.credentialId,
        credentialPublicKey: new Uint8Array(Buffer.from(storedCredential.publicKey, 'base64url')),
        counter: storedCredential.counter,
      },
    })

    if (!verification.verified) {
      return res.status(400).json({
        success: false,
        error: 'Authentication verification failed',
      })
    }

    // Update counter
    WebAuthnCredentialModel.updateCounter(
      storedCredential.credentialId,
      verification.authenticationInfo.newCounter
    )

    // Clear challenge
    authenticationChallenges.delete(userId)

    // Generate JWT token
    const token = generateToken(userId)

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        currentPlan: user.currentPlan,
      },
    })
  } catch (error) {
    console.error('[WebAuthn] Authentication verification error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to verify authentication',
    })
  }
})

// ============================================================================
// CREDENTIAL MANAGEMENT ENDPOINTS
// ============================================================================

/**
 * GET /api/auth/webauthn/credentials
 * Get all WebAuthn credentials for the authenticated user
 */
router.get('/credentials', requireAuth, (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const credentials = WebAuthnCredentialModel.findByUserId(userId)

    // Don't expose sensitive data (public keys, credential IDs)
    const safeCredentials = credentials.map((cred) => ({
      id: cred.id,
      deviceName: cred.deviceName,
      createdAt: cred.createdAt,
      lastUsedAt: cred.lastUsedAt,
    }))

    res.json({
      success: true,
      credentials: safeCredentials,
    })
  } catch (error) {
    console.error('[WebAuthn] Get credentials error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch credentials',
    })
  }
})

/**
 * PATCH /api/auth/webauthn/credentials/:id
 * Update device name for a credential
 */
router.patch('/credentials/:id', requireAuth, (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const { id } = req.params
    const { deviceName } = req.body

    if (!deviceName || typeof deviceName !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Device name is required',
      })
    }

    // Get credential
    const credential = WebAuthnCredentialModel.findById(id)

    if (!credential) {
      return res.status(404).json({
        success: false,
        error: 'Credential not found',
      })
    }

    // Verify ownership
    if (credential.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      })
    }

    // Update device name
    const updated = WebAuthnCredentialModel.updateDeviceName(id, deviceName)

    res.json({
      success: true,
      credential: {
        id: updated.id,
        deviceName: updated.deviceName,
      },
    })
  } catch (error) {
    console.error('[WebAuthn] Update credential error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to update credential',
    })
  }
})

/**
 * DELETE /api/auth/webauthn/credentials/:id
 * Delete a WebAuthn credential
 */
router.delete('/credentials/:id', requireAuth, (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const { id } = req.params

    // Get credential
    const credential = WebAuthnCredentialModel.findById(id)

    if (!credential) {
      return res.status(404).json({
        success: false,
        error: 'Credential not found',
      })
    }

    // Verify ownership
    if (credential.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      })
    }

    // Delete credential
    WebAuthnCredentialModel.delete(id)

    res.json({
      success: true,
      message: 'Credential deleted successfully',
    })
  } catch (error) {
    console.error('[WebAuthn] Delete credential error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to delete credential',
    })
  }
})

// ============================================================================
// HELPER ENDPOINTS
// ============================================================================

/**
 * GET /api/auth/webauthn/has-credentials
 * Check if user has any WebAuthn credentials
 * Requires authentication
 */
router.get('/has-credentials', requireAuth, (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const hasCredentials = WebAuthnCredentialModel.hasCredentials(userId)

    res.json({
      success: true,
      hasCredentials,
      count: WebAuthnCredentialModel.countByUserId(userId),
    })
  } catch (error) {
    console.error('[WebAuthn] Has credentials check error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to check credentials',
    })
  }
})

/**
 * GET /api/auth/webauthn/check-support
 * Check if email has WebAuthn credentials (for login flow)
 * No authentication required
 */
router.post('/check-support', async (req, res) => {
  try {
    const { email } = req.body

    if (!email || typeof email !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Email is required',
      })
    }

    // Find user
    const user = UserModel.findByEmail(email)
    if (!user) {
      // Don't reveal if user exists
      return res.json({
        success: true,
        hasCredentials: false,
      })
    }

    // Check if user has credentials
    const hasCredentials = WebAuthnCredentialModel.hasCredentials((user as any).id)

    res.json({
      success: true,
      hasCredentials,
    })
  } catch (error) {
    console.error('[WebAuthn] Check support error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to check support',
    })
  }
})

export default router
