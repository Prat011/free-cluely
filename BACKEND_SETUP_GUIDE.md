# Horalix Halo Backend - Complete Setup Guide

This guide will walk you through setting up the Horalix Halo backend from scratch.

## Overview

The backend is a production-ready Node.js/Express API with TypeScript that handles:

- ✅ User authentication (JWT)
- ✅ Subscription management (Lemon Squeezy)
- ✅ Meeting tracking
- ✅ AI usage tracking with profit-safety system
- ✅ Webhook processing
- ✅ Database management (SQLite)

## Quick Start

### 1. Install Dependencies

```bash
# Install root dependencies (includes backend deps)
npm install

# Or install backend dependencies separately
cd backend
npm install
cd ..
```

### 2. Set Up Environment Variables

```bash
# Copy the example environment file
cp backend/.env.example backend/.env

# Generate a secure JWT secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Edit backend/.env and update all values
```

### 3. Start the Backend Server

```bash
# From project root
npm run backend:dev

# Or from backend directory
cd backend
npm run dev
```

The server will start at `http://localhost:3001`

## Detailed Setup

### Environment Variables

Edit `backend/.env` with these values:

```env
# Server Configuration
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5180

# Database
DATABASE_PATH=./horalix-backend.db

# Authentication (REQUIRED)
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_SECRET=your-generated-secret-here

# Lemon Squeezy (REQUIRED for subscriptions)
LEMON_SQUEEZY_API_KEY=your-api-key
LEMON_SQUEEZY_STORE_ID=your-store-id
LEMON_SQUEEZY_WEBHOOK_SECRET=your-webhook-secret

# Product Variant IDs (REQUIRED for subscriptions)
LEMON_SQUEEZY_PLUS_MONTHLY_VARIANT_ID=variant-id
LEMON_SQUEEZY_PLUS_YEARLY_VARIANT_ID=variant-id
LEMON_SQUEEZY_ULTRA_MONTHLY_VARIANT_ID=variant-id
LEMON_SQUEEZY_ULTRA_YEARLY_VARIANT_ID=variant-id
```

### Lemon Squeezy Setup

#### Step 1: Create Account and Store

1. Go to https://lemonsqueezy.com
2. Sign up for an account
3. Create a new store

#### Step 2: Get API Key

1. Go to **Settings → API**
2. Click **Create API Key**
3. Copy the API key
4. Add to `.env` as `LEMON_SQUEEZY_API_KEY`

#### Step 3: Get Store ID

1. Go to **Settings → General**
2. Find your Store ID
3. Add to `.env` as `LEMON_SQUEEZY_STORE_ID`

#### Step 4: Create Products

Create two products with these settings:

**Product 1: Halo Plus**
- Name: Halo Plus
- Description: Your private AI wingman for every important call
- Variants:
  - Monthly: $9.00/month
  - Yearly: $90.00/year

**Product 2: Halo Ultra**
- Name: Halo Ultra
- Description: For people who basically live in meetings
- Variants:
  - Monthly: $19.00/month
  - Yearly: $190.00/year

#### Step 5: Get Variant IDs

1. Go to each product
2. Click on each variant
3. Copy the Variant ID from the URL or settings
4. Add to `.env`:
   ```
   LEMON_SQUEEZY_PLUS_MONTHLY_VARIANT_ID=xxxxx
   LEMON_SQUEEZY_PLUS_YEARLY_VARIANT_ID=xxxxx
   LEMON_SQUEEZY_ULTRA_MONTHLY_VARIANT_ID=xxxxx
   LEMON_SQUEEZY_ULTRA_YEARLY_VARIANT_ID=xxxxx
   ```

#### Step 6: Set Up Webhooks

1. Go to **Settings → Webhooks**
2. Click **Add Webhook**
3. Configure:
   - **URL**: `https://your-domain.com/api/webhooks/lemonsqueezy`
   - **Events**: Select all subscription events:
     - `subscription_created`
     - `subscription_updated`
     - `subscription_cancelled`
     - `subscription_resumed`
     - `subscription_expired`
     - `subscription_paused`
     - `subscription_unpaused`
     - `subscription_payment_success`
     - `subscription_payment_failed`
4. Copy the **Signing Secret**
5. Add to `.env` as `LEMON_SQUEEZY_WEBHOOK_SECRET`

**Note for Development:**
- For local testing, use a tool like [ngrok](https://ngrok.com) to expose your local server
- Example: `ngrok http 3001`
- Use the ngrok URL for the webhook: `https://xxxxx.ngrok.io/api/webhooks/lemonsqueezy`

## Testing the Backend

### 1. Check Server Health

```bash
curl http://localhost:3001/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": 1699999999999,
  "uptime": 123.456,
  "environment": "development"
}
```

### 2. Create a Test User

```bash
curl -X POST http://localhost:3001/dev/create-user \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'
```

Expected response:
```json
{
  "user": {
    "id": "user_...",
    "email": "test@example.com",
    "currentPlan": "free",
    ...
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "message": "User created/found successfully. Use this token for authentication."
}
```

**Save the token!** You'll need it for authenticated requests.

### 3. Test Authentication

```bash
# Replace YOUR_TOKEN with the token from step 2
curl http://localhost:3001/api/subscription/me \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Expected response:
```json
{
  "subscription": null,
  "user": {
    "id": "user_...",
    "email": "test@example.com",
    "currentPlan": "free",
    ...
  },
  "currentPlan": "free",
  "features": {
    "realtimeTranscription": true,
    "inMeetingButtons": true,
    ...
  },
  "canUseTrial": true
}
```

### 4. Test Meeting Creation

```bash
# Check if you can start a meeting
curl -X POST http://localhost:3001/api/meetings/can-start \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"estimatedDurationMinutes": 30}'

# Start a meeting
curl -X POST http://localhost:3001/api/meetings/start \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get usage stats
curl http://localhost:3001/api/meetings/usage \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 5. Test Subscription Flow

```bash
# Get available plans
curl http://localhost:3001/api/subscription/plans

# Start checkout (will return Lemon Squeezy checkout URL)
curl -X POST http://localhost:3001/api/subscription/start-checkout \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "planId": "plus",
    "billingInterval": "monthly"
  }'
```

### 6. View Database Stats

```bash
curl http://localhost:3001/dev/stats
```

## API Documentation

See `backend/README.md` for complete API documentation.

### Key Endpoints

- **Health**: `GET /health`
- **Subscription Info**: `GET /api/subscription/me`
- **Start Checkout**: `POST /api/subscription/start-checkout`
- **Usage Stats**: `GET /api/meetings/usage`
- **Can Start Meeting**: `POST /api/meetings/can-start`
- **Start Meeting**: `POST /api/meetings/start`
- **Webhooks**: `POST /api/webhooks/lemonsqueezy`

## Development Commands

```bash
# Run backend in development mode (hot reload)
npm run backend:dev

# Build backend for production
npm run backend:build

# Run backend in production mode
npm run backend:start

# Type check
cd backend && npm run typecheck

# Reset database (DANGER: deletes all data!)
cd backend && npm run db:reset
```

## Project Structure

```
backend/
├── src/
│   ├── database/         # Database connection and schema
│   ├── models/           # Data models (User, Subscription, Meeting, AiUsage)
│   ├── routes/           # API routes
│   ├── middleware/       # Auth, profit-safety, error handling
│   ├── services/         # Business logic (Lemon Squeezy, usage tracking)
│   ├── types/            # TypeScript type definitions
│   └── server.ts         # Main Express app
├── scripts/
│   └── resetDb.ts        # Database reset utility
├── tsconfig.json         # TypeScript configuration
├── package.json          # Backend dependencies
├── .env.example          # Environment template
├── .gitignore            # Git ignore rules
└── README.md             # Backend documentation
```

## Shared Code

The backend imports shared configuration from `/shared/`:

- **`shared/plans.ts`** - Plan definitions, features, and pricing
- **`shared/aiCost.ts`** - AI cost calculation and profit-safety logic

These files are shared between the backend and frontend to ensure consistency.

## Profit-Safety System

The backend implements a profit-safety system to prevent losses:

1. **Track AI Costs**: Every AI request is recorded in the `ai_usage` table
2. **Calculate Limits**: Max AI spend = (Monthly Revenue) / 2
3. **Enforce Limits**: Block requests that would exceed the limit
4. **Alert Users**: Warn when approaching 75% of budget

Example limits:
- **Free Plan**: $0 revenue → Very limited AI usage
- **Plus Plan**: $9/month revenue → Max $4.50/month AI spend
- **Ultra Plan**: $19/month revenue → Max $9.50/month AI spend

## Database

The backend uses SQLite with better-sqlite3 for:

- Zero configuration
- Fast performance
- Single-file database
- No separate server needed

Database file location: `backend/horalix-backend.db` (or `DATABASE_PATH` in `.env`)

### Schema

- **users** - User accounts and plan info
- **subscriptions** - Subscription records from Lemon Squeezy
- **meetings** - Meeting sessions and durations
- **ai_usage** - AI request tracking for profit-safety

## Security

- ✅ JWT authentication with secure secrets
- ✅ CORS protection
- ✅ Input validation
- ✅ SQL injection protection (prepared statements)
- ✅ Webhook signature verification
- ✅ Environment variable protection

**Production Checklist:**
- [ ] Use strong JWT_SECRET (32+ random bytes)
- [ ] Enable HTTPS
- [ ] Set NODE_ENV=production
- [ ] Configure FRONTEND_URL for CORS
- [ ] Verify webhook signatures
- [ ] Keep .env file secure
- [ ] Use environment-specific configs
- [ ] Monitor error logs

## Troubleshooting

### Server won't start

**Error**: `JWT_SECRET not set`
- Generate a secret: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- Add to `backend/.env`

**Error**: `LEMON_SQUEEZY_API_KEY not configured`
- Get API key from Lemon Squeezy dashboard
- Add to `backend/.env`

### Authentication fails

**Error**: `Invalid or expired token`
- Token may be expired (30 days by default)
- Create a new user token: `POST /dev/create-user`

**Error**: `Authentication required`
- Make sure to include header: `Authorization: Bearer YOUR_TOKEN`

### Subscription checkout fails

**Error**: `No Lemon Squeezy variant ID configured`
- Make sure all variant IDs are set in `backend/.env`
- Check that variant IDs match your Lemon Squeezy products

### Webhooks not working

1. Check webhook URL in Lemon Squeezy dashboard
2. Verify `LEMON_SQUEEZY_WEBHOOK_SECRET` is set
3. Use ngrok for local testing
4. Check server logs for webhook errors

### Database errors

**Error**: `database is locked`
- Only one server instance can run at a time
- Stop other running instances

**Solution**: Reset database
```bash
cd backend
npm run db:reset
```

## Next Steps

1. ✅ Set up backend environment
2. ✅ Configure Lemon Squeezy
3. ✅ Test API endpoints
4. 🔲 Integrate frontend with backend
5. 🔲 Deploy to production
6. 🔲 Monitor usage and costs

## Support

For issues or questions:
- Check `backend/README.md` for detailed API docs
- Review code comments in source files
- Check Lemon Squeezy documentation: https://docs.lemonsqueezy.com

---

**Happy coding! 🚀**
