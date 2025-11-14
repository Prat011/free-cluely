/**
 * Horalix Halo - Authentication Context
 *
 * Manages authentication state, login, logout, and user session
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'

// ============================================================================
// TYPES
// ============================================================================

interface User {
  id: string
  email: string
  currentPlan: 'free' | 'plus' | 'ultra'
  isEmailConfirmed?: boolean
}

interface AuthContextType {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  loginWithGoogle: () => Promise<void>
  loginWithBiometric: (email: string) => Promise<void>
  signup: (email: string, password: string) => Promise<void>
  logout: () => void
  refreshUser: () => Promise<void>
  forgotPassword: (email: string) => Promise<void>
  resetPassword: (token: string, newPassword: string) => Promise<void>
  resendConfirmation: (email: string) => Promise<void>
}

// ============================================================================
// CONTEXT
// ============================================================================

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

// ============================================================================
// PROVIDER
// ============================================================================

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Load token from localStorage on mount
  useEffect(() => {
    const storedToken = localStorage.getItem('auth_token')
    if (storedToken) {
      setToken(storedToken)
      fetchUser(storedToken)
    } else {
      setIsLoading(false)
    }
  }, [])

  // Fetch user data
  const fetchUser = async (authToken: string) => {
    try {
      const response = await fetch(`${API_URL}/api/auth/me`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setUser(data.user)
      } else {
        // Token invalid, clear it
        setToken(null)
        localStorage.removeItem('auth_token')
      }
    } catch (error) {
      console.error('[Auth] Failed to fetch user:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Login with email/password
  const login = async (email: string, password: string) => {
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Login failed')
    }

    // Check if email confirmation required
    if (data.requiresConfirmation) {
      throw new Error('Please confirm your email before logging in')
    }

    setToken(data.token)
    setUser(data.user)
    localStorage.setItem('auth_token', data.token)
  }

  // Login with Google OAuth
  const loginWithGoogle = async () => {
    // Get auth URL
    const response = await fetch(`${API_URL}/api/auth/google`)
    const data = await response.json()

    if (!data.authUrl) {
      throw new Error('Failed to get Google auth URL')
    }

    // Open auth URL in browser
    window.open(data.authUrl, '_blank')

    // TODO: Handle callback and extract token
    // This will be completed when user returns from OAuth
  }

  // Login with WebAuthn biometric
  const loginWithBiometric = async (email: string) => {
    // Get authentication options
    const optionsRes = await fetch(`${API_URL}/api/auth/webauthn/login-options`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    })

    const optionsData = await optionsRes.json()

    if (!optionsRes.ok) {
      throw new Error(optionsData.error || 'Failed to get authentication options')
    }

    // Get credential from WebAuthn API
    const { startAuthentication } = await import('@simplewebauthn/browser')
    const credential = await startAuthentication(optionsData.options)

    // Verify authentication
    const verifyRes = await fetch(`${API_URL}/api/auth/webauthn/login-verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: optionsData.userId,
        credential,
      }),
    })

    const verifyData = await verifyRes.json()

    if (!verifyRes.ok) {
      throw new Error(verifyData.error || 'Authentication failed')
    }

    setToken(verifyData.token)
    setUser(verifyData.user)
    localStorage.setItem('auth_token', verifyData.token)
  }

  // Signup with email/password
  const signup = async (email: string, password: string) => {
    const response = await fetch(`${API_URL}/api/auth/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Signup failed')
    }

    // Don't automatically log in, user needs to confirm email
    // Just return success
  }

  // Logout
  const logout = () => {
    setUser(null)
    setToken(null)
    localStorage.removeItem('auth_token')
  }

  // Refresh user data
  const refreshUser = async () => {
    if (!token) return

    await fetchUser(token)
  }

  // Forgot password
  const forgotPassword = async (email: string) => {
    const response = await fetch(`${API_URL}/api/auth/forgot-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Failed to send reset email')
    }
  }

  // Reset password
  const resetPassword = async (resetToken: string, newPassword: string) => {
    const response = await fetch(`${API_URL}/api/auth/reset-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token: resetToken, newPassword }),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Failed to reset password')
    }
  }

  // Resend confirmation email
  const resendConfirmation = async (email: string) => {
    const response = await fetch(`${API_URL}/api/auth/resend-confirmation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Failed to resend confirmation')
    }
  }

  const value: AuthContextType = {
    user,
    token,
    isAuthenticated: !!user && !!token,
    isLoading,
    login,
    loginWithGoogle,
    loginWithBiometric,
    signup,
    logout,
    refreshUser,
    forgotPassword,
    resetPassword,
    resendConfirmation,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// ============================================================================
// HOOK
// ============================================================================

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
