/**
 * Horalix Halo - Main Dashboard
 *
 * Stunning animated dashboard with real-time stats
 */

import React, { useEffect, useState } from 'react'
import { motion, useAnimation } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../contexts/AuthContext'
import { Navigation } from '../layout/Navigation'
import { Card } from '../ui/card'

interface DashboardStats {
  todayMeetings: number
  weekMeetings: number
  totalDuration: number
  pendingActions: number
  completionRate: number
  productivityScore: number
}

export function MainDashboard() {
  const { user, token } = useAuth()
  const [greeting, setGreeting] = useState('')
  const controls = useAnimation()

  useEffect(() => {
    const hour = new Date().getHours()
    if (hour < 12) setGreeting('Good Morning')
    else if (hour < 18) setGreeting('Good Afternoon')
    else setGreeting('Good Evening')

    controls.start({
      scale: [1, 1.02, 1],
      transition: { duration: 2, repeat: Infinity, ease: 'easeInOut' },
    })
  }, [controls])

  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/meetings/dashboard-stats`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!response.ok) throw new Error('Failed to fetch stats')
      const data = await response.json()
      return data.stats
    },
    enabled: !!token,
    refetchInterval: 30000, // Refresh every 30 seconds
  })

  const StatCard = ({ icon, label, value, color, gradient, delay }: any) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      whileHover={{ scale: 1.05, y: -5 }}
      className="group"
    >
      <Card className={`p-6 bg-gradient-to-br ${gradient} backdrop-blur-xl border-white/10 shadow-xl hover:shadow-2xl transition-all duration-300 overflow-hidden relative`}>
        {/* Animated background gradient */}
        <motion.div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
          style={{
            background: `radial-gradient(circle at 50% 50%, ${color}20, transparent)`,
          }}
          animate={{
            scale: [1, 1.2, 1],
          }}
          transition={{ duration: 2, repeat: Infinity }}
        />

        <div className="relative z-10">
          <div className="flex items-center justify-between mb-4">
            <motion.div
              className={`text-4xl`}
              animate={{
                rotate: [0, 10, -10, 0],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            >
              {icon}
            </motion.div>
            <div className="text-right">
              <p className="text-gray-300 text-sm font-medium">{label}</p>
              <motion.p
                className="text-4xl font-bold text-white mt-1"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: delay + 0.2, type: 'spring' }}
              >
                {isLoading ? '...' : value}
              </motion.p>
            </div>
          </div>

          {/* Animated progress bar */}
          <div className="h-1 bg-white/10 rounded-full overflow-hidden">
            <motion.div
              className={`h-full bg-white/50`}
              initial={{ width: 0 }}
              animate={{ width: isLoading ? 0 : '70%' }}
              transition={{ delay: delay + 0.3, duration: 1 }}
            />
          </div>
        </div>
      </Card>
    </motion.div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      <Navigation />

      <div className="pt-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        {/* Welcome Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12"
        >
          <h1 className="text-5xl sm:text-6xl font-bold mb-4">
            <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 bg-clip-text text-transparent">
              {greeting}, {user?.email.split('@')[0] || 'there'}!
            </span>
          </h1>
          <p className="text-gray-300 text-xl">Here's your productivity overview</p>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          <StatCard
            icon="📅"
            label="Today's Meetings"
            value={stats?.todayMeetings || 0}
            color="#8B5CF6"
            gradient="from-purple-500/20 to-purple-900/20"
            delay={0}
          />
          <StatCard
            icon="📊"
            label="This Week"
            value={stats?.weekMeetings || 0}
            color="#EC4899"
            gradient="from-pink-500/20 to-pink-900/20"
            delay={0.1}
          />
          <StatCard
            icon="⏱️"
            label="Total Hours"
            value={stats ? Math.round(stats.totalDuration / 60) : 0}
            color="#06B6D4"
            gradient="from-cyan-500/20 to-cyan-900/20"
            delay={0.2}
          />
          <StatCard
            icon="✅"
            label="Pending Actions"
            value={stats?.pendingActions || 0}
            color="#F59E0B"
            gradient="from-amber-500/20 to-amber-900/20"
            delay={0.3}
          />
          <StatCard
            icon="🎯"
            label="Completion Rate"
            value={stats ? `${stats.completionRate}%` : '0%'}
            color="#10B981"
            gradient="from-emerald-500/20 to-emerald-900/20"
            delay={0.4}
          />
          <StatCard
            icon="🚀"
            label="Productivity Score"
            value={stats ? `${stats.productivityScore}/100` : '0/100'}
            color="#8B5CF6"
            gradient="from-violet-500/20 to-violet-900/20"
            delay={0.5}
          />
        </div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <h2 className="text-3xl font-bold text-white mb-6">Quick Actions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: '➕', label: 'New Meeting', color: 'purple', href: '/meetings' },
              { icon: '📅', label: 'View Calendar', color: 'blue', href: '/calendar' },
              { icon: '📊', label: 'Analytics', color: 'pink', href: '/meetings?tab=analytics' },
              { icon: '⚙️', label: 'Settings', color: 'gray', href: '/settings' },
            ].map((action, index) => (
              <motion.a
                key={action.label}
                href={action.href}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.7 + index * 0.1 }}
                whileHover={{ scale: 1.05, y: -5 }}
                whileTap={{ scale: 0.95 }}
                className={`p-6 rounded-xl bg-gradient-to-br from-${action.color}-500/20 to-${action.color}-900/20 backdrop-blur-xl border border-white/10 hover:border-white/20 transition-all duration-300 group`}
              >
                <motion.div
                  className="text-5xl mb-3"
                  animate={{
                    rotate: [0, 5, -5, 0],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                >
                  {action.icon}
                </motion.div>
                <p className="text-white font-semibold text-lg group-hover:text-purple-300 transition-colors">
                  {action.label}
                </p>
              </motion.a>
            ))}
          </div>
        </motion.div>

        {/* Floating particles animation */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          {[...Array(20)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 bg-purple-500/20 rounded-full"
              initial={{
                x: Math.random() * window.innerWidth,
                y: Math.random() * window.innerHeight,
              }}
              animate={{
                x: Math.random() * window.innerWidth,
                y: Math.random() * window.innerHeight,
              }}
              transition={{
                duration: Math.random() * 20 + 10,
                repeat: Infinity,
                ease: 'linear',
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
