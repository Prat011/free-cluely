import { useState, useEffect, useCallback, useRef } from 'react'

export interface MeetingState {
  id: string
  title: string
  startedAt: number
  endedAt: number | null
  summary: string | null
  actionItems: Array<{
    id: string
    text: string
    owner: string | null
    deadline: string | null
    completed: boolean
  }>
  entryCount: number
}

export function useMeeting() {
  const [meeting, setMeeting] = useState<MeetingState | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const cleanupRef = useRef<(() => void) | null>(null)
  const cleanupErrorRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    // Subscribe to meeting context updates
    cleanupRef.current = window.electronAPI.onMeetingContextUpdate((data) => {
      setMeeting({
        id: data.id,
        title: data.title,
        startedAt: data.startedAt,
        endedAt: data.endedAt,
        summary: data.summary,
        actionItems: data.actionItems || [],
        entryCount: data.entries?.length || 0,
      })
    })

    cleanupErrorRef.current = window.electronAPI.onMeetingError((err) => {
      setError(err)
    })

    // Check if there's an active meeting
    window.electronAPI.getCurrentMeeting().then((data) => {
      if (data) {
        setMeeting({
          id: data.id,
          title: data.title,
          startedAt: data.startedAt,
          endedAt: data.endedAt,
          summary: data.summary,
          actionItems: data.actionItems || [],
          entryCount: data.entries?.length || 0,
        })
      }
    })

    return () => {
      cleanupRef.current?.()
      cleanupErrorRef.current?.()
    }
  }, [])

  const startMeeting = useCallback(async (title?: string) => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await window.electronAPI.startMeeting(title)
      if (result.success && result.meeting) {
        setMeeting({
          id: result.meeting.id,
          title: result.meeting.title,
          startedAt: result.meeting.startedAt,
          endedAt: null,
          summary: null,
          actionItems: [],
          entryCount: 0,
        })
      } else {
        setError(result.error || 'Failed to start meeting')
      }
    } catch (err) {
      setError(String(err))
    } finally {
      setIsLoading(false)
    }
  }, [])

  const endMeeting = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await window.electronAPI.endMeeting()
      if (result.success && result.meeting) {
        setMeeting({
          id: result.meeting.id,
          title: result.meeting.title,
          startedAt: result.meeting.startedAt,
          endedAt: result.meeting.endedAt,
          summary: result.meeting.summary,
          actionItems: result.meeting.actionItems || [],
          entryCount: result.meeting.entries?.length || 0,
        })
      } else {
        setError(result.error || 'Failed to end meeting')
      }
    } catch (err) {
      setError(String(err))
    } finally {
      setIsLoading(false)
    }
  }, [])

  const regenerateSummary = useCallback(async () => {
    if (!meeting) return
    setIsLoading(true)
    try {
      const result = await window.electronAPI.generateMeetingSummary(meeting.id)
      if (result.success && result.summary) {
        setMeeting(prev => prev ? { ...prev, summary: result.summary! } : null)
      }
    } catch (err) {
      setError(String(err))
    } finally {
      setIsLoading(false)
    }
  }, [meeting])

  const extractActions = useCallback(async () => {
    if (!meeting) return
    setIsLoading(true)
    try {
      const result = await window.electronAPI.extractActionItems(meeting.id)
      if (result.success && result.items) {
        setMeeting(prev => prev ? { ...prev, actionItems: result.items! } : null)
      }
    } catch (err) {
      setError(String(err))
    } finally {
      setIsLoading(false)
    }
  }, [meeting])

  const isActive = meeting !== null && meeting.endedAt === null

  return {
    meeting,
    isActive,
    isLoading,
    error,
    startMeeting,
    endMeeting,
    regenerateSummary,
    extractActions,
  }
}
