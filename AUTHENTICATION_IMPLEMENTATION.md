# 🔐 Horalix Halo - Enhanced Authentication System

## Implementation Status & Next Steps

This document outlines the comprehensive authentication system being built for Horalix Halo, including email/password, social login (Google & Apple), and biometric authentication via WebAuthn.

---

## ✅ What's Been Done

### **1. Database Schema Updated**

Added authentication fields to the `users` table:

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,

  -- Email/Password Authentication
  passwordHash TEXT,
  isEmailConfirmed INTEGER NOT NULL DEFAULT 0,
  emailConfirmToken TEXT,
  emailConfirmTokenExpires INTEGER,

  -- Social Authentication
  googleId TEXT UNIQUE,
  appleId TEXT UNIQUE,

  -- Subscription fields (existing)
  currentPlan TEXT NOT NULL DEFAULT 'free',
  billingCustomerId TEXT,
  lastFreeTrialStartedAt INTEGER,

  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);
```

### **2. WebAuthn Credentials Table Created**

For biometric authentication (Windows Hello, Touch ID, Face ID):

```sql
CREATE TABLE webauthn_credentials (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  credentialId TEXT UNIQUE NOT NULL,
  publicKey TEXT NOT NULL,
  counter INTEGER NOT NULL DEFAULT 0,
  transports TEXT,
  deviceName TEXT,
  createdAt INTEGER NOT NULL,
  lastUsedAt INTEGER,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);
```

### **3. Dependencies Added to package.json**

New authentication & testing dependencies:

**Production:**
- `bcrypt` - Password hashing
- `nodemailer` - Email sending
- `@simplewebauthn/server` - WebAuthn server
- `uuid` - Token generation

**Development:**
- `@types/bcrypt`, `@types/nodemailer`, `@types/uuid`
- `@simplewebauthn/types`
- `jest` - Testing framework
- `ts-jest` - TypeScript support for Jest

---

## 🚧 What Needs to Be Built Next

### **Priority 1: Core Authentication (Critical)**

#### **A. Email Service**
Create `backend/src/services/email.ts`:
- Configure `nodemailer` with SMTP settings
- Email templates for:
  - Email confirmation
  - Password reset
  - Welcome email
- HTML email templates with Horalix Halo branding

#### **B. Enhanced User Model**
Update `backend/src/models/User.ts`:
- Add methods for email/password auth:
  - `createWithPassword(email, password)` - Hash password with bcrypt
  - `verifyPassword(email, password)` - Compare hashed passwords
  - `confirmEmail(token)` - Mark email as confirmed
  - `generateEmailConfirmToken()` - Create secure token
- Add methods for social auth:
  - `findOrCreateByGoogleId(googleId, email, name)`
  - `findOrCreateByAppleId(appleId, email, name)`
- Add WebAuthn methods:
  - `addWebAuthnCredential(userId, credential)`
  - `getWebAuthnCredentials(userId)`

#### **C. Auth Routes**
Create `backend/src/routes/auth.ts` with endpoints:

**Email/Password:**
```
POST /api/auth/signup
  Body: { email, password, name }
  - Hash password with bcrypt (salt rounds: 12)
  - Generate email confirmation token
  - Send confirmation email
  - Return JWT token (but block certain actions until confirmed)

POST /api/auth/login
  Body: { email, password }
  - Verify password
  - Check if email is confirmed
  - Return JWT token with user data

GET /api/auth/confirm-email/:token
  - Verify token
  - Mark email as confirmed
  - Redirect to app or return success

POST /api/auth/resend-confirmation
  Body: { email }
  - Generate new token
  - Send email

POST /api/auth/forgot-password
  Body: { email }
  - Generate password reset token
  - Send reset email

POST /api/auth/reset-password
  Body: { token, newPassword }
  - Verify token
  - Hash new password
  - Update user
```

**Google OAuth:**
```
GET /api/auth/google
  - Generate Google OAuth URL
  - Include state parameter for CSRF protection
  - Return URL to frontend

GET /api/auth/google/callback
  - Exchange code for tokens
  - Get user info from Google
  - Find or create user by googleId
  - Return JWT token
```

**Apple Sign In:**
```
GET /api/auth/apple
  - Generate Apple OAuth URL
  - Return URL to frontend

POST /api/auth/apple/callback
  - Verify Apple ID token
  - Decode and validate JWT
  - Find or create user by appleId
  - Return JWT token
```

**WebAuthn (Biometric):**
```
POST /api/auth/webauthn/register-options
  Headers: Authorization (JWT)
  - Generate registration options
  - Return challenge and options for navigator.credentials.create()

POST /api/auth/webauthn/register-verify
  Headers: Authorization (JWT)
  Body: { credential, deviceName }
  - Verify registration response
  - Store public key and credential ID
  - Return success

POST /api/auth/webauthn/login-options
  Body: { email }
  - Get user's credentials
  - Generate authentication options
  - Return challenge and allowCredentials

POST /api/auth/webauthn/login-verify
  Body: { email, credential }
  - Verify authentication response
  - Update counter (replay protection)
  - Return JWT token

GET /api/auth/webauthn/credentials
  Headers: Authorization (JWT)
  - Return user's registered biometric devices

DELETE /api/auth/webauthn/credentials/:credentialId
  Headers: Authorization (JWT)
  - Remove biometric credential
```

---

### **Priority 2: Frontend Authentication UI**

#### **A. Auth Context**
Create `src/contexts/AuthContext.tsx`:
- Manage authentication state
- Store JWT token securely (Electron's safeStorage)
- Auto-refresh tokens
- Provide hooks: `useAuth()`, `useUser()`, `useIsAuthenticated()`

#### **B. Login/Signup Pages**
Create `src/components/auth/`:

**`LoginPage.tsx`:**
- Email/password login form
- "Continue with Google" button
- "Continue with Apple" button
- "Use Biometric Login" button (if previously registered)
- "Forgot Password" link
- "Don't have an account? Sign up" link

**`SignupPage.tsx`:**
- Email/password signup form
- Password strength indicator
- Terms of Service checkbox
- Privacy Policy link
- Social signup buttons

**`EmailConfirmation.tsx`:**
- Show after signup
- Display "Check your email" message
- Resend confirmation button
- Auto-redirect after confirmation

**`BiometricSetup.tsx`:**
- Prompt after first login
- Explain benefits (faster login, more secure)
- "Set up Touch ID/Windows Hello" button
- Skip option

#### **C. Settings Page**
Create `src/components/settings/AccountSettings.tsx`:
- Change password
- Connect/disconnect Google account
- Connect/disconnect Apple account
- Manage biometric devices (list, remove)
- Email confirmation status
- Delete account

---

### **Priority 3: Security & Best Practices**

#### **A. Security Measures**

**Password Security:**
- Minimum 8 characters, 1 uppercase, 1 lowercase, 1 number
- bcrypt with 12 salt rounds
- Rate limiting on login attempts (5 per minute)
- Lock account after 10 failed attempts

**Token Security:**
- JWT with strong secret (256-bit)
- Short expiry (1 hour access token)
- Refresh tokens (7 days)
- Secure HTTP-only cookies for web (N/A for Electron)
- Store tokens in Electron's `safeStorage` API

**Email Confirmation:**
- Tokens expire after 24 hours
- Use `crypto.randomBytes(32)` for token generation
- Single-use tokens (delete after confirmation)

**OAuth Security:**
- Verify `state` parameter (CSRF protection)
- Use PKCE for mobile apps
- Validate redirect URIs

**WebAuthn Security:**
- Challenge-response authentication
- Replay protection with counter
- User verification required
- Authenticator attachment: platform (biometric)

#### **B. Input Validation & Sanitization**

**Email Validation:**
```typescript
const isValidEmail = (email: string): boolean => {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return regex.test(email) && email.length <= 255
}
```

**Password Validation:**
```typescript
const isStrongPassword = (password: string): boolean => {
  if (password.length < 8) return false
  if (!/[A-Z]/.test(password)) return false
  if (!/[a-z]/.test(password)) return false
  if (!/[0-9]/.test(password)) return false
  return true
}
```

**Sanitization:**
- Use parameterized queries (SQLite prepared statements)
- Escape HTML in user inputs
- Validate all request bodies with schemas

#### **C. Error Handling**

**Don't Reveal:**
- Whether an email exists ("Invalid credentials" not "Email not found")
- Why login failed (don't say "wrong password")
- Internal error details to users

**Do Provide:**
- Clear user-friendly error messages
- Detailed logs server-side (with user IDs, timestamps)
- HTTP status codes (401, 403, 429, 500)

---

### **Priority 4: Testing**

#### **A. Test Infrastructure**

Create `backend/jest.config.js`:
```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**'
  ]
}
```

#### **B. Unit Tests**

**User Model Tests** (`src/models/__tests__/User.test.ts`):
```typescript
describe('User Model', () => {
  test('should hash password on creation', async () => {
    const user = await User.createWithPassword('test@example.com', 'Password123')
    expect(user.passwordHash).not.toBe('Password123')
    expect(user.passwordHash).toHaveLength(60) // bcrypt hash length
  })

  test('should verify correct password', async () => {
    const user = await User.createWithPassword('test@example.com', 'Password123')
    const isValid = await User.verifyPassword('test@example.com', 'Password123')
    expect(isValid).toBe(true)
  })

  test('should reject incorrect password', async () => {
    await User.createWithPassword('test@example.com', 'Password123')
    const isValid = await User.verifyPassword('test@example.com', 'WrongPassword')
    expect(isValid).toBe(false)
  })
})
```

**Auth Routes Tests** (`src/routes/__tests__/auth.test.ts`):
```typescript
describe('POST /api/auth/signup', () => {
  test('should create user and send confirmation email', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ email: 'new@example.com', password: 'Password123' })

    expect(res.status).toBe(201)
    expect(res.body).toHaveProperty('token')
    expect(res.body.user.isEmailConfirmed).toBe(false)
  })

  test('should reject weak password', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ email: 'new@example.com', password: 'weak' })

    expect(res.status).toBe(400)
    expect(res.body.error).toContain('password')
  })
})
```

#### **C. Integration Tests**

**Full Auth Flow:**
1. Signup → Receive confirmation email
2. Click confirmation link → Email confirmed
3. Login → Receive JWT
4. Access protected endpoint → Success
5. Logout → Token invalidated

---

### **Priority 5: Email Templates**

Create `backend/src/templates/email/`:

**`confirmation.html`:**
```html
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: sans-serif; max-width: 600px; margin: 0 auto; }
    .button { background: linear-gradient(135deg, #a855f7, #ec4899); color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block; }
  </style>
</head>
<body>
  <h1>Welcome to Horalix Halo! 💜</h1>
  <p>Hi there,</p>
  <p>Thanks for signing up! Click the button below to confirm your email address:</p>
  <p><a href="{{confirmUrl}}" class="button">Confirm Email</a></p>
  <p>Or copy this link: {{confirmUrl}}</p>
  <p>This link expires in 24 hours.</p>
  <p>If you didn't create an account, you can safely ignore this email.</p>
  <p>Best,<br>The Horalix Team</p>
</body>
</html>
```

---

### **Priority 6: Environment Variables**

Add to `backend/.env`:

```env
# SMTP Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM="Horalix Halo <noreply@horalix.com>"

# Frontend URL (for email links)
FRONTEND_URL=http://localhost:5180

# Google OAuth
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret

# Apple Sign In
APPLE_CLIENT_ID=com.horalix.halo
APPLE_TEAM_ID=your-team-id
APPLE_KEY_ID=your-key-id
APPLE_PRIVATE_KEY_PATH=./certs/AuthKey_XXXXXXXX.p8

# WebAuthn
WEBAUTHN_RP_NAME="Horalix Halo"
WEBAUTHN_RP_ID=localhost
WEBAUTHN_ORIGIN=http://localhost:5180
```

---

## 🎯 Implementation Checklist

### **Phase 1: Email/Password Auth** (2-3 hours)
- [ ] Create email service with nodemailer
- [ ] Create HTML email templates
- [ ] Update User model with password methods
- [ ] Create auth routes (signup, login, confirm)
- [ ] Add password validation
- [ ] Write unit tests for User model
- [ ] Write integration tests for auth routes

### **Phase 2: Google OAuth** (1-2 hours)
- [ ] Set up Google Cloud Console project
- [ ] Get OAuth credentials
- [ ] Implement OAuth flow
- [ ] Test with real Google account

### **Phase 3: Apple Sign In** (1-2 hours)
- [ ] Set up Apple Developer account
- [ ] Configure Sign in with Apple
- [ ] Implement OAuth flow
- [ ] Test with real Apple ID

### **Phase 4: WebAuthn Biometric** (2-3 hours)
- [ ] Implement registration flow
- [ ] Implement authentication flow
- [ ] Add credential management
- [ ] Test on Windows (Hello), macOS (Touch ID), Linux

### **Phase 5: Frontend UI** (3-4 hours)
- [ ] Create AuthContext
- [ ] Build login/signup pages
- [ ] Build email confirmation UI
- [ ] Build biometric setup flow
- [ ] Build account settings page

### **Phase 6: Testing & Polish** (2-3 hours)
- [ ] Complete test coverage (>80%)
- [ ] Test on all platforms (Windows, macOS, Linux)
- [ ] Fix bugs
- [ ] Improve error messages
- [ ] Add loading states

**Total Estimated Time: 12-18 hours**

---

## 📝 Next Immediate Steps

**To continue implementation, you need to:**

1. **Install Backend Dependencies:**
   ```bash
   cd backend
   npm install
   ```

2. **Set up SMTP for emails** (choose one):
   - Gmail: Enable 2FA, create App Password
   - SendGrid: Free tier (100 emails/day)
   - Mailgun: Free tier (5,000 emails/month)

3. **Create Google OAuth credentials:**
   - Go to Google Cloud Console
   - Create OAuth 2.0 Client ID
   - Add redirect URI: `http://localhost:3001/api/auth/google/callback`

4. **Implement Phase 1** (Email/Password):
   - I can continue building this if you want me to proceed

5. **Test thoroughly** on all target platforms

---

## 🚀 Benefits of This System

**Security:**
- Industry-standard bcrypt password hashing
- Email confirmation prevents fake accounts
- WebAuthn is phishing-resistant
- No passwords stored for social/biometric users

**User Experience:**
- Multiple login options (email, Google, Apple, biometric)
- Faster login with biometrics
- Works offline (biometric, if previously authenticated)
- No password to remember (social/biometric)

**Cross-Platform:**
- Windows Hello on Windows
- Touch ID / Face ID on macOS
- Fingerprint readers on Linux
- OAuth works on all platforms

**Compliance:**
- GDPR-ready (email confirmation, data deletion)
- Secure token storage
- Audit logs for security events

---

## ⚠️ Important Notes

**Testing WebAuthn:**
- Requires HTTPS in production (use Let's Encrypt)
- localhost works for development
- Test on actual devices with biometrics

**Email Deliverability:**
- Use SPF, DKIM, DMARC records
- Warm up email domain slowly
- Monitor spam complaints

**Rate Limiting:**
- Add rate limiting to prevent abuse
- 5 login attempts per minute
- 3 signup attempts per hour per IP

**Production Deployment:**
- Use environment-specific configs
- Enable HTTPS
- Set secure CORS origins
- Use production SMTP service

---

**Status:** Database schema ready ✅ | Dependencies added ✅ | Ready to implement auth routes 🚀

**Let me know if you want me to continue implementing the authentication system!**
