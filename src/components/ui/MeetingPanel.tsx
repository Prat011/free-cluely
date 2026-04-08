import React, { useState, useEffect } from 'react'
import { useMeeting } from '../../hooks/useMeeting'
import PlaybookSelector from './PlaybookSelector'
import QuickResponses from './QuickResponses'

function formatDuration(startedAt: number): string {
  const elapsed = Math.floor((Date.now() - startedAt) / 1000)
  const h = Math.floor(elapsed / 3600)
  const m = Math.floor((elapsed % 3600) / 60)
  const s = elapsed % 60
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

const MeetingPanel: React.FC = () => {
  const {
    meeting,
    isActive,
    isLoading,
    error,
    startMeeting,
    endMeeting,
    regenerateSummary,
    extractActions,
  } = useMeeting()

  const [elapsed, setElapsed] = useState('00:00:00')
  const [title, setTitle] = useState('')
  const [activePlaybookId, setActivePlaybookId] = useState('general')
  const [coachingAdvice, setCoachingAdvice] = useState<string | null>(null)
  const [quickResponses, setQuickResponses] = useState<string[]>([])
  const [isQuickLoading, setIsQuickLoading] = useState(false)

  // Update elapsed time every second during active meeting
  useEffect(() => {
    if (!isActive || !meeting) return
    const timer = setInterval(() => {
      setElapsed(formatDuration(meeting.startedAt))
    }, 1000)
    return () => clearInterval(timer)
  }, [isActive, meeting?.startedAt])

  const handleStart = async () => {
    await startMeeting(title || undefined)
    setTitle('')
  }

  const handleCopyResponse = (text: string) => {
    navigator.clipboard.writeText(text).catch(console.error)
  }

  if (!meeting) {
    // No active meeting — show start form with playbook selection
    return (
      <div className="p-3 bg-black/40 backdrop-blur-md rounded-lg border border-white/15 space-y-3">
        <h3 className="text-sm font-semibold text-gray-200">Meeting</h3>
        <input
          type="text"
          placeholder="Meeting title (optional)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full px-3 py-2 text-xs bg-black/30 border border-white/15 rounded text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-400/60"
          onKeyDown={(e) => e.key === 'Enter' && handleStart()}
        />
        <PlaybookSelector
          activePlaybookId={activePlaybookId}
          onSelect={setActivePlaybookId}
        />
        <button
          onClick={handleStart}
          disabled={isLoading}
          className="w-full px-3 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white text-xs rounded transition-all shadow-md"
        >
          {isLoading ? 'Starting...' : 'Start Meeting'}
        </button>
        {error && (
          <div className="text-xs text-red-400 bg-red-900/30 p-2 rounded">{error}</div>
        )}
      </div>
    )
  }

  // Active or ended meeting
  return (
    <div className="p-3 bg-black/40 backdrop-blur-md rounded-lg border border-white/15 space-y-3">
      {/* Header with status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isActive && (
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          )}
          <h3 className="text-sm font-semibold text-gray-200 truncate max-w-[200px]">
            {meeting.title}
          </h3>
        </div>
        <span className="text-xs text-gray-400 font-mono">
          {isActive ? elapsed : formatDuration(meeting.startedAt)}
        </span>
      </div>

      {/* Entry count */}
      <div className="text-[10px] text-gray-500">
        {meeting.entryCount} transcription entries
      </div>

      {/* Coaching Advice (inline) */}
      {coachingAdvice && (
        <div className="text-xs text-amber-300 bg-amber-900/20 p-2 rounded border border-amber-500/20">
          <span className="font-medium">Coach:</span> {coachingAdvice}
        </div>
      )}

      {/* Quick Responses */}
      <QuickResponses
        responses={quickResponses}
        isLoading={isQuickLoading}
        onCopy={handleCopyResponse}
      />

      {/* Summary */}
      {meeting.summary && (
        <div className="space-y-1">
          <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Summary</div>
          <div className="text-xs text-gray-300 bg-black/30 p-2 rounded max-h-24 overflow-y-auto">
            {meeting.summary}
          </div>
        </div>
      )}

      {/* Action Items */}
      {meeting.actionItems.length > 0 && (
        <div className="space-y-1">
          <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Action Items</div>
          <div className="space-y-1 max-h-24 overflow-y-auto">
            {meeting.actionItems.map((item) => (
              <div key={item.id} className="flex items-start gap-1.5 text-xs text-gray-300">
                <span className="mt-0.5">{item.completed ? '\u2611' : '\u2610'}</span>
                <div>
                  <span>{item.text}</span>
                  {item.owner && (
                    <span className="text-blue-400 ml-1">@{item.owner}</span>
                  )}
                  {item.deadline && (
                    <span className="text-yellow-400 ml-1">({item.deadline})</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Playbook selector (compact, during active meeting) */}
      {isActive && (
        <PlaybookSelector
          activePlaybookId={activePlaybookId}
          onSelect={setActivePlaybookId}
        />
      )}

      {/* Error */}
      {error && (
        <div className="text-xs text-red-400 bg-red-900/30 p-2 rounded">{error}</div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        {isActive ? (
          <button
            onClick={endMeeting}
            disabled={isLoading}
            className="flex-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white text-xs rounded transition-all"
          >
            {isLoading ? 'Ending...' : 'Stop Meeting'}
          </button>
        ) : (
          <>
            <button
              onClick={regenerateSummary}
              disabled={isLoading}
              className="flex-1 px-2 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white text-xs rounded transition-all"
            >
              Regenerate
            </button>
            <button
              onClick={extractActions}
              disabled={isLoading}
              className="flex-1 px-2 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white text-xs rounded transition-all"
            >
              Actions
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default MeetingPanel
