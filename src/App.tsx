/**
 * Horalix Halo - Main Electron App
 *
 * Modern meeting assistant with authentication, calendar, and AI features
 */

import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from 'react-query'
import { AuthProvider } from './contexts/AuthContext'
import { SubscriptionProvider } from './contexts/SubscriptionContext'
import { ToastProvider } from './components/ui/toast'
import { ToastViewport } from '@radix-ui/react-toast'

// Auth Pages
import { LoginPage } from './components/auth/LoginPage'
import { SignupPage } from './components/auth/SignupPage'
import { SettingsPage } from './components/auth/SettingsPage'
import { EmailConfirmedPage } from './components/auth/EmailConfirmedPage'
import { ResendConfirmationPage } from './components/auth/ResendConfirmationPage'
import { ForgotPasswordPage } from './components/auth/ForgotPasswordPage'
import { ResetPasswordPage } from './components/auth/ResetPasswordPage'
import { BiometricSetupPage } from './components/auth/BiometricSetupPage'

// Main Pages
import { MeetingPage } from './components/meeting/MeetingPage'
import { CalendarPage } from './components/calendar/CalendarPage'
import { PricingPage } from './components/subscription/PricingPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
      refetchOnWindowFocus: false,
    },
  },
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <SubscriptionProvider>
            <ToastProvider>
              <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
                <Routes>
                  {/* Auth Routes */}
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/signup" element={<SignupPage />} />
                  <Route path="/email-confirmed" element={<EmailConfirmedPage />} />
                  <Route path="/resend-confirmation" element={<ResendConfirmationPage />} />
                  <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                  <Route path="/reset-password" element={<ResetPasswordPage />} />
                  <Route path="/biometric-setup" element={<BiometricSetupPage />} />

                  {/* Main App Routes */}
                  <Route path="/meetings" element={<MeetingPage />} />
                  <Route path="/calendar" element={<CalendarPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/pricing" element={<PricingPage />} />

                  {/* Default Route */}
                  <Route path="/" element={<Navigate to="/meetings" replace />} />
                  <Route path="*" element={<Navigate to="/meetings" replace />} />
                </Routes>
              </div>
              <ToastViewport />
            </ToastProvider>
          </SubscriptionProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
