/**
 * Horalix Halo - Biometric Setup Wizard
 *
 * Step-by-step guide to register biometric authentication
 */

import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { startRegistration } from '@simplewebauthn/browser'
import { useAuth } from '../../contexts/AuthContext'
import { Card } from '../ui/card'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

type Step = 'intro' | 'name' | 'register' | 'success' | 'error'

export function BiometricSetupPage() {
  const { token } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('intro')
  const [deviceName, setDeviceName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleStartSetup = () => {
    setStep('name')
  }

  const handleNameSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!deviceName.trim()) {
      setError('Please enter a device name')
      return
    }
    setError('')
    setStep('register')
    handleRegisterBiometric()
  }

  const handleRegisterBiometric = async () => {
    setLoading(true)
    setError('')

    try {
      // Step 1: Get registration options from server
      const optionsResponse = await fetch(`${API_URL}/api/auth/webauthn/register/options`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ deviceName }),
      })

      const optionsData = await optionsResponse.json()

      if (!optionsData.success) {
        throw new Error(optionsData.error || 'Failed to get registration options')
      }

      // Step 2: Start WebAuthn registration with browser
      const registrationResponse = await startRegistration(optionsData.options)

      // Step 3: Verify registration with server
      const verifyResponse = await fetch(`${API_URL}/api/auth/webauthn/register/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          deviceName,
          credential: registrationResponse,
        }),
      })

      const verifyData = await verifyResponse.json()

      if (!verifyData.success) {
        throw new Error(verifyData.error || 'Failed to verify registration')
      }

      setStep('success')
    } catch (err: any) {
      console.error('Biometric registration error:', err)
      setError(err.message || 'Failed to register biometric device')
      setStep('error')
    } finally {
      setLoading(false)
    }
  }

  const handleRetry = () => {
    setError('')
    setStep('name')
  }

  const handleDone = () => {
    navigate('/settings?tab=biometric')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 via-pink-900 to-purple-800 p-4">
      <Card className="w-full max-w-2xl p-8 bg-black/40 backdrop-blur-xl border-purple-500/30">
        {/* Intro Step */}
        {step === 'intro' && (
          <div className="text-center">
            <div className="mb-6">
              <svg
                className="w-24 h-24 mx-auto text-purple-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4"
                />
              </svg>
            </div>
            <h1 className="text-4xl font-bold text-white mb-4">Set Up Biometric Login</h1>
            <p className="text-gray-300 mb-6 max-w-lg mx-auto">
              Enable quick and secure login using your device's biometric authentication (Windows Hello, Touch ID, Face ID, or fingerprint scanner).
            </p>

            <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-6 mb-8 text-left max-w-md mx-auto">
              <h3 className="text-lg font-semibold text-white mb-3">What you'll need:</h3>
              <ul className="space-y-2 text-gray-300">
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-green-400 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  A device with biometric hardware (fingerprint scanner, camera for face recognition, etc.)
                </li>
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-green-400 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Biometric authentication enabled on your device
                </li>
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-green-400 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  About 1 minute to complete setup
                </li>
              </ul>
            </div>

            <button
              onClick={handleStartSetup}
              className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white text-lg font-semibold rounded-lg transition"
            >
              Get Started
            </button>

            <div className="mt-6">
              <a
                href="/settings?tab=biometric"
                className="text-gray-400 hover:text-gray-300 transition text-sm"
              >
                Skip for now
              </a>
            </div>
          </div>
        )}

        {/* Name Entry Step */}
        {step === 'name' && (
          <div>
            <div className="mb-6">
              <div className="w-16 h-16 mx-auto mb-4 bg-purple-600 rounded-full flex items-center justify-center">
                <span className="text-white text-2xl font-bold">1</span>
              </div>
              <h2 className="text-3xl font-bold text-white text-center mb-2">Name Your Device</h2>
              <p className="text-gray-400 text-center">
                Give this device a name so you can identify it later
              </p>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleNameSubmit} className="max-w-md mx-auto">
              <div className="mb-6">
                <label htmlFor="deviceName" className="block text-sm font-medium text-gray-300 mb-2">
                  Device Name
                </label>
                <input
                  id="deviceName"
                  type="text"
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                  className="w-full px-4 py-3 bg-black/50 border border-purple-500/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition"
                  placeholder="e.g., My Laptop, Work PC, iPhone"
                  required
                />
                <p className="mt-2 text-xs text-gray-500">
                  Choose a name that helps you remember which device this is
                </p>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold rounded-lg transition"
              >
                Continue
              </button>
            </form>
          </div>
        )}

        {/* Registration Step */}
        {step === 'register' && (
          <div className="text-center">
            <div className="mb-6">
              <div className="w-16 h-16 mx-auto mb-4 bg-purple-600 rounded-full flex items-center justify-center">
                <span className="text-white text-2xl font-bold">2</span>
              </div>
              <h2 className="text-3xl font-bold text-white mb-2">Register Biometric</h2>
              <p className="text-gray-400 mb-6">
                Follow your device's prompts to complete biometric registration
              </p>
            </div>

            {loading && (
              <div className="mb-6">
                <div className="w-20 h-20 mx-auto border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-gray-300 mt-4">
                  Waiting for biometric authentication...
                </p>
              </div>
            )}

            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-6 max-w-md mx-auto">
              <p className="text-blue-300 text-sm">
                <strong>Security Note:</strong> Your biometric data stays on your device and is never sent to our servers. We only store a secure credential that proves you've authenticated.
              </p>
            </div>
          </div>
        )}

        {/* Success Step */}
        {step === 'success' && (
          <div className="text-center">
            <div className="mb-6">
              <svg
                className="w-24 h-24 mx-auto text-green-400"
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
            <h2 className="text-3xl font-bold text-white mb-4">All Set!</h2>
            <p className="text-gray-300 mb-6">
              Biometric authentication has been enabled for <strong>{deviceName}</strong>
            </p>

            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-6 mb-8 max-w-md mx-auto text-left">
              <h3 className="text-lg font-semibold text-white mb-3">What's next?</h3>
              <ul className="space-y-2 text-gray-300 text-sm">
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-green-400 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  On the login page, click "Login with Biometric"
                </li>
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-green-400 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Enter your email and authenticate with your biometric
                </li>
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-green-400 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  You can add more devices in Settings
                </li>
              </ul>
            </div>

            <button
              onClick={handleDone}
              className="px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold rounded-lg transition"
            >
              Done
            </button>
          </div>
        )}

        {/* Error Step */}
        {step === 'error' && (
          <div className="text-center">
            <div className="mb-6">
              <svg
                className="w-24 h-24 mx-auto text-red-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h2 className="text-3xl font-bold text-white mb-4">Setup Failed</h2>
            <p className="text-gray-300 mb-6">{error}</p>

            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-6 mb-8 max-w-md mx-auto text-left">
              <h3 className="text-lg font-semibold text-white mb-3">Common Issues:</h3>
              <ul className="space-y-2 text-gray-300 text-sm">
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  Make sure biometric authentication is enabled on your device
                </li>
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  Check that your browser supports WebAuthn
                </li>
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  Ensure you granted permission when prompted
                </li>
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  Try using a different browser (Chrome, Edge, or Safari recommended)
                </li>
              </ul>
            </div>

            <div className="space-x-3">
              <button
                onClick={handleRetry}
                className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition"
              >
                Try Again
              </button>
              <button
                onClick={() => navigate('/settings?tab=biometric')}
                className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition"
              >
                Skip for Now
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
