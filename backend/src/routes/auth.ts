/**
 * Horalix Halo Backend - Authentication Routes
 *
 * Comprehensive authentication system with:
 * - Email/password authentication
 * - Google OAuth integration
 * - Email confirmation
 * - Password reset
 * - Account management
 */

import express from "express"
import { auth } from "../middleware/auth"
import { AuthRequest, ValidationError, AuthenticationError, NotFoundError } from "../types"
import UserModel from "../models/User"
import { generateToken } from "../middleware/auth"
import {
  sendConfirmationEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
} from "../services/email"
import { GoogleCalendarService } from "../services/googleCalendar"

const router = express.Router()
const googleCalendar = new GoogleCalendarService()

// ============================================================================
// INPUT VALIDATION & SANITIZATION
// ============================================================================

/**
 * Validate email format and length
 */
function validateEmail(email: string): void {
  if (!email || typeof email !== "string") {
    throw new ValidationError("Email is required")
  }

  const trimmedEmail = email.trim()

  if (trimmedEmail.length > 255) {
    throw new ValidationError("Email must be 255 characters or less")
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(trimmedEmail)) {
    throw new ValidationError("Invalid email format")
  }
}

/**
 * Validate password strength
 * Requirements: min 8 chars, 1 uppercase, 1 lowercase, 1 number
 */
function validatePassword(password: string): void {
  if (!password || typeof password !== "string") {
    throw new ValidationError("Password is required")
  }

  if (password.length < 8) {
    throw new ValidationError("Password must be at least 8 characters long")
  }

  if (!/[A-Z]/.test(password)) {
    throw new ValidationError("Password must contain at least one uppercase letter")
  }

  if (!/[a-z]/.test(password)) {
    throw new ValidationError("Password must contain at least one lowercase letter")
  }

  if (!/[0-9]/.test(password)) {
    throw new ValidationError("Password must contain at least one number")
  }
}

/**
 * Sanitize string input (trim and limit length)
 */
function sanitizeString(input: string, maxLength: number = 255): string {
  if (!input || typeof input !== "string") {
    return ""
  }
  return input.trim().slice(0, maxLength)
}

// ============================================================================
// EMAIL/PASSWORD AUTHENTICATION
// ============================================================================

/**
 * POST /api/auth/signup
 * Create account with email/password, send confirmation email
 *
 * Body: { email: string, password: string }
 * Response: { success: true, userId: string, message: string }
 */
router.post("/signup", async (req, res, next) => {
  try {
    const { email: rawEmail, password } = req.body

    // Sanitize and validate inputs
    const email = sanitizeString(rawEmail).toLowerCase()
    validateEmail(email)
    validatePassword(password)

    // Check if user already exists
    const existingUser = UserModel.findByEmail(email)
    if (existingUser) {
      // Don't reveal that email exists - use generic message
      throw new ValidationError("Unable to create account. Please check your information.")
    }

    // Create user with password
    const user = await UserModel.createWithPassword(email, password)

    // Send confirmation email
    const emailConfirmToken = (user as any).emailConfirmToken
    if (emailConfirmToken) {
      await sendConfirmationEmail(email, emailConfirmToken)
    }

    console.log(`[Auth] New user signup: ${user.id} (${email})`)

    res.status(201).json({
      success: true,
      userId: user.id,
      message: "Account created! Please check your email to confirm your account.",
    })

    // TODO: Add rate limiting to prevent abuse (e.g., express-rate-limit)
  } catch (error) {
    next(error)
  }
})

/**
 * POST /api/auth/login
 * Login with email/password, check if confirmed
 *
 * Body: { email: string, password: string }
 * Response: { success: true, token: string, user: User }
 */
router.post("/login", async (req, res, next) => {
  try {
    const { email: rawEmail, password } = req.body

    // Sanitize inputs
    const email = sanitizeString(rawEmail).toLowerCase()

    if (!email || !password) {
      throw new ValidationError("Email and password are required")
    }

    // Verify password
    const user = await UserModel.verifyPassword(email, password)

    if (!user) {
      // Generic message - don't reveal whether email exists or password is wrong
      console.log(`[Auth] Failed login attempt for: ${email}`)
      throw new AuthenticationError("Invalid credentials")
    }

    // Check if email is confirmed
    if (!(user as any).isEmailConfirmed) {
      console.log(`[Auth] Login attempt with unconfirmed email: ${user.id}`)
      throw new AuthenticationError(
        "Please confirm your email address before logging in. Check your inbox for the confirmation link."
      )
    }

    // Generate JWT token
    const token = generateToken(user.id)

    console.log(`[Auth] Successful login: ${user.id} (${email})`)

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        currentPlan: user.currentPlan,
        isEmailConfirmed: (user as any).isEmailConfirmed,
        createdAt: user.createdAt,
      },
    })

    // TODO: Add rate limiting to prevent brute force attacks
  } catch (error) {
    next(error)
  }
})

/**
 * GET /api/auth/confirm-email/:token
 * Confirm email with token
 *
 * Response: { success: true, message: string }
 */
router.get("/confirm-email/:token", async (req, res, next) => {
  try {
    const { token } = req.params

    if (!token || typeof token !== "string") {
      throw new ValidationError("Invalid confirmation token")
    }

    // Confirm email
    const user = UserModel.confirmEmail(token)

    if (!user) {
      console.log(`[Auth] Invalid or expired confirmation token: ${token.slice(0, 10)}...`)
      throw new NotFoundError("Invalid or expired confirmation link. Please request a new one.")
    }

    // Send welcome email
    await sendWelcomeEmail(user.email)

    console.log(`[Auth] Email confirmed for user: ${user.id}`)

    res.json({
      success: true,
      message: "Email confirmed successfully! You can now log in.",
    })
  } catch (error) {
    next(error)
  }
})

/**
 * POST /api/auth/resend-confirmation
 * Resend confirmation email
 *
 * Body: { email: string }
 * Response: { success: true, message: string }
 */
router.post("/resend-confirmation", async (req, res, next) => {
  try {
    const { email: rawEmail } = req.body

    // Sanitize and validate email
    const email = sanitizeString(rawEmail).toLowerCase()
    validateEmail(email)

    const user = UserModel.findByEmail(email)

    // Always return success to prevent email enumeration
    if (!user) {
      console.log(`[Auth] Resend confirmation for non-existent email: ${email}`)
      res.json({
        success: true,
        message: "If an account exists with this email, a confirmation link has been sent.",
      })
      return
    }

    // Check if already confirmed
    if ((user as any).isEmailConfirmed) {
      console.log(`[Auth] Resend confirmation for already confirmed email: ${user.id}`)
      res.json({
        success: true,
        message: "If an account exists with this email, a confirmation link has been sent.",
      })
      return
    }

    // Generate new token and send email
    const token = UserModel.generateEmailConfirmToken(user.id)
    await sendConfirmationEmail(email, token)

    console.log(`[Auth] Resent confirmation email: ${user.id}`)

    res.json({
      success: true,
      message: "If an account exists with this email, a confirmation link has been sent.",
    })

    // TODO: Add rate limiting to prevent abuse
  } catch (error) {
    next(error)
  }
})

/**
 * POST /api/auth/forgot-password
 * Request password reset
 *
 * Body: { email: string }
 * Response: { success: true, message: string }
 */
router.post("/forgot-password", async (req, res, next) => {
  try {
    const { email: rawEmail } = req.body

    // Sanitize and validate email
    const email = sanitizeString(rawEmail).toLowerCase()
    validateEmail(email)

    // Generate reset token (returns null if user doesn't exist)
    const token = UserModel.generatePasswordResetToken(email)

    // Always return success to prevent email enumeration
    if (!token) {
      console.log(`[Auth] Password reset requested for non-existent email: ${email}`)
      res.json({
        success: true,
        message:
          "If an account exists with this email, a password reset link has been sent.",
      })
      return
    }

    // Send password reset email
    await sendPasswordResetEmail(email, token)

    console.log(`[Auth] Password reset email sent: ${email}`)

    res.json({
      success: true,
      message:
        "If an account exists with this email, a password reset link has been sent.",
    })

    // TODO: Add rate limiting to prevent abuse
  } catch (error) {
    next(error)
  }
})

/**
 * POST /api/auth/reset-password
 * Reset password with token
 *
 * Body: { token: string, newPassword: string }
 * Response: { success: true, message: string }
 */
router.post("/reset-password", async (req, res, next) => {
  try {
    const { token, newPassword } = req.body

    if (!token || typeof token !== "string") {
      throw new ValidationError("Invalid reset token")
    }

    // Validate new password
    validatePassword(newPassword)

    // Reset password
    const user = await UserModel.resetPassword(token, newPassword)

    if (!user) {
      console.log(`[Auth] Invalid or expired reset token: ${token.slice(0, 10)}...`)
      throw new NotFoundError("Invalid or expired reset link. Please request a new one.")
    }

    console.log(`[Auth] Password reset successful: ${user.id}`)

    res.json({
      success: true,
      message: "Password reset successfully! You can now log in with your new password.",
    })
  } catch (error) {
    next(error)
  }
})

/**
 * POST /api/auth/change-password
 * Change password (requires authentication)
 *
 * Body: { currentPassword: string, newPassword: string }
 * Response: { success: true, message: string }
 */
router.post("/change-password", auth, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.userId!
    const user = req.user!
    const { currentPassword, newPassword } = req.body

    if (!currentPassword || !newPassword) {
      throw new ValidationError("Current password and new password are required")
    }

    // Validate new password
    validatePassword(newPassword)

    // Verify current password
    const verifiedUser = await UserModel.verifyPassword(user.email, currentPassword)

    if (!verifiedUser) {
      console.log(`[Auth] Failed password change attempt: ${userId}`)
      throw new AuthenticationError("Current password is incorrect")
    }

    // Check that new password is different from current
    if (currentPassword === newPassword) {
      throw new ValidationError("New password must be different from current password")
    }

    // Generate password reset token and use it to change password
    // This reuses the existing resetPassword logic
    const token = UserModel.generatePasswordResetToken(user.email)!
    await UserModel.resetPassword(token, newPassword)

    console.log(`[Auth] Password changed successfully: ${userId}`)

    res.json({
      success: true,
      message: "Password changed successfully!",
    })
  } catch (error) {
    next(error)
  }
})

// ============================================================================
// GOOGLE OAUTH
// ============================================================================

/**
 * GET /api/auth/google
 * Generate Google OAuth URL
 *
 * Query: { state?: string } - Optional state to pass through OAuth flow
 * Response: { success: true, authUrl: string }
 */
router.get("/google", (req, res, next) => {
  try {
    // Use state parameter or generate a default one
    const state = (req.query.state as string) || `oauth_${Date.now()}`

    const authUrl = googleCalendar.getAuthUrl(state)

    res.json({
      success: true,
      authUrl,
    })
  } catch (error) {
    console.error("[Auth] Google OAuth URL generation error:", error)
    next(error)
  }
})

/**
 * GET /api/auth/google/callback
 * Handle Google OAuth callback
 *
 * Query: { code: string, state?: string }
 * Response: HTML page with auto-login or error message
 */
router.get("/google/callback", async (req, res) => {
  try {
    const { code, state } = req.query

    if (!code || typeof code !== "string") {
      return res.status(400).send(`
        <html>
          <body style="font-family: system-ui; padding: 40px; text-align: center;">
            <h1>Authentication Failed</h1>
            <p>Missing authorization code from Google.</p>
            <p><a href="${process.env.FRONTEND_URL || 'http://localhost:5180'}/login">Return to Login</a></p>
          </body>
        </html>
      `)
    }

    // Exchange code for tokens
    const { accessToken, refreshToken, expiresAt } =
      await googleCalendar.getTokensFromCode(code)

    // Get user info from Google
    // Note: GoogleCalendarService doesn't expose user info directly
    // We need to make an additional API call to get the user's email
    const { google } = require("googleapis")
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI || "http://localhost:3001/api/auth/google/callback"
    )
    oauth2Client.setCredentials({ access_token: accessToken })

    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client })
    const { data } = await oauth2.userinfo.get()

    if (!data.email) {
      throw new Error("Failed to get user email from Google")
    }

    const googleId = data.id
    const email = data.email

    // Find or create user
    const user = UserModel.findOrCreateByGoogleId(googleId, email)

    // Generate JWT token
    const token = generateToken(user.id)

    console.log(`[Auth] Google OAuth successful: ${user.id} (${email})`)

    // Return HTML page that sends token to parent window and closes
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #a855f7, #ec4899);
            }
            .container {
              background: white;
              padding: 40px;
              border-radius: 12px;
              box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
              text-align: center;
            }
            h1 {
              color: #333;
              margin: 0 0 16px 0;
            }
            p {
              color: #666;
              margin: 0;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Authentication Successful!</h1>
            <p>Redirecting you back to the app...</p>
          </div>
          <script>
            // Send token to parent window (if opened in popup)
            if (window.opener) {
              window.opener.postMessage({
                type: 'auth_success',
                token: '${token}',
                user: ${JSON.stringify({
                  id: user.id,
                  email: user.email,
                  currentPlan: user.currentPlan,
                })}
              }, '*');
              window.close();
            } else {
              // Redirect to frontend with token in URL (if not in popup)
              const frontendUrl = '${process.env.FRONTEND_URL || 'http://localhost:5180'}';
              window.location.href = frontendUrl + '/auth/callback?token=' + encodeURIComponent('${token}');
            }
          </script>
        </body>
      </html>
    `)
  } catch (error) {
    console.error("[Auth] Google OAuth callback error:", error)
    res.status(500).send(`
      <html>
        <body style="font-family: system-ui; padding: 40px; text-align: center;">
          <h1>Authentication Failed</h1>
          <p>An error occurred during authentication. Please try again.</p>
          <p><a href="${process.env.FRONTEND_URL || 'http://localhost:5180'}/login">Return to Login</a></p>
        </body>
      </html>
    `)
  }
})

// ============================================================================
// PROFILE & ACCOUNT MANAGEMENT
// ============================================================================

/**
 * GET /api/auth/me
 * Get current user profile (requires auth)
 *
 * Response: { success: true, user: User }
 */
router.get("/me", auth, (req: AuthRequest, res, next) => {
  try {
    const user = req.user!

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        currentPlan: user.currentPlan,
        isEmailConfirmed: (user as any).isEmailConfirmed,
        hasPassword: !!(user as any).passwordHash,
        hasGoogleAuth: !!(user as any).googleId,
        hasAppleAuth: !!(user as any).appleId,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    })
  } catch (error) {
    next(error)
  }
})

/**
 * DELETE /api/auth/account
 * Delete account (requires auth)
 *
 * Body: { password?: string } - Required if user has password authentication
 * Response: { success: true, message: string }
 */
router.delete("/account", auth, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.userId!
    const user = req.user!
    const { password } = req.body

    // If user has password authentication, require password confirmation
    if ((user as any).passwordHash) {
      if (!password) {
        throw new ValidationError("Password is required to delete your account")
      }

      const verifiedUser = await UserModel.verifyPassword(user.email, password)
      if (!verifiedUser) {
        console.log(`[Auth] Failed account deletion attempt (wrong password): ${userId}`)
        throw new AuthenticationError("Incorrect password")
      }
    }

    // Delete user (CASCADE will delete all related data)
    const deleted = UserModel.delete(userId)

    if (!deleted) {
      throw new NotFoundError("User not found")
    }

    console.log(`[Auth] Account deleted: ${userId} (${user.email})`)

    res.json({
      success: true,
      message: "Account deleted successfully. We're sorry to see you go!",
    })
  } catch (error) {
    next(error)
  }
})

// ============================================================================
// DEVELOPMENT/TESTING ENDPOINTS (Remove in production)
// ============================================================================

if (process.env.NODE_ENV === "development") {
  /**
   * POST /api/auth/dev/create-test-user
   * Create a test user with confirmed email (development only)
   */
  router.post("/dev/create-test-user", async (req, res, next) => {
    try {
      const { email, password } = req.body

      if (!email || !password) {
        throw new ValidationError("Email and password are required")
      }

      // Create user
      const user = await UserModel.createWithPassword(email, password)

      // Auto-confirm email for development
      const token = (user as any).emailConfirmToken
      if (token) {
        UserModel.confirmEmail(token)
      }

      // Generate token
      const authToken = generateToken(user.id)

      res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
        },
        token: authToken,
        message: "Test user created and auto-confirmed",
      })
    } catch (error) {
      next(error)
    }
  })
}

export default router
