/**
 * Horalix Halo Backend - Rate Limiting Middleware
 *
 * Protects authentication and sensitive endpoints from abuse, brute force attacks,
 * and spam using express-rate-limit.
 */

import rateLimit from 'express-rate-limit'

// ============================================================================
// RATE LIMITERS
// ============================================================================

/**
 * General authentication rate limiter
 * Used for most auth endpoints
 *
 * Limits: 10 requests per 15 minutes per IP
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 requests per windowMs
  message: {
    success: false,
    error: 'Too many authentication attempts. Please try again in 15 minutes.',
  },
  standardHeaders: true, // Return rate limit info in RateLimit-* headers
  legacyHeaders: false, // Disable X-RateLimit-* headers
  // Store in memory (for production, use Redis)
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: 'Too many requests. Please try again later.',
      retryAfter: Math.ceil(req.rateLimit.resetTime!.getTime() / 1000 - Date.now() / 1000),
    })
  },
})

/**
 * Strict rate limiter for signup
 * More restrictive to prevent spam account creation
 *
 * Limits: 5 requests per 15 minutes per IP
 */
export const signupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: {
    success: false,
    error: 'Too many signup attempts. Please try again in 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: 'Too many signup attempts. Please try again later.',
      retryAfter: Math.ceil(req.rateLimit.resetTime!.getTime() / 1000 - Date.now() / 1000),
    })
  },
})

/**
 * Login rate limiter
 * Prevents brute force password attacks
 *
 * Limits: 10 requests per 15 minutes per IP
 */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 requests per windowMs
  message: {
    success: false,
    error: 'Too many login attempts. Please try again in 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false, // Count all requests, even successful ones
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: 'Too many login attempts. Please try again later.',
      retryAfter: Math.ceil(req.rateLimit.resetTime!.getTime() / 1000 - Date.now() / 1000),
    })
  },
})

/**
 * Email action rate limiter
 * For resend confirmation, forgot password, etc.
 * More restrictive to prevent email spam
 *
 * Limits: 3 requests per hour per IP
 */
export const emailActionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Limit each IP to 3 requests per hour
  message: {
    success: false,
    error: 'Too many email requests. Please try again in 1 hour.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: 'Too many email requests. Please try again later.',
      retryAfter: Math.ceil(req.rateLimit.resetTime!.getTime() / 1000 - Date.now() / 1000),
    })
  },
})

/**
 * Password reset rate limiter
 * Specifically for password reset endpoint
 *
 * Limits: 3 requests per hour per IP
 */
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Limit each IP to 3 requests per hour
  message: {
    success: false,
    error: 'Too many password reset attempts. Please try again in 1 hour.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: 'Too many password reset requests. Please try again later.',
      retryAfter: Math.ceil(req.rateLimit.resetTime!.getTime() / 1000 - Date.now() / 1000),
    })
  },
})

/**
 * WebAuthn registration rate limiter
 * For biometric credential registration
 *
 * Limits: 5 requests per 15 minutes per IP
 */
export const webauthnRegisterLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: {
    success: false,
    error: 'Too many biometric registration attempts. Please try again in 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: 'Too many registration attempts. Please try again later.',
      retryAfter: Math.ceil(req.rateLimit.resetTime!.getTime() / 1000 - Date.now() / 1000),
    })
  },
})

/**
 * WebAuthn login rate limiter
 * For biometric authentication
 *
 * Limits: 15 requests per 15 minutes per IP
 * Slightly more lenient than password login since biometric auth is harder to brute force
 */
export const webauthnLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // Limit each IP to 15 requests per windowMs
  message: {
    success: false,
    error: 'Too many biometric login attempts. Please try again in 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: 'Too many login attempts. Please try again later.',
      retryAfter: Math.ceil(req.rateLimit.resetTime!.getTime() / 1000 - Date.now() / 1000),
    })
  },
})

/**
 * API general rate limiter
 * For general API endpoints
 *
 * Limits: 100 requests per 15 minutes per IP
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: 'Too many API requests. Please try again in 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: 'Too many requests. Please try again later.',
      retryAfter: Math.ceil(req.rateLimit.resetTime!.getTime() / 1000 - Date.now() / 1000),
    })
  },
})

// ============================================================================
// PRODUCTION NOTES
// ============================================================================

/**
 * IMPORTANT: For production deployment with multiple servers:
 *
 * 1. Use Redis as a store instead of in-memory:
 *    ```typescript
 *    import RedisStore from 'rate-limit-redis'
 *    import { createClient } from 'redis'
 *
 *    const redisClient = createClient({
 *      url: process.env.REDIS_URL,
 *    })
 *
 *    export const authLimiter = rateLimit({
 *      store: new RedisStore({
 *        client: redisClient,
 *        prefix: 'rl:auth:',
 *      }),
 *      // ... other options
 *    })
 *    ```
 *
 * 2. Consider implementing per-user rate limiting in addition to per-IP:
 *    - Track failed login attempts per email address
 *    - Lock accounts temporarily after N failed attempts
 *    - Send security alerts for suspicious activity
 *
 * 3. For Cloudflare or AWS ALB deployments:
 *    - Set trustProxy: true in Express
 *    - Use X-Forwarded-For header for real IP
 *
 * 4. Monitor rate limit metrics:
 *    - Log rate limit violations
 *    - Track patterns of abuse
 *    - Adjust limits based on legitimate traffic
 */
