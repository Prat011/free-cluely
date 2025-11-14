# Authentication Routes - Implementation Summary

## File Location
`/home/user/free-cluely/backend/src/routes/auth.ts`

## Overview
A production-ready, comprehensive authentication system with 695 lines of code implementing email/password authentication, Google OAuth, email confirmation, password management, and account operations.

---

## Endpoints Implemented

### Email/Password Authentication

#### 1. **POST /api/auth/signup**
Create account with email/password and send confirmation email.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123"
}
```

**Response (201):**
```json
{
  "success": true,
  "userId": "user_1234567890_abc123",
  "message": "Account created! Please check your email to confirm your account."
}
```

**Features:**
- Email validation (max 255 chars, valid format)
- Password validation (min 8 chars, 1 uppercase, 1 lowercase, 1 number)
- Input sanitization
- Automatic confirmation email sending
- Generic error messages (doesn't reveal if email exists)
- TODO: Rate limiting for abuse prevention

---

#### 2. **POST /api/auth/login**
Login with email/password, requires confirmed email.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123"
}
```

**Response (200):**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user_1234567890_abc123",
    "email": "user@example.com",
    "currentPlan": "free",
    "isEmailConfirmed": true,
    "createdAt": 1234567890
  }
}
```

**Features:**
- Verifies password using bcrypt
- Checks email confirmation status
- Generates JWT token (30-day expiry)
- Generic error messages for security
- Server-side logging of failed attempts
- TODO: Rate limiting for brute force protection

---

#### 3. **GET /api/auth/confirm-email/:token**
Confirm email address with token from email.

**Response (200):**
```json
{
  "success": true,
  "message": "Email confirmed successfully! You can now log in."
}
```

**Features:**
- Validates token and expiry (24-hour window)
- Marks email as confirmed
- Sends welcome email automatically
- Clear error for expired/invalid tokens

---

#### 4. **POST /api/auth/resend-confirmation**
Resend confirmation email.

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "If an account exists with this email, a confirmation link has been sent."
}
```

**Features:**
- Generic response (prevents email enumeration)
- Skips if already confirmed (but still returns success)
- Generates new 24-hour token
- TODO: Rate limiting for abuse prevention

---

#### 5. **POST /api/auth/forgot-password**
Request password reset email.

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "If an account exists with this email, a password reset link has been sent."
}
```

**Features:**
- Generic response (prevents email enumeration)
- Generates secure reset token (1-hour expiry)
- Sends styled password reset email
- TODO: Rate limiting for abuse prevention

---

#### 6. **POST /api/auth/reset-password**
Reset password using token from email.

**Request Body:**
```json
{
  "token": "abc123def456...",
  "newPassword": "NewSecurePass123"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Password reset successfully! You can now log in with your new password."
}
```

**Features:**
- Validates new password strength
- Checks token validity and expiry
- Hashes password with bcrypt (12 rounds)
- Clears reset token after use

---

#### 7. **POST /api/auth/change-password** (Requires Auth)
Change password while logged in.

**Request Body:**
```json
{
  "currentPassword": "OldSecurePass123",
  "newPassword": "NewSecurePass456"
}
```

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Response (200):**
```json
{
  "success": true,
  "message": "Password changed successfully!"
}
```

**Features:**
- Requires authentication
- Verifies current password
- Validates new password strength
- Ensures new password is different from current

---

### Google OAuth

#### 8. **GET /api/auth/google**
Generate Google OAuth authorization URL.

**Query Parameters:**
- `state` (optional): State to pass through OAuth flow

**Response (200):**
```json
{
  "success": true,
  "authUrl": "https://accounts.google.com/o/oauth2/v2/auth?..."
}
```

**Features:**
- Generates OAuth URL with calendar scopes
- Supports custom state parameter
- Uses existing GoogleCalendarService

---

#### 9. **GET /api/auth/google/callback**
Handle Google OAuth callback and authenticate user.

**Query Parameters:**
- `code`: Authorization code from Google
- `state` (optional): State from OAuth flow

**Response:**
Returns HTML page that:
- Displays success message
- Sends token to parent window (if popup)
- Redirects to frontend with token (if not popup)
- Auto-closes popup window

**Features:**
- Exchanges code for access/refresh tokens
- Fetches user info from Google (email, ID)
- Finds or creates user account
- Links Google ID to existing email accounts
- Auto-confirms email for OAuth users
- Generates JWT token
- Beautiful styled success page

---

### Profile & Account Management

#### 10. **GET /api/auth/me** (Requires Auth)
Get current user profile.

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Response (200):**
```json
{
  "success": true,
  "user": {
    "id": "user_1234567890_abc123",
    "email": "user@example.com",
    "currentPlan": "free",
    "isEmailConfirmed": true,
    "hasPassword": true,
    "hasGoogleAuth": false,
    "hasAppleAuth": false,
    "createdAt": 1234567890,
    "updatedAt": 1234567890
  }
}
```

**Features:**
- Requires authentication
- Shows auth methods available
- Doesn't expose sensitive data (tokens, hashes)

---

#### 11. **DELETE /api/auth/account** (Requires Auth)
Delete user account and all associated data.

**Request Body:**
```json
{
  "password": "SecurePass123"  // Required if user has password auth
}
```

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Response (200):**
```json
{
  "success": true,
  "message": "Account deleted successfully. We're sorry to see you go!"
}
```

**Features:**
- Requires authentication
- Requires password confirmation (if password auth exists)
- CASCADE deletes all related data (subscriptions, meetings, AI usage, etc.)
- Server-side logging

---

## Input Validation

### Email Validation
- **Required**: Yes
- **Format**: Valid email pattern (`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`)
- **Max Length**: 255 characters
- **Sanitization**: Trimmed, lowercased

### Password Validation
- **Required**: Yes
- **Min Length**: 8 characters
- **Requirements**:
  - At least 1 uppercase letter (A-Z)
  - At least 1 lowercase letter (a-z)
  - At least 1 number (0-9)
- **Hashing**: bcrypt with 12 rounds

### Input Sanitization
All string inputs are:
- Trimmed of whitespace
- Limited to max length (default 255 chars)
- Lowercased (for emails)

---

## Error Handling

### HTTP Status Codes
- **200**: Success
- **201**: Created (signup)
- **400**: Validation error
- **401**: Authentication error
- **404**: Not found
- **500**: Server error

### Error Types Used
- `ValidationError` (400): Invalid input
- `AuthenticationError` (401): Invalid credentials, unconfirmed email
- `NotFoundError` (404): User/token not found

### Security Best Practices
✅ **Generic error messages** - Don't reveal if email exists
✅ **Server-side logging** - All auth events logged
✅ **Token expiry** - Email confirmation (24h), password reset (1h)
✅ **Password complexity** - Enforced on all password operations
✅ **Email enumeration protection** - Same response for existing/non-existing emails

---

## Security Features

### Password Security
- ✅ **bcrypt hashing** with 12 rounds (already in User model)
- ✅ **Password strength validation** on all operations
- ✅ **Current password verification** for changes

### Token Security
- ✅ **Secure random tokens** using `crypto.randomBytes(32)` (64 hex chars)
- ✅ **Token expiry**: 24h for email confirmation, 1h for password reset
- ✅ **Single-use tokens**: Cleared after successful use
- ✅ **JWT tokens**: 30-day expiry for session management

### Email Confirmation
- ✅ **Required for login** (password auth only)
- ✅ **Auto-confirmed for OAuth** users
- ✅ **Welcome email** sent after confirmation

### Rate Limiting
⚠️ **TODO**: Implementation needed for:
- Signup endpoint (prevent spam accounts)
- Login endpoint (prevent brute force)
- Resend confirmation (prevent abuse)
- Forgot password (prevent abuse)

**Recommended**: Use `express-rate-limit` package
```typescript
import rateLimit from 'express-rate-limit'

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: 'Too many attempts, please try again later'
})

router.post('/login', authLimiter, async (req, res, next) => {
  // ...
})
```

---

## Email Service Integration

### Templates Used
1. **Confirmation Email** (`sendConfirmationEmail`)
   - Sent on signup
   - 24-hour expiry link
   - Styled HTML with gradient buttons

2. **Password Reset Email** (`sendPasswordResetEmail`)
   - Sent on forgot password
   - 1-hour expiry link
   - Security warning included

3. **Welcome Email** (`sendWelcomeEmail`)
   - Sent after email confirmation
   - Feature highlights
   - Getting started links

### Email Configuration
Emails are sent using the existing email service at `/home/user/free-cluely/backend/src/services/email.ts`:
- Uses nodemailer
- Supports SMTP configuration via env vars
- Falls back to console logging in development
- Beautiful HTML templates with gradients

---

## Google OAuth Flow

### Scopes Requested
```javascript
[
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile'
]
```

### OAuth Flow
1. User clicks "Sign in with Google"
2. Frontend calls `GET /api/auth/google` to get authUrl
3. User redirected to Google consent screen
4. User approves permissions
5. Google redirects to `GET /api/auth/google/callback?code=...`
6. Backend exchanges code for tokens
7. Backend fetches user info from Google
8. Backend finds or creates user account
9. Backend links Google ID to account
10. Backend generates JWT token
11. User redirected back to frontend with token

### Account Linking
- If user exists with same email: Links Google ID to existing account
- If user is new: Creates new account with Google ID
- Auto-confirms email for OAuth users

---

## User Model Methods Used

```typescript
// Creating users
UserModel.createWithPassword(email, password) // Returns User with emailConfirmToken

// Authentication
UserModel.verifyPassword(email, password) // Returns User | null

// Email confirmation
UserModel.confirmEmail(token) // Returns User | null
UserModel.generateEmailConfirmToken(userId) // Returns token string

// Password reset
UserModel.generatePasswordResetToken(email) // Returns token | null
UserModel.resetPassword(token, newPassword) // Returns User | null

// OAuth
UserModel.findOrCreateByGoogleId(googleId, email) // Returns User

// Queries
UserModel.findByEmail(email) // Returns User | null
UserModel.findById(id) // Returns User | null

// Account management
UserModel.delete(userId) // Returns boolean
```

---

## Development Endpoints

### **POST /api/auth/dev/create-test-user** (Development Only)
Creates a test user with auto-confirmed email.

**Available when**: `process.env.NODE_ENV === 'development'`

**Request Body:**
```json
{
  "email": "test@example.com",
  "password": "TestPass123"
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "user_...",
    "email": "test@example.com"
  },
  "token": "eyJhbGci...",
  "message": "Test user created and auto-confirmed"
}
```

---

## Environment Variables Required

```env
# JWT Secret (REQUIRED in production)
JWT_SECRET=your-secret-key-change-this-in-production

# SMTP Configuration (for emails)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM="Horalix Halo" <noreply@horalix.com>

# Google OAuth (for Google sign-in)
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3001/api/auth/google/callback

# Frontend URL (for email links and redirects)
FRONTEND_URL=http://localhost:5180
```

---

## Integration Steps

### 1. Register the routes in your Express app

Edit `/home/user/free-cluely/backend/src/server.ts`:

```typescript
import authRoutes from './routes/auth'

// ... other imports

app.use('/api/auth', authRoutes)
```

### 2. Install required dependencies (if not already installed)

```bash
npm install express jsonwebtoken bcrypt nodemailer googleapis
npm install -D @types/express @types/jsonwebtoken @types/bcrypt @types/nodemailer
```

### 3. Set up environment variables

Create or update `.env` file with the required variables listed above.

### 4. Test the endpoints

```bash
# Signup
curl -X POST http://localhost:3001/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"TestPass123"}'

# Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"TestPass123"}'

# Get profile
curl -X GET http://localhost:3001/api/auth/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## Frontend Integration Example

### Login Flow
```typescript
// Login
const response = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'SecurePass123'
  })
})

const { token, user } = await response.json()

// Store token
localStorage.setItem('authToken', token)

// Use token for authenticated requests
const profileResponse = await fetch('/api/auth/me', {
  headers: { 'Authorization': `Bearer ${token}` }
})
```

### Google OAuth Flow
```typescript
// Get OAuth URL
const response = await fetch('/api/auth/google')
const { authUrl } = await response.json()

// Open popup
const popup = window.open(authUrl, 'Google Sign In', 'width=500,height=600')

// Listen for auth success
window.addEventListener('message', (event) => {
  if (event.data.type === 'auth_success') {
    const { token, user } = event.data
    localStorage.setItem('authToken', token)
    // Redirect or update UI
  }
})
```

---

## Logging Examples

All auth events are logged server-side:

```
[Auth] New user signup: user_1234567890_abc123 (test@example.com)
[Auth] Successful login: user_1234567890_abc123 (test@example.com)
[Auth] Failed login attempt for: wrong@example.com
[Auth] Login attempt with unconfirmed email: user_1234567890_abc123
[Auth] Email confirmed for user: user_1234567890_abc123
[Auth] Password reset email sent: test@example.com
[Auth] Password changed successfully: user_1234567890_abc123
[Auth] Google OAuth successful: user_1234567890_abc123 (oauth@example.com)
[Auth] Account deleted: user_1234567890_abc123 (test@example.com)
```

---

## Security Checklist

✅ **Input Validation**: Email format, password strength
✅ **Input Sanitization**: Trim, lowercase, length limits
✅ **Password Hashing**: bcrypt with 12 rounds
✅ **Secure Tokens**: crypto.randomBytes(32)
✅ **Token Expiry**: 24h confirmation, 1h reset
✅ **Email Confirmation**: Required for password auth
✅ **Generic Error Messages**: No email enumeration
✅ **Server-Side Logging**: All auth events tracked
✅ **Account Deletion**: CASCADE removes all data
✅ **Password Confirmation**: Required for account deletion
⚠️ **Rate Limiting**: TODO - needs implementation
⚠️ **JWT Secret**: Ensure set in production

---

## Testing Checklist

### Manual Testing
- [ ] Signup with valid credentials
- [ ] Signup with invalid email format
- [ ] Signup with weak password
- [ ] Signup with existing email
- [ ] Login with correct credentials
- [ ] Login with wrong password
- [ ] Login before email confirmation
- [ ] Email confirmation with valid token
- [ ] Email confirmation with expired token
- [ ] Resend confirmation email
- [ ] Forgot password flow
- [ ] Reset password with valid token
- [ ] Reset password with expired token
- [ ] Change password while authenticated
- [ ] Google OAuth signup (new user)
- [ ] Google OAuth login (existing user)
- [ ] Get profile while authenticated
- [ ] Delete account with password
- [ ] Delete account without password (OAuth user)

### Automated Testing (Recommended)
```typescript
// Example test with Jest/Supertest
describe('POST /api/auth/signup', () => {
  it('should create a new user', async () => {
    const response = await request(app)
      .post('/api/auth/signup')
      .send({
        email: 'test@example.com',
        password: 'TestPass123'
      })

    expect(response.status).toBe(201)
    expect(response.body.success).toBe(true)
    expect(response.body.userId).toBeDefined()
  })
})
```

---

## Future Enhancements

### Immediate (Production Requirements)
1. **Rate Limiting**: Implement on all auth endpoints
2. **Email Templates**: Move to separate files
3. **Logging**: Integrate with proper logging service (Winston, Pino)
4. **Monitoring**: Add metrics for failed login attempts

### Medium-Term
1. **2FA/MFA**: Add TOTP-based two-factor authentication
2. **Session Management**: Add session tracking and invalidation
3. **OAuth Providers**: Add Apple, Microsoft, GitHub
4. **Password History**: Prevent password reuse
5. **Account Recovery**: Alternative recovery methods

### Long-Term
1. **WebAuthn/Passkeys**: Passwordless authentication
2. **SSO Integration**: Enterprise SSO support
3. **Security Notifications**: Email on suspicious activity
4. **Account Lockout**: Temporary lockout after failed attempts

---

## Files Modified/Created

### Created
- `/home/user/free-cluely/backend/src/routes/auth.ts` (695 lines)

### Dependencies (Already in project)
- `/home/user/free-cluely/backend/src/models/User.ts` - User model with auth methods
- `/home/user/free-cluely/backend/src/services/email.ts` - Email service
- `/home/user/free-cluely/backend/src/middleware/auth.ts` - JWT middleware
- `/home/user/free-cluely/backend/src/services/googleCalendar.ts` - OAuth service
- `/home/user/free-cluely/backend/src/types/index.ts` - Error types

---

## Support & Troubleshooting

### Common Issues

**Issue**: "Invalid or expired token" on email confirmation
- **Cause**: Token expired (24h limit) or already used
- **Solution**: Request new confirmation email

**Issue**: "Please confirm your email" on login
- **Cause**: Email not confirmed yet
- **Solution**: Check inbox for confirmation email, or resend

**Issue**: "Failed to send email" errors
- **Cause**: SMTP not configured
- **Solution**: Set SMTP env vars or use development mode (console logging)

**Issue**: Google OAuth fails with "Missing authorization code"
- **Cause**: User cancelled OAuth flow or redirect URI mismatch
- **Solution**: Check GOOGLE_REDIRECT_URI matches Google Console settings

---

## Documentation Links

- [bcrypt](https://www.npmjs.com/package/bcrypt) - Password hashing
- [jsonwebtoken](https://www.npmjs.com/package/jsonwebtoken) - JWT tokens
- [express-rate-limit](https://www.npmjs.com/package/express-rate-limit) - Rate limiting
- [nodemailer](https://www.npmjs.com/package/nodemailer) - Email sending
- [googleapis](https://www.npmjs.com/package/googleapis) - Google OAuth

---

**Created**: 2025-11-14
**Author**: Claude Code
**Version**: 1.0.0
**Status**: Production-Ready (pending rate limiting implementation)
