/**
 * Horalix Halo Backend - Error Handler Middleware
 *
 * Centralized error handling for consistent API responses
 */

import { Request, Response, NextFunction } from 'express'
import { ApiError } from '../types'

// ============================================================================
// ERROR RESPONSE INTERFACE
// ============================================================================

interface ErrorResponse {
  error: {
    message: string
    statusCode: number
    stack?: string
    details?: any
  }
}

// ============================================================================
// ERROR HANDLER MIDDLEWARE
// ============================================================================

/**
 * Main error handler middleware
 * Should be added LAST in the middleware chain
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Log error for debugging
  console.error('Error:', {
    name: err.name,
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    url: req.url,
    method: req.method,
  })

  // Handle ApiError (our custom errors)
  if (err instanceof ApiError) {
    const response: ErrorResponse = {
      error: {
        message: err.message,
        statusCode: err.statusCode,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
      },
    }

    res.status(err.statusCode).json(response)
    return
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    res.status(401).json({
      error: {
        message: 'Invalid authentication token',
        statusCode: 401,
      },
    })
    return
  }

  if (err.name === 'TokenExpiredError') {
    res.status(401).json({
      error: {
        message: 'Authentication token expired',
        statusCode: 401,
      },
    })
    return
  }

  // Handle validation errors (e.g., from express-validator)
  if (err.name === 'ValidationError') {
    res.status(400).json({
      error: {
        message: 'Validation failed',
        statusCode: 400,
        details: err.message,
      },
    })
    return
  }

  // Handle SQLite errors
  if (err.message?.includes('SQLITE_')) {
    const statusCode = err.message.includes('UNIQUE') ? 409 : 500

    res.status(statusCode).json({
      error: {
        message:
          statusCode === 409
            ? 'Resource already exists'
            : 'Database error occurred',
        statusCode,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
      },
    })
    return
  }

  // Handle unknown errors
  res.status(500).json({
    error: {
      message:
        process.env.NODE_ENV === 'development'
          ? err.message
          : 'Internal server error',
      statusCode: 500,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    },
  })
}

// ============================================================================
// 404 HANDLER
// ============================================================================

/**
 * Handle 404 Not Found errors
 * Add this BEFORE the error handler middleware
 */
export function notFoundHandler(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  res.status(404).json({
    error: {
      message: `Route not found: ${req.method} ${req.path}`,
      statusCode: 404,
    },
  })
}

// ============================================================================
// ASYNC ERROR WRAPPER
// ============================================================================

/**
 * Wrapper for async route handlers to catch errors
 * Use this to avoid try-catch in every async route
 *
 * Usage:
 * app.get('/route', asyncHandler(async (req, res) => {
 *   // Your async code here
 *   // Errors will automatically be caught and passed to error handler
 * }))
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Validate required fields in request body
 */
export function validateRequired(
  body: any,
  fields: string[]
): { isValid: boolean; missing: string[] } {
  const missing = fields.filter((field) => !body[field])
  return {
    isValid: missing.length === 0,
    missing,
  }
}

/**
 * Middleware to validate required fields
 */
export function requireFields(...fields: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const validation = validateRequired(req.body, fields)
    if (!validation.isValid) {
      res.status(400).json({
        error: {
          message: 'Missing required fields',
          statusCode: 400,
          details: {
            missing: validation.missing,
          },
        },
      })
      return
    }
    next()
  }
}
