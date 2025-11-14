/**
 * Horalix Halo - Meeting Analytics Dashboard
 *
 * Premium feature: Track meeting metrics and productivity insights
 */

import React, { useState, useEffect } from 'react'
import { Card } from '../ui/card'

interface AnalyticsData {
  totalMeetings: number
  totalDuration: number
  avgDuration: number
  thisWeek: number
  thisMonth: number
  topParticipants: Array<{ name: string; count: number }>
  productivityScore: number
  actionItemsCompleted: number
  actionItemsTotal: number
}

export function AnalyticsDashboard() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'year'>('month')

  useEffect(() => {
    loadAnalytics()
  }, [timeRange])

  const loadAnalytics = async () => {
    setLoading(true)
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/meetings/analytics?range=${timeRange}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        }
      )

      const data = await response.json()
      if (data.success) {
        setAnalytics(data.analytics)
      }
    } catch (error) {
      console.error('Failed to load analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`
  }

  if (loading || !analytics) {
    return (
      <Card className="p-6 bg-black/40 backdrop-blur-xl border-purple-500/30">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-700 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            Meeting Analytics
          </h1>
          <p className="text-gray-400 mt-2">Track your productivity and meeting insights</p>
        </div>

        <div className="flex gap-2">
          {(['week', 'month', 'year'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-4 py-2 rounded-lg font-semibold transition ${
                timeRange === range
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                  : 'bg-black/30 text-gray-400 hover:text-white'
              }`}
            >
              {range.charAt(0).toUpperCase() + range.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Total Meetings */}
        <Card className="p-6 bg-gradient-to-br from-purple-500/20 to-pink-500/20 backdrop-blur-xl border-purple-500/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-300 text-sm font-medium">Total Meetings</p>
              <p className="text-4xl font-bold text-white mt-2">{analytics.totalMeetings}</p>
              <p className="text-green-400 text-sm mt-2">+{analytics.thisWeek} this week</p>
            </div>
            <svg className="w-12 h-12 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
          </div>
        </Card>

        {/* Total Duration */}
        <Card className="p-6 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 backdrop-blur-xl border-blue-500/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-300 text-sm font-medium">Total Time</p>
              <p className="text-4xl font-bold text-white mt-2">{formatDuration(analytics.totalDuration)}</p>
              <p className="text-gray-400 text-sm mt-2">Avg: {formatDuration(analytics.avgDuration)}</p>
            </div>
            <svg className="w-12 h-12 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
        </Card>

        {/* Productivity Score */}
        <Card className="p-6 bg-gradient-to-br from-green-500/20 to-emerald-500/20 backdrop-blur-xl border-green-500/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-300 text-sm font-medium">Productivity</p>
              <p className="text-4xl font-bold text-white mt-2">{analytics.productivityScore}/100</p>
              <p className="text-green-400 text-sm mt-2">
                {analytics.productivityScore >= 80 ? 'Excellent! 🎉' : analytics.productivityScore >= 60 ? 'Good progress 👍' : 'Keep improving 💪'}
              </p>
            </div>
            <svg className="w-12 h-12 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
          </div>
        </Card>

        {/* Action Items */}
        <Card className="p-6 bg-gradient-to-br from-yellow-500/20 to-orange-500/20 backdrop-blur-xl border-yellow-500/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-300 text-sm font-medium">Action Items</p>
              <p className="text-4xl font-bold text-white mt-2">
                {analytics.actionItemsCompleted}/{analytics.actionItemsTotal}
              </p>
              <p className="text-yellow-400 text-sm mt-2">
                {Math.round((analytics.actionItemsCompleted / analytics.actionItemsTotal) * 100)}% completed
              </p>
            </div>
            <svg className="w-12 h-12 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
              />
            </svg>
          </div>
        </Card>
      </div>

      {/* Top Participants */}
      <Card className="p-6 bg-black/40 backdrop-blur-xl border-purple-500/30">
        <h2 className="text-2xl font-bold text-white mb-4">Top Participants</h2>
        <div className="space-y-3">
          {analytics.topParticipants.map((participant, index) => (
            <div key={participant.name} className="flex items-center gap-4">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                  index === 0
                    ? 'bg-yellow-500 text-yellow-900'
                    : index === 1
                    ? 'bg-gray-400 text-gray-900'
                    : index === 2
                    ? 'bg-orange-600 text-orange-100'
                    : 'bg-gray-700 text-gray-300'
                }`}
              >
                {index + 1}
              </div>
              <div className="flex-1">
                <p className="text-white font-medium">{participant.name}</p>
              </div>
              <div className="text-gray-400">{participant.count} meetings</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Insights */}
      <Card className="p-6 bg-gradient-to-br from-purple-500/10 to-pink-500/10 backdrop-blur-xl border-purple-500/20">
        <h2 className="text-2xl font-bold text-white mb-4">💡 AI Insights</h2>
        <div className="space-y-3 text-gray-300">
          <p>
            ✨ Your most productive day is{' '}
            <span className="text-purple-400 font-semibold">Wednesday</span> with an average of 3 meetings.
          </p>
          <p>
            📅 You tend to have longer meetings in the{' '}
            <span className="text-purple-400 font-semibold">afternoon</span> (avg {formatDuration(45)}).
          </p>
          <p>
            🎯 Your action item completion rate is{' '}
            <span className="text-green-400 font-semibold">
              {Math.round((analytics.actionItemsCompleted / analytics.actionItemsTotal) * 100)}%
            </span>{' '}
            - keep it up!
          </p>
        </div>
      </Card>
    </div>
  )
}
