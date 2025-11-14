/**
 * Horalix Halo Backend - Email Service
 *
 * Handles all email sending with nodemailer
 */

import nodemailer from 'nodemailer'
import { readFileSync } from 'fs'
import { join } from 'path'

// ============================================================================
// EMAIL CONFIGURATION
// ============================================================================

const EMAIL_CONFIG = {
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
}

const FROM_EMAIL = process.env.EMAIL_FROM || '"Horalix Halo" <noreply@horalix.com>'
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5180'

// ============================================================================
// TRANSPORTER SETUP
// ============================================================================

let transporter: nodemailer.Transporter | null = null

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    // Check if SMTP is configured
    if (!EMAIL_CONFIG.auth.user || !EMAIL_CONFIG.auth.pass) {
      console.warn('⚠️  SMTP credentials not configured. Emails will be logged to console only.')

      // Create test account for development
      transporter = nodemailer.createTransport({
        streamTransport: true,
        newline: 'unix',
        buffer: true,
      })
    } else {
      transporter = nodemailer.createTransport(EMAIL_CONFIG)
    }
  }
  return transporter
}

// ============================================================================
// EMAIL TEMPLATES
// ============================================================================

interface EmailTemplate {
  subject: string
  html: string
  text: string
}

function renderTemplate(templateName: string, variables: Record<string, string>): EmailTemplate {
  // For now, use inline templates. In production, load from files.
  const templates: Record<string, (vars: Record<string, string>) => EmailTemplate> = {
    confirmation: (vars) => ({
      subject: 'Confirm Your Email - Horalix Halo',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              background: linear-gradient(135deg, #a855f7, #ec4899);
              color: white;
              padding: 30px;
              border-radius: 8px 8px 0 0;
              text-align: center;
            }
            .content {
              background: #f9fafb;
              padding: 30px;
              border-radius: 0 0 8px 8px;
            }
            .button {
              display: inline-block;
              background: linear-gradient(135deg, #a855f7, #ec4899);
              color: white;
              padding: 14px 28px;
              text-decoration: none;
              border-radius: 8px;
              font-weight: 600;
              margin: 20px 0;
            }
            .button:hover {
              opacity: 0.9;
            }
            .footer {
              text-align: center;
              color: #666;
              font-size: 12px;
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #ddd;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>💜 Welcome to Horalix Halo!</h1>
          </div>
          <div class="content">
            <p>Hi there,</p>
            <p>Thanks for signing up for Horalix Halo, your AI meeting copilot!</p>
            <p>Click the button below to confirm your email address and activate your account:</p>
            <p style="text-align: center;">
              <a href="${vars.confirmUrl}" class="button">Confirm Email Address</a>
            </p>
            <p style="font-size: 13px; color: #666;">
              Or copy and paste this link into your browser:<br>
              <a href="${vars.confirmUrl}">${vars.confirmUrl}</a>
            </p>
            <p style="font-size: 13px; color: #999; margin-top: 30px;">
              This link will expire in 24 hours.
            </p>
            <p>If you didn't create an account, you can safely ignore this email.</p>
            <p>Best regards,<br>The Horalix Team</p>
          </div>
          <div class="footer">
            <p>© 2025 Horalix Halo. All rights reserved.</p>
          </div>
        </body>
        </html>
      `,
      text: `Welcome to Horalix Halo!

Thanks for signing up! Click the link below to confirm your email address:

${vars.confirmUrl}

This link will expire in 24 hours.

If you didn't create an account, you can safely ignore this email.

Best regards,
The Horalix Team
`,
    }),

    'password-reset': (vars) => ({
      subject: 'Reset Your Password - Horalix Halo',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              background: linear-gradient(135deg, #a855f7, #ec4899);
              color: white;
              padding: 30px;
              border-radius: 8px 8px 0 0;
              text-align: center;
            }
            .content {
              background: #f9fafb;
              padding: 30px;
              border-radius: 0 0 8px 8px;
            }
            .button {
              display: inline-block;
              background: linear-gradient(135deg, #a855f7, #ec4899);
              color: white;
              padding: 14px 28px;
              text-decoration: none;
              border-radius: 8px;
              font-weight: 600;
              margin: 20px 0;
            }
            .footer {
              text-align: center;
              color: #666;
              font-size: 12px;
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #ddd;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>🔐 Reset Your Password</h1>
          </div>
          <div class="content">
            <p>Hi there,</p>
            <p>We received a request to reset your password for your Horalix Halo account.</p>
            <p>Click the button below to create a new password:</p>
            <p style="text-align: center;">
              <a href="${vars.resetUrl}" class="button">Reset Password</a>
            </p>
            <p style="font-size: 13px; color: #666;">
              Or copy and paste this link into your browser:<br>
              <a href="${vars.resetUrl}">${vars.resetUrl}</a>
            </p>
            <p style="font-size: 13px; color: #999; margin-top: 30px;">
              This link will expire in 1 hour.
            </p>
            <p>If you didn't request a password reset, you can safely ignore this email. Your password will not be changed.</p>
            <p>Best regards,<br>The Horalix Team</p>
          </div>
          <div class="footer">
            <p>© 2025 Horalix Halo. All rights reserved.</p>
          </div>
        </body>
        </html>
      `,
      text: `Reset Your Password

We received a request to reset your password for your Horalix Halo account.

Click the link below to create a new password:

${vars.resetUrl}

This link will expire in 1 hour.

If you didn't request a password reset, you can safely ignore this email.

Best regards,
The Horalix Team
`,
    }),

    'welcome': (vars) => ({
      subject: 'Welcome to Horalix Halo! 🎉',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              background: linear-gradient(135deg, #a855f7, #ec4899);
              color: white;
              padding: 30px;
              border-radius: 8px 8px 0 0;
              text-align: center;
            }
            .content {
              background: #f9fafb;
              padding: 30px;
              border-radius: 0 0 8px 8px;
            }
            .feature {
              background: white;
              padding: 15px;
              margin: 10px 0;
              border-radius: 6px;
              border-left: 4px solid #a855f7;
            }
            .button {
              display: inline-block;
              background: linear-gradient(135deg, #a855f7, #ec4899);
              color: white;
              padding: 14px 28px;
              text-decoration: none;
              border-radius: 8px;
              font-weight: 600;
              margin: 20px 0;
            }
            .footer {
              text-align: center;
              color: #666;
              font-size: 12px;
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #ddd;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>🎉 You're All Set!</h1>
          </div>
          <div class="content">
            <p>Hi ${vars.name || 'there'},</p>
            <p>Your email has been confirmed! Welcome to Horalix Halo - your AI meeting copilot.</p>

            <h3>✨ What you can do now:</h3>

            <div class="feature">
              <strong>🎤 Start Your First Meeting</strong><br>
              Get real-time AI assistance during calls with instant suggestions
            </div>

            <div class="feature">
              <strong>📅 Connect Your Calendar</strong><br>
              Sync Google Calendar for context-aware meeting prep
            </div>

            <div class="feature">
              <strong>💜 Explore Premium Features</strong><br>
              Upgrade to Plus or Ultra for advanced AI capabilities
            </div>

            <p style="text-align: center;">
              <a href="${FRONTEND_URL}/meetings" class="button">Start Your First Meeting</a>
            </p>

            <p>Need help getting started? Check out our <a href="${FRONTEND_URL}/docs">documentation</a> or contact support.</p>

            <p>Happy meeting!<br>The Horalix Team</p>
          </div>
          <div class="footer">
            <p>© 2025 Horalix Halo. All rights reserved.</p>
          </div>
        </body>
        </html>
      `,
      text: `You're All Set!

Your email has been confirmed! Welcome to Horalix Halo - your AI meeting copilot.

What you can do now:
- Start your first meeting with real-time AI assistance
- Connect your Google Calendar
- Explore premium features

Visit ${FRONTEND_URL}/meetings to get started!

Need help? Check out our documentation at ${FRONTEND_URL}/docs

Happy meeting!
The Horalix Team
`,
    }),
  }

  const template = templates[templateName]
  if (!template) {
    throw new Error(`Email template "${templateName}" not found`)
  }

  return template(variables)
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Send confirmation email
 */
export async function sendConfirmationEmail(
  to: string,
  confirmToken: string
): Promise<void> {
  const confirmUrl = `${FRONTEND_URL}/auth/confirm-email/${confirmToken}`
  const { subject, html, text } = renderTemplate('confirmation', { confirmUrl })

  await sendEmail({
    to,
    subject,
    html,
    text,
  })
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(
  to: string,
  resetToken: string
): Promise<void> {
  const resetUrl = `${FRONTEND_URL}/auth/reset-password/${resetToken}`
  const { subject, html, text } = renderTemplate('password-reset', { resetUrl })

  await sendEmail({
    to,
    subject,
    html,
    text,
  })
}

/**
 * Send welcome email after confirmation
 */
export async function sendWelcomeEmail(to: string, name?: string): Promise<void> {
  const { subject, html, text } = renderTemplate('welcome', { name: name || '' })

  await sendEmail({
    to,
    subject,
    html,
    text,
  })
}

/**
 * Generic email sending function
 */
export async function sendEmail(options: {
  to: string
  subject: string
  html: string
  text: string
}): Promise<void> {
  try {
    const transporter = getTransporter()

    const info = await transporter.sendMail({
      from: FROM_EMAIL,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    })

    if (process.env.NODE_ENV === 'development') {
      console.log('✉️  Email sent:', {
        to: options.to,
        subject: options.subject,
        messageId: info.messageId,
      })

      // If using stream transport (no SMTP), log the message
      if (info.message) {
        console.log('📧 Email content:', info.message.toString())
      }
    }
  } catch (error) {
    console.error('❌ Failed to send email:', error)
    throw new Error('Failed to send email')
  }
}

/**
 * Test email configuration
 */
export async function testEmailConfig(): Promise<boolean> {
  try {
    const transporter = getTransporter()

    if (EMAIL_CONFIG.auth.user && EMAIL_CONFIG.auth.pass) {
      await transporter.verify()
      console.log('✅ SMTP connection verified')
      return true
    } else {
      console.log('⚠️  SMTP not configured, using console logging')
      return false
    }
  } catch (error) {
    console.error('❌ SMTP connection failed:', error)
    return false
  }
}
