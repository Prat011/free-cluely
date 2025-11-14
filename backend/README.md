# Horalix Halo Backend

Production-ready Node.js/Express backend with TypeScript for Horalix Halo.

## Features

- ✅ **TypeScript** - Fully type-safe codebase
- ✅ **Express.js** - Fast, minimalist web framework
- ✅ **SQLite** - Lightweight database with better-sqlite3
- ✅ **JWT Authentication** - Secure token-based auth
- ✅ **Lemon Squeezy Integration** - Subscription management
- ✅ **Profit Safety** - AI cost tracking and limits
- ✅ **Usage Tracking** - Meeting and AI usage statistics
- ✅ **Error Handling** - Comprehensive error handling
- ✅ **Development Tools** - Hot reload, debugging endpoints

## Quick Start

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Configure Environment

```bash
# Copy example environment file
cp .env.example .env

# Generate a secure JWT secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Edit .env and add:
# - JWT_SECRET (use the generated secret above)
# - Lemon Squeezy credentials (see setup below)
```

### 3. Start Development Server

```bash
npm run dev
```

The server will start at `http://localhost:3001`

## Environment Setup

### JWT Secret

Generate a secure random string:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Add to `.env`:

```
JWT_SECRET=your-generated-secret-here
```

### Lemon Squeezy Setup

1. **Create Account**
   - Go to https://lemonsqueezy.com
   - Create an account and set up your store

2. **Get API Key**
   - Go to Settings > API
   - Create a new API key
   - Copy to `.env` as `LEMON_SQUEEZY_API_KEY`

3. **Get Store ID**
   - Go to your store settings
   - Copy Store ID to `.env` as `LEMON_SQUEEZY_STORE_ID`

4. **Create Products**
   - Create two products: "Halo Plus" and "Halo Ultra"
   - For each product, create two variants:
     - Monthly subscription
     - Yearly subscription
   - Set prices according to `shared/plans.ts`:
     - Plus: $9/month or $90/year
     - Ultra: $19/month or $190/year

5. **Get Variant IDs**
   - Go to each product's settings
   - Find the variant IDs
   - Add to `.env`:
     ```
     LEMON_SQUEEZY_PLUS_MONTHLY_VARIANT_ID=xxxxx
     LEMON_SQUEEZY_PLUS_YEARLY_VARIANT_ID=xxxxx
     LEMON_SQUEEZY_ULTRA_MONTHLY_VARIANT_ID=xxxxx
     LEMON_SQUEEZY_ULTRA_YEARLY_VARIANT_ID=xxxxx
     ```

6. **Set Up Webhooks**
   - Go to Settings > Webhooks
   - Create a new webhook
   - URL: `https://your-domain.com/api/webhooks/lemonsqueezy`
   - Select all subscription events
   - Copy the webhook secret to `.env` as `LEMON_SQUEEZY_WEBHOOK_SECRET`

## API Endpoints

### Health Check

```
GET /health
```

Returns server status.

### Authentication

All protected endpoints require a `Authorization: Bearer <token>` header.

To get a token in development:

```bash
curl -X POST http://localhost:3001/dev/create-user \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'
```

### Subscription Routes

```
GET  /api/subscription/me              - Get current subscription info
POST /api/subscription/start-checkout  - Create checkout URL
GET  /api/subscription/history         - Get subscription history
POST /api/subscription/cancel          - Cancel subscription
GET  /api/subscription/plans           - Get available plans
```

### Meeting Routes

```
GET    /api/meetings/usage          - Get usage stats
POST   /api/meetings/can-start      - Check if can start meeting
POST   /api/meetings/start          - Start a new meeting
POST   /api/meetings/:id/end        - End a meeting
GET    /api/meetings                - Get all meetings
GET    /api/meetings/:id            - Get meeting by ID
PUT    /api/meetings/:id/transcript - Update transcript path
PUT    /api/meetings/:id/recap      - Update recap path
DELETE /api/meetings/:id            - Delete meeting
```

### Webhook Routes

```
POST /api/webhooks/lemonsqueezy - Handle Lemon Squeezy webhooks
```

### Development Routes (only in development mode)

```
POST /dev/create-user        - Create test user and get token
POST /dev/record-ai-usage    - Record AI usage for testing
GET  /dev/stats              - Get database statistics
```

## Database

The backend uses SQLite with better-sqlite3. The database file is created automatically at the path specified in `DATABASE_PATH` environment variable (default: `./horalix-backend.db`).

### Schema

- **users** - User accounts
- **subscriptions** - Subscription records
- **meetings** - Meeting sessions
- **ai_usage** - AI usage tracking

### Reset Database (Development)

```bash
npm run db:reset
```

**Warning:** This will delete all data!

## Development

### Run in Development Mode

```bash
npm run dev
```

This uses `ts-node-dev` for hot reloading.

### Type Checking

```bash
npm run typecheck
```

### Build for Production

```bash
npm run build
```

This compiles TypeScript to JavaScript in the `dist/` folder.

### Run in Production

```bash
npm run start:prod
```

## Project Structure

```
backend/
├── src/
│   ├── database/
│   │   ├── db.ts           - Database connection
│   │   └── schema.ts       - Table schemas
│   ├── models/
│   │   ├── User.ts         - User model
│   │   ├── Subscription.ts - Subscription model
│   │   ├── Meeting.ts      - Meeting model
│   │   └── AiUsage.ts      - AI usage model
│   ├── routes/
│   │   ├── subscription.ts - Subscription routes
│   │   ├── meetings.ts     - Meeting routes
│   │   └── webhooks.ts     - Webhook routes
│   ├── middleware/
│   │   ├── auth.ts         - Authentication
│   │   ├── profitSafety.ts - AI cost limits
│   │   └── errorHandler.ts - Error handling
│   ├── services/
│   │   ├── lemonsqueezy.ts - Lemon Squeezy integration
│   │   └── usage.ts        - Usage tracking
│   ├── types/
│   │   └── index.ts        - TypeScript types
│   └── server.ts           - Main Express app
├── tsconfig.json           - TypeScript config
├── package.json            - Dependencies
├── .env.example            - Environment template
└── README.md               - This file
```

## Shared Code

The backend imports shared configuration from `../shared/`:

- `plans.ts` - Plan definitions and pricing
- `aiCost.ts` - AI cost calculation and limits

## Security

- ✅ JWT authentication for all protected routes
- ✅ CORS configuration
- ✅ Input validation
- ✅ SQL injection protection (prepared statements)
- ✅ Webhook signature verification
- ✅ Environment variable protection

**Important:** Always use HTTPS in production and keep your `.env` file secure!

## Profit Safety System

The backend implements a profit-safety system to ensure AI costs never exceed 50% of user revenue:

1. Track all AI usage in `ai_usage` table
2. Calculate max allowed spend based on plan pricing
3. Check remaining budget before allowing AI requests
4. Block requests that would exceed the limit

See `middleware/profitSafety.ts` and `services/usage.ts` for implementation.

## Troubleshooting

### "JWT_SECRET not set" warning

Generate a secret and add to `.env`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### "Lemon Squeezy API error"

Check that your API key and store ID are correct in `.env`.

### Database locked error

Make sure only one server instance is running. SQLite doesn't support concurrent writes well.

### Webhook not working

1. Check that `LEMON_SQUEEZY_WEBHOOK_SECRET` is set
2. Verify the webhook URL in Lemon Squeezy dashboard
3. Check server logs for webhook errors

## License

See LICENSE file in the root of the repository.
