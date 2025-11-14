/**
 * Horalix Halo Backend - Main Express Server
 *
 * Production-ready Express server with TypeScript
 */

import express, { Request, Response } from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import path from 'path'

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') })

// Import database setup
import { initializeDatabase, runMigrations } from './database/schema'

// Import routes
import authRoutes from './routes/auth'
import webauthnRoutes from './routes/webauthn'
import subscriptionRoutes from './routes/subscription'
import meetingsRoutes from './routes/meetings'
import webhooksRoutes from './routes/webhooks'
import calendarRoutes from './routes/calendar'
import knowledgeRoutes from './routes/knowledge'
import licenseRoutes from './routes/licenses'

// Import middleware
import { errorHandler, notFoundHandler } from './middleware/errorHandler'
import { generateToken } from './middleware/auth'

// Import models
import UserModel from './models/User'
import AiUsageModel from './models/AiUsage'

// ============================================================================
// CONFIGURATION
// ============================================================================

const PORT = process.env.PORT || 3001
const NODE_ENV = process.env.NODE_ENV || 'development'

// ============================================================================
// EXPRESS APP SETUP
// ============================================================================

const app = express()

// ============================================================================
// MIDDLEWARE
// ============================================================================

// CORS - Allow requests from frontend
app.use(
  cors({
    origin:
      NODE_ENV === 'production'
        ? process.env.FRONTEND_URL || 'http://localhost:5180'
        : '*',
    credentials: true,
  })
)

// JSON body parser
app.use(express.json({ limit: '10mb' }))

// URL-encoded body parser
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Request logging (development only)
if (NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`)
    next()
  })
}

// ============================================================================
// HEALTH CHECK
// ============================================================================

app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    uptime: process.uptime(),
    environment: NODE_ENV,
  })
})

// ============================================================================
// API ROUTES
// ============================================================================

app.use('/api/auth', authRoutes)
app.use('/api/auth/webauthn', webauthnRoutes)
app.use('/api/subscription', subscriptionRoutes)
app.use('/api/meetings', meetingsRoutes)
app.use('/api/webhooks', webhooksRoutes)
app.use('/api/calendar', calendarRoutes)
app.use('/api/knowledge', knowledgeRoutes)
app.use('/api/licenses', licenseRoutes)

// ============================================================================
// DEVELOPMENT ROUTES
// ============================================================================

if (NODE_ENV === 'development') {
  // Create test user and get token
  app.post('/dev/create-user', (req: Request, res: Response) => {
    const { email } = req.body
    if (!email) {
      res.status(400).json({ error: 'Email is required' })
      return
    }

    const user = UserModel.findOrCreate(email)
    const token = generateToken(user.id)

    res.json({
      user,
      token,
      message: 'User created/found successfully. Use this token for authentication.',
    })
  })

  // Record AI usage (for testing)
  app.post('/dev/record-ai-usage', (req: Request, res: Response) => {
    const { userId, providerId, inputTokens, outputTokens, context } = req.body

    if (!userId || !providerId || !inputTokens || !outputTokens || !context) {
      res.status(400).json({
        error:
          'Missing required fields: userId, providerId, inputTokens, outputTokens, context',
      })
      return
    }

    const usage = AiUsageModel.create({
      userId,
      providerId,
      inputTokens,
      outputTokens,
      context,
    })

    res.json({
      usage,
      message: 'AI usage recorded successfully',
    })
  })

  // Get stats (for testing)
  app.get('/dev/stats', (req: Request, res: Response) => {
    const userCount = UserModel.count()
    const meetingCount = require('./models/Meeting').default.count()
    const aiUsageCount = AiUsageModel.count()
    const totalAiCost = AiUsageModel.getTotalCostAllUsers()

    res.json({
      users: userCount,
      meetings: meetingCount,
      aiUsageRecords: aiUsageCount,
      totalAiCost: totalAiCost.toFixed(4),
    })
  })
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

// 404 handler (must be before error handler)
app.use(notFoundHandler)

// Error handler (must be last)
app.use(errorHandler)

// ============================================================================
// DATABASE INITIALIZATION
// ============================================================================

function initializeServer() {
  console.log('🚀 Horalix Halo Backend Server')
  console.log('================================')
  console.log(`Environment: ${NODE_ENV}`)
  console.log(`Port: ${PORT}`)
  console.log('')

  // Initialize database
  try {
    console.log('📦 Initializing database...')
    initializeDatabase()
    runMigrations()
    console.log('✅ Database initialized successfully')
    console.log('')
  } catch (error) {
    console.error('❌ Database initialization failed:', error)
    process.exit(1)
  }

  // Check environment variables
  console.log('🔐 Environment Variables Check:')
  const requiredEnvVars = [
    'JWT_SECRET',
    'LEMON_SQUEEZY_API_KEY',
    'LEMON_SQUEEZY_STORE_ID',
    'LEMON_SQUEEZY_WEBHOOK_SECRET',
  ]

  const missingEnvVars = requiredEnvVars.filter((key) => !process.env[key])

  if (missingEnvVars.length > 0) {
    console.warn('⚠️  WARNING: Missing environment variables:')
    missingEnvVars.forEach((key) => console.warn(`   - ${key}`))
    console.warn('')
    console.warn('   The backend will run, but some features may not work.')
    console.warn('   Please check backend/.env.example for required variables.')
    console.warn('')
  } else {
    console.log('✅ All required environment variables are set')
    console.log('')
  }

  // Start server
  app.listen(PORT, () => {
    console.log('🎉 Server is running!')
    console.log(`   URL: http://localhost:${PORT}`)
    console.log(`   Health check: http://localhost:${PORT}/health`)
    console.log('')
    if (NODE_ENV === 'development') {
      console.log('📋 Development endpoints:')
      console.log(`   POST /dev/create-user - Create test user`)
      console.log(`   POST /dev/record-ai-usage - Record AI usage`)
      console.log(`   GET  /dev/stats - Get database stats`)
      console.log('')
    }
    console.log('✨ Ready to accept requests!')
  })
}

// ============================================================================
// GRACEFUL SHUTDOWN
// ============================================================================

process.on('SIGTERM', () => {
  console.log('')
  console.log('📴 SIGTERM signal received: closing HTTP server')
  process.exit(0)
})

process.on('SIGINT', () => {
  console.log('')
  console.log('📴 SIGINT signal received: closing HTTP server')
  process.exit(0)
})

// ============================================================================
// START SERVER
// ============================================================================

initializeServer()

export default app
