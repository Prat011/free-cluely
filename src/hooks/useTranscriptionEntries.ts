import { useState, useRef, useEffect } from 'react'
import { TranscriptionEntry } from '../components/ui/TranscriptionDisplay'

/**
 * Accumulates mic and speaker transcript strings into a unified
 * TranscriptionEntry timeline. Call `reset()` when starting a new session.
 */
export function useTranscriptionEntries(
  micTranscript: string,
  speakerTranscript: string
) {
  const [entries, setEntries] = useState<TranscriptionEntry[]>([])
  const prevMicTranscript = useRef('')
  const prevSpeakerTranscript = useRef('')

  useEffect(() => {
    if (micTranscript && micTranscript !== prevMicTranscript.current) {
      const newText = micTranscript.slice(prevMicTranscript.current.length).trim()
      if (newText) {
        setEntries(prev => [...prev, { speaker: 'you', text: newText, timestamp: Date.now() }])
      }
      prevMicTranscript.current = micTranscript
    }
  }, [micTranscript])

  useEffect(() => {
    if (speakerTranscript && speakerTranscript !== prevSpeakerTranscript.current) {
      const newText = speakerTranscript.slice(prevSpeakerTranscript.current.length).trim()
      if (newText) {
        setEntries(prev => [...prev, { speaker: 'speaker', text: newText, timestamp: Date.now() }])
      }
      prevSpeakerTranscript.current = speakerTranscript
    }
  }, [speakerTranscript])

  function reset(): void {
    setEntries([])
    prevMicTranscript.current = ''
    prevSpeakerTranscript.current = ''
  }

  return { entries, reset }
}
