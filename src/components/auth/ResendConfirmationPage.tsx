/**
 * Horalix Halo - Resend Confirmation Page
 *
 * Page to resend email confirmation link
 */

import React, { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { Card } from '../ui/card'

export function ResendConfirmationPage() {
  const { resendConfirmation } = useAuth()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess(false)
    setLoading(true)

    try {
      await resendConfirmation(email)
      setSuccess(true)
    } catch (err: any) {
      setError(err.message || 'Failed to resend confirmation email')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 via-pink-900 to-purple-800 p-4">
        <Card className="w-full max-w-md p-8 bg-black/40 backdrop-blur-xl border-purple-500/30 text-center">
          <div className="mb-6">
            <svg
              className="w-20 h-20 mx-auto text-green-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          </div>
          <h2 className="text-3xl font-bold text-white mb-4">Email Sent!</h2>
          <p className="text-gray-300 mb-6">
            We've sent a new confirmation link to <strong>{email}</strong>. Please check your inbox and click the link to activate your account.
          </p>
          <p className="text-sm text-gray-400 mb-6">
            Didn't receive the email? Check your spam folder or try again in a few minutes.
          </p>
          <a
            href="/login"
            className="inline-block px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold rounded-lg transition"
          >
            Go to Login
          </a>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 via-pink-900 to-purple-800 p-4">
      <Card className="w-full max-w-md p-8 bg-black/40 backdrop-blur-xl border-purple-500/30">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            Horalix Halo
          </h1>
          <p className="text-gray-400 mt-2">Resend Confirmation Email</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-black/50 border border-purple-500/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition"
              placeholder="you@example.com"
              required
            />
            <p className="mt-2 text-xs text-gray-500">
              Enter the email address you used to sign up
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Sending...' : 'Resend Confirmation Email'}
          </button>
        </form>

        {/* Login Link */}
        <div className="mt-6 text-center text-sm text-gray-400">
          Already confirmed your email?{' '}
          <a href="/login" className="text-purple-400 hover:text-purple-300 transition font-semibold">
            Login
          </a>
        </div>
      </Card>
    </div>
  )
}
