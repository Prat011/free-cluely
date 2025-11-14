/**
 * Horalix Halo - Navigation Component
 *
 * Beautiful, animated navigation that makes Cluely jealous
 */

import React, { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../../contexts/AuthContext'
import { useSubscription } from '../../contexts/SubscriptionContext'

const navItems = [
  { path: '/meetings', icon: '📊', label: 'Meetings', badge: null },
  { path: '/calendar', icon: '📅', label: 'Calendar', badge: null },
  { path: '/settings', icon: '⚙️', label: 'Settings', badge: null },
]

export function Navigation() {
  const location = useLocation()
  const { user, logout } = useAuth()
  const { subscription } = useSubscription()
  const [isProfileOpen, setIsProfileOpen] = useState(false)

  const getPlanColor = (plan: string) => {
    switch (plan) {
      case 'ultra':
        return 'from-purple-600 to-pink-600'
      case 'plus':
        return 'from-blue-600 to-cyan-600'
      default:
        return 'from-gray-600 to-gray-700'
    }
  }

  const getPlanBadge = (plan: string) => {
    switch (plan) {
      case 'ultra':
        return '👑 Ultra'
      case 'plus':
        return '⭐ Plus'
      default:
        return '🆓 Free'
    }
  }

  return (
    <motion.nav
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed top-0 left-0 right-0 z-50 bg-black/60 backdrop-blur-2xl border-b border-purple-500/20"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/meetings" className="flex items-center space-x-3 group">
            <motion.div
              whileHover={{ scale: 1.1, rotate: 5 }}
              whileTap={{ scale: 0.95 }}
              className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center shadow-lg shadow-purple-500/50"
            >
              <span className="text-2xl">🎯</span>
            </motion.div>
            <div className="hidden sm:block">
              <h1 className="text-xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 bg-clip-text text-transparent">
                Horalix Halo
              </h1>
              <p className="text-xs text-gray-400">AI Meeting Assistant</p>
            </div>
          </Link>

          {/* Navigation Items */}
          <div className="flex items-center space-x-2">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path
              return (
                <Link key={item.path} to={item.path}>
                  <motion.div
                    whileHover={{ scale: 1.05, y: -2 }}
                    whileTap={{ scale: 0.95 }}
                    className={`relative px-4 py-2 rounded-lg font-medium transition-all ${
                      isActive
                        ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/50'
                        : 'text-gray-300 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <span className="mr-2">{item.icon}</span>
                    <span className="hidden sm:inline">{item.label}</span>
                    {item.badge && (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center"
                      >
                        {item.badge}
                      </motion.span>
                    )}
                  </motion.div>
                </Link>
              )
            })}
          </div>

          {/* User Profile */}
          {user && (
            <div className="relative">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="flex items-center space-x-3 px-3 py-2 rounded-lg hover:bg-white/5 transition"
              >
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-medium text-white">{user.email.split('@')[0]}</p>
                  <p
                    className={`text-xs font-semibold bg-gradient-to-r ${getPlanColor(user.currentPlan)} bg-clip-text text-transparent`}
                  >
                    {getPlanBadge(user.currentPlan)}
                  </p>
                </div>
                <div
                  className={`w-10 h-10 rounded-full bg-gradient-to-br ${getPlanColor(user.currentPlan)} flex items-center justify-center text-white font-bold shadow-lg`}
                >
                  {user.email[0].toUpperCase()}
                </div>
              </motion.button>

              <AnimatePresence>
                {isProfileOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    className="absolute right-0 mt-2 w-64 bg-black/90 backdrop-blur-xl rounded-xl border border-purple-500/30 shadow-xl shadow-purple-500/20 overflow-hidden"
                  >
                    <div className={`p-4 bg-gradient-to-r ${getPlanColor(user.currentPlan)}`}>
                      <p className="text-white font-semibold">{user.email}</p>
                      <p className="text-white/80 text-sm">{getPlanBadge(user.currentPlan)}</p>
                    </div>

                    <div className="p-2">
                      <Link
                        to="/settings"
                        onClick={() => setIsProfileOpen(false)}
                        className="block px-4 py-2 rounded-lg text-gray-300 hover:text-white hover:bg-white/10 transition"
                      >
                        ⚙️ Settings
                      </Link>
                      {user.currentPlan === 'free' && (
                        <Link
                          to="/pricing"
                          onClick={() => setIsProfileOpen(false)}
                          className="block px-4 py-2 rounded-lg text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 transition font-semibold"
                        >
                          ⭐ Upgrade to Premium
                        </Link>
                      )}
                      <button
                        onClick={() => {
                          logout()
                          setIsProfileOpen(false)
                        }}
                        className="w-full text-left px-4 py-2 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 transition"
                      >
                        🚪 Logout
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      {/* Gradient border animation */}
      <motion.div
        className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-purple-600 via-pink-600 to-purple-600"
        animate={{
          backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: 'linear',
        }}
        style={{ backgroundSize: '200% 100%' }}
      />
    </motion.nav>
  )
}
