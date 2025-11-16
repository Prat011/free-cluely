# 🚨 CRITICAL ACTION ITEMS

**Status:** 3 CRITICAL security issues identified
**Last Updated:** 2025-11-16

---

## 🔴 CRITICAL - Must Fix Before Production

### 1. Add JWT Authentication to Frontend API Calls (2 hours)

**Current State:** 🚨 BROKEN - Backend auth is bypassed

**Files to Fix:**
```typescript
// src/contexts/SubscriptionContext.tsx
import { useAuth } from './AuthContext'

export const SubscriptionProvider = ({ children }) => {
  const { token } = useAuth()  // ← ADD THIS

  // Line 80-86: fetchSubscription()
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,  // ← FIX
  }

  // Line 213-215: startCheckout()
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,  // ← FIX
  }
}

// src/components/calendar/CalendarPage.tsx
import { useAuth } from '@/contexts/AuthContext'

function CalendarPage() {
  const { token } = useAuth()  // ← ADD THIS

  // Fix 4 fetch calls (lines 57, 76, 100, 132)
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,  // ← FIX
  }
}
```

**Test:**
```bash
# Should return 401 without token
curl http://localhost:3001/api/subscription/me

# Should work with token
curl -H "Authorization: Bearer <token>" http://localhost:3001/api/subscription/me
```

---

### 2. Add Rate Limiting to Auth Endpoints (30 min)

**Current State:** 🚨 VULNERABLE to brute force

**File to Fix:**
```typescript
// backend/src/routes/auth.ts
import rateLimit from 'express-rate-limit'

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: 'Too many attempts, try again later',
})

// Apply to:
router.post('/login', authLimiter, ...)       // Line 198
router.post('/signup', authLimiter, ...)      // Line 139
router.post('/forgot-password', authLimiter, ...)  // Line 289
router.post('/resend-confirmation', authLimiter, ...)  // Line 336
```

**Test:**
```bash
# Try logging in 6 times rapidly
for i in {1..6}; do
  curl -X POST http://localhost:3001/api/auth/login \
    -H 'Content-Type: application/json' \
    -d '{"email":"test@test.com","password":"wrong"}'
done
# 6th request should return 429
```

---

### 3. Implement Webhook Signature Verification (1 hour)

**Current State:** 🚨 INSECURE - Returns `true` for all webhooks!

**File to Fix:**
```typescript
// backend/src/services/lemonsqueezy.ts:162-163
import crypto from 'crypto'

export function verifyWebhookSignature(
  payload: string,
  signature: string
): boolean {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET
  if (!secret) {
    throw new Error('LEMONSQUEEZY_WEBHOOK_SECRET not set')
  }

  const hmac = crypto.createHmac('sha256', secret)
  hmac.update(payload)
  const expected = hmac.digest('hex')

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  )
}

// backend/.env.example (add this line)
LEMONSQUEEZY_WEBHOOK_SECRET=your_webhook_secret_here
```

**Test:**
```bash
# Invalid signature should be rejected
curl -X POST http://localhost:3001/api/webhooks/lemonsqueezy \
  -H 'X-Signature: fake_signature' \
  -d '{"event":"subscription_created"}'
# Should return 401
```

---

## 🟠 HIGH PRIORITY - Should Fix Soon

### 4. Refactor Large Route Files (4-6 hours)

**Files:**
- `backend/src/routes/auth.ts` (709 lines)
- `backend/src/routes/webauthn.ts` (558 lines)

**Plan:**
```
routes/auth.ts → Split into:
  - auth/controllers/signupController.ts
  - auth/controllers/loginController.ts
  - auth/controllers/passwordResetController.ts
  - auth/services/emailService.ts
  - auth/services/authService.ts
```

---

### 5. Replace console.log with Structured Logging (2 hours)

**Create:**
```typescript
// src/lib/logger.ts
export function createLogger(context: string) {
  return {
    info: (msg: string, meta?: any) =>
      console.log(`[${context}] ${msg}`, meta),
    error: (msg: string, err?: any) =>
      console.error(`[${context}] ERROR: ${msg}`, err),
    warn: (msg: string, meta?: any) =>
      console.warn(`[${context}] WARN: ${msg}`, meta),
  }
}
```

**Replace in 42 files:**
```typescript
// Before
console.log('Fetching data...')

// After
import { createLogger } from '@/lib/logger'
const logger = createLogger('ComponentName')
logger.info('Fetching data...')
```

---

### 6. Improve Error Handling (3-4 hours)

**Create error types:**
```typescript
// shared/errors.ts
export class AppError extends Error {
  constructor(
    public code: string,
    public statusCode: number,
    message: string
  ) {
    super(message)
  }
}

export class AuthError extends AppError {
  constructor(message: string) {
    super('AUTH_ERROR', 401, message)
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super('VALIDATION_ERROR', 400, message)
  }
}
```

**Use in catch blocks:**
```typescript
// Instead of:
catch (error: any) {
  console.error(error)
}

// Do this:
catch (error) {
  if (error instanceof AuthError) {
    logger.error('Auth failed', { error })
    throw error
  }
  throw new AppError('UNKNOWN_ERROR', 500, 'An error occurred')
}
```

---

## 🟡 MEDIUM PRIORITY

7. ⬜ Add ESLint configuration
8. ⬜ Set up Prettier
9. ⬜ Increase test coverage (currently ~5%)
10. ⬜ Optimize React contexts (reduce re-renders)

---

## ✅ COMPLETED

- [x] Fix Electron entry point
- [x] Initialize LLM & Session engines
- [x] Remove legacy code (23,320 lines)
- [x] Eliminate all @ts-ignore
- [x] Project architecture audit

---

## 🚀 Quick Start

```bash
# Fix JWT auth (highest priority)
git checkout -b fix/jwt-authentication
# Edit files listed in #1 above
git commit -m "fix: Add JWT tokens to frontend API calls"

# Fix rate limiting
git checkout main
git checkout -b fix/rate-limiting
# Edit files listed in #2 above
git commit -m "fix: Add rate limiting to auth endpoints"

# Fix webhooks
git checkout main
git checkout -b fix/webhook-verification
# Edit files listed in #3 above
git commit -m "fix: Implement webhook signature verification"
```

---

**See `CODEBASE_AUDIT_REPORT.md` for full details.**
