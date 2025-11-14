/**
 * Horalix Halo - Email Confirmed Page
 *
 * Success page shown after user confirms their email
 */

import React, { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Card } from '../ui/card'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

export function EmailConfirmedPage() {
  const location = useLocation()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const confirmEmail = async () => {
      // Extract token from URL query params
      const params = new URLSearchParams(location.search)
      const token = params.get('token')

      if (!token) {
        setStatus('error')
        setMessage('Invalid confirmation link. Please try again.')
        return
      }

      try {
        const response = await fetch(`${API_URL}/api/auth/confirm-email?token=${token}`)
        const data = await response.json()

        if (data.success) {
          setStatus('success')
          setMessage(data.message || 'Your email has been confirmed successfully!')
        } else {
          setStatus('error')
          setMessage(data.error || 'Email confirmation failed')
        }
      } catch (error) {
        setStatus('error')
        setMessage('Failed to confirm email. Please try again.')
      }
    }

    confirmEmail()
  }, [location])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 via-pink-900 to-purple-800 p-4">
      <Card className="w-full max-w-md p-8 bg-black/40 backdrop-blur-xl border-purple-500/30 text-center">
        {status === 'loading' && (
          <>
            <div className="mb-6">
              <div className="w-20 h-20 mx-auto border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
            <h2 className="text-3xl font-bold text-white mb-4">Confirming Your Email...</h2>
            <p className="text-gray-300">Please wait while we confirm your email address.</p>
          </>
        )}

        {status === 'success' && (
          <>
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
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h2 className="text-3xl font-bold text-white mb-4">Email Confirmed!</h2>
            <p className="text-gray-300 mb-6">{message}</p>
            <p className="text-gray-400 mb-6">
              Your account is now active. You can log in and start using Horalix Halo!
            </p>
            <a
              href="/login"
              className="inline-block px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold rounded-lg transition"
            >
              Go to Login
            </a>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="mb-6">
              <svg
                className="w-20 h-20 mx-auto text-red-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h2 className="text-3xl font-bold text-white mb-4">Confirmation Failed</h2>
            <p className="text-gray-300 mb-6">{message}</p>
            <div className="space-y-3">
              <a
                href="/resend-confirmation"
                className="inline-block px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition"
              >
                Resend Confirmation Email
              </a>
              <br />
              <a
                href="/signup"
                className="inline-block px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition"
              >
                Back to Signup
              </a>
            </div>
          </>
        )}
      </Card>
    </div>
  )
}
