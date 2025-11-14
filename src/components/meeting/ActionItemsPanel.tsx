/**
 * Horalix Halo - AI Action Items Extractor
 *
 * Premium feature: Automatically extract action items from meetings
 */

import React, { useState } from 'react'
import { Card } from '../ui/card'

interface ActionItem {
  id: string
  task: string
  assignee: string | null
  dueDate: string | null
  priority: 'high' | 'medium' | 'low'
  completed: boolean
}

interface ActionItemsPanelProps {
  meetingId: string
  transcript?: string
}

export function ActionItemsPanel({ meetingId, transcript }: ActionItemsPanelProps) {
  const [actionItems, setActionItems] = useState<ActionItem[]>([])
  const [loading, setLoading] = useState(false)
  const [extracting, setExtracting] = useState(false)

  const extractActionItems = async () => {
    setExtracting(true)
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/meetings/${meetingId}/extract-action-items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ transcript }),
      })

      const data = await response.json()
      if (data.success) {
        setActionItems(data.actionItems)
      }
    } catch (error) {
      console.error('Failed to extract action items:', error)
    } finally {
      setExtracting(false)
    }
  }

  const toggleComplete = async (id: string) => {
    setActionItems((items) =>
      items.map((item) => (item.id === id ? { ...item, completed: !item.completed } : item))
    )
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'text-red-400 bg-red-500/20'
      case 'medium':
        return 'text-yellow-400 bg-yellow-500/20'
      case 'low':
        return 'text-green-400 bg-green-500/20'
      default:
        return 'text-gray-400 bg-gray-500/20'
    }
  }

  return (
    <Card className="p-6 bg-black/40 backdrop-blur-xl border-purple-500/30">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white">Action Items</h2>
          <p className="text-gray-400 text-sm">AI-extracted tasks from this meeting</p>
        </div>
        <button
          onClick={extractActionItems}
          disabled={extracting || !transcript}
          className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {extracting ? 'Extracting...' : 'Extract Action Items'}
        </button>
      </div>

      {actionItems.length === 0 ? (
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
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
          <p className="text-gray-400">
            {transcript
              ? 'Click "Extract Action Items" to automatically identify tasks from your meeting'
              : 'No transcript available. Start recording to extract action items.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {actionItems.map((item) => (
            <div
              key={item.id}
              className={`p-4 rounded-lg border transition ${
                item.completed
                  ? 'bg-green-500/10 border-green-500/30'
                  : 'bg-black/30 border-purple-500/20'
              }`}
            >
              <div className="flex items-start gap-3">
                <button
                  onClick={() => toggleComplete(item.id)}
                  className={`mt-1 flex-shrink-0 w-5 h-5 rounded border-2 transition ${
                    item.completed
                      ? 'bg-green-500 border-green-500'
                      : 'border-gray-500 hover:border-purple-500'
                  }`}
                >
                  {item.completed && (
                    <svg className="w-full h-full text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>

                <div className="flex-1">
                  <p className={`text-white font-medium ${item.completed ? 'line-through opacity-60' : ''}`}>
                    {item.task}
                  </p>

                  <div className="flex items-center gap-3 mt-2 text-sm">
                    {item.assignee && (
                      <span className="text-gray-400">
                        <span className="text-purple-400">@</span>
                        {item.assignee}
                      </span>
                    )}

                    {item.dueDate && (
                      <span className="text-gray-400">
                        <svg
                          className="inline w-4 h-4 mr-1"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                        {new Date(item.dueDate).toLocaleDateString()}
                      </span>
                    )}

                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${getPriorityColor(item.priority)}`}>
                      {item.priority.toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
        <p className="text-blue-300 text-sm">
          <strong>💡 Pro Tip:</strong> Action items are automatically extracted using AI. Review and adjust as needed!
        </p>
      </div>
    </Card>
  )
}
