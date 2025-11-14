/**
 * Horalix Halo - Smart Meeting Summary
 *
 * Premium feature: AI-generated professional meeting summaries
 */

import React, { useState } from 'react'
import { Card } from '../ui/card'

interface MeetingSummary {
  overview: string
  keyPoints: string[]
  decisions: string[]
  nextSteps: string[]
  attendees: string[]
  duration: number
  sentiment: 'positive' | 'neutral' | 'negative'
}

interface SmartSummaryProps {
  meetingId: string
  transcript?: string
}

export function SmartSummary({ meetingId, transcript }: SmartSummaryProps) {
  const [summary, setSummary] = useState<MeetingSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)

  const generateSummary = async () => {
    setLoading(true)
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/meetings/${meetingId}/generate-summary`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
          body: JSON.stringify({ transcript }),
        }
      )

      const data = await response.json()
      if (data.success) {
        setSummary(data.summary)
      }
    } catch (error) {
      console.error('Failed to generate summary:', error)
    } finally {
      setLoading(false)
    }
  }

  const exportSummary = async (format: 'pdf' | 'docx' | 'email') => {
    setExporting(true)
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/meetings/${meetingId}/export-summary`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
          body: JSON.stringify({ format, summary }),
        }
      )

      if (format === 'email') {
        const data = await response.json()
        if (data.success) {
          alert('Summary sent to all attendees!')
        }
      } else {
        // Download file
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `meeting-summary-${meetingId}.${format}`
        a.click()
      }
    } catch (error) {
      console.error('Failed to export summary:', error)
    } finally {
      setExporting(false)
    }
  }

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'positive':
        return 'text-green-400 bg-green-500/20'
      case 'negative':
        return 'text-red-400 bg-red-500/20'
      default:
        return 'text-gray-400 bg-gray-500/20'
    }
  }

  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment) {
      case 'positive':
        return '😊'
      case 'negative':
        return '😔'
      default:
        return '😐'
    }
  }

  return (
    <Card className="p-6 bg-black/40 backdrop-blur-xl border-purple-500/30">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white">Smart Summary</h2>
          <p className="text-gray-400 text-sm">AI-generated professional meeting summary</p>
        </div>

        <div className="flex gap-2">
          {!summary ? (
            <button
              onClick={generateSummary}
              disabled={loading || !transcript}
              className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <svg className="inline w-4 h-4 mr-2 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" strokeWidth="4"></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Generating...
                </>
              ) : (
                'Generate Summary'
              )}
            </button>
          ) : (
            <>
              <button
                onClick={() => exportSummary('pdf')}
                disabled={exporting}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition disabled:opacity-50"
              >
                📄 Export PDF
              </button>
              <button
                onClick={() => exportSummary('docx')}
                disabled={exporting}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition disabled:opacity-50"
              >
                📝 Export DOCX
              </button>
              <button
                onClick={() => exportSummary('email')}
                disabled={exporting}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition disabled:opacity-50"
              >
                ✉️ Email All
              </button>
            </>
          )}
        </div>
      </div>

      {!summary ? (
        <div className="text-center py-12">
          <svg
            className="w-16 h-16 mx-auto text-gray-600 mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <p className="text-gray-400">
            {transcript
              ? 'Click "Generate Summary" to create a professional AI summary of your meeting'
              : 'No transcript available. Start recording to generate a summary.'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Header Info */}
          <div className="flex items-center gap-4 pb-4 border-b border-gray-700">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-gray-400 text-sm">Sentiment:</span>
                <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getSentimentColor(summary.sentiment)}`}>
                  {getSentimentIcon(summary.sentiment)} {summary.sentiment.toUpperCase()}
                </span>
              </div>
            </div>
            <div className="text-gray-400 text-sm">
              Duration: <span className="text-white font-semibold">{summary.duration} minutes</span>
            </div>
            <div className="text-gray-400 text-sm">
              Attendees: <span className="text-white font-semibold">{summary.attendees.length}</span>
            </div>
          </div>

          {/* Overview */}
          <div>
            <h3 className="text-xl font-bold text-white mb-3">📋 Overview</h3>
            <p className="text-gray-300 leading-relaxed">{summary.overview}</p>
          </div>

          {/* Key Points */}
          <div>
            <h3 className="text-xl font-bold text-white mb-3">🔑 Key Points</h3>
            <ul className="space-y-2">
              {summary.keyPoints.map((point, index) => (
                <li key={index} className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-600 text-white text-sm flex items-center justify-center font-semibold mt-0.5">
                    {index + 1}
                  </span>
                  <span className="text-gray-300">{point}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Decisions */}
          {summary.decisions.length > 0 && (
            <div>
              <h3 className="text-xl font-bold text-white mb-3">✅ Decisions Made</h3>
              <div className="space-y-2">
                {summary.decisions.map((decision, index) => (
                  <div key={index} className="flex items-start gap-3 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                    <svg className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-gray-300">{decision}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Next Steps */}
          {summary.nextSteps.length > 0 && (
            <div>
              <h3 className="text-xl font-bold text-white mb-3">⏭️ Next Steps</h3>
              <div className="space-y-2">
                {summary.nextSteps.map((step, index) => (
                  <div key={index} className="flex items-start gap-3 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                    <span className="flex-shrink-0 w-6 h-6 rounded bg-blue-600 text-white text-sm flex items-center justify-center font-semibold">
                      {index + 1}
                    </span>
                    <span className="text-gray-300">{step}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Attendees */}
          <div>
            <h3 className="text-xl font-bold text-white mb-3">👥 Attendees ({summary.attendees.length})</h3>
            <div className="flex flex-wrap gap-2">
              {summary.attendees.map((attendee, index) => (
                <span
                  key={index}
                  className="px-3 py-1 bg-purple-500/20 border border-purple-500/30 rounded-full text-purple-300 text-sm"
                >
                  {attendee}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg">
        <p className="text-purple-300 text-sm">
          <strong>✨ Ultra Feature:</strong> Smart summaries use advanced AI to extract insights, decisions, and action items automatically!
        </p>
      </div>
    </Card>
  )
}
