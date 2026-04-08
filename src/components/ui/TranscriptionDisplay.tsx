import React, { useRef, useEffect } from 'react'

export interface TranscriptionEntry {
  speaker: 'you' | 'speaker'
  text: string
  timestamp: number
}

interface TranscriptionDisplayProps {
  entries?: TranscriptionEntry[]
  micInterim?: string
  speakerInterim?: string
  isListening?: boolean
  isSpeakerListening?: boolean
  // Legacy single-stream mode
  transcript?: string
  interimText?: string
}

const TranscriptionDisplay: React.FC<TranscriptionDisplayProps> = ({
  entries,
  micInterim: micInterimProp,
  speakerInterim: speakerInterimProp,
  isListening = false,
  isSpeakerListening = false,
  transcript,
  interimText,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)

  const isTimeline = entries !== undefined
  const micInterim = isTimeline ? (micInterimProp || '') : (interimText || '')
  const speakerInterim = isTimeline ? (speakerInterimProp || '') : ''

  const allEntries: TranscriptionEntry[] = isTimeline
    ? entries
    : transcript
      ? [{ speaker: 'you', text: transcript, timestamp: Date.now() }]
      : []

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [allEntries, micInterim, speakerInterim])

  const hasContent = allEntries.length > 0 || micInterim || speakerInterim
  const anyListening = isListening || isSpeakerListening

  if (!anyListening && !hasContent) return null

  return (
    <div
      ref={containerRef}
      className="mt-2 p-2 bg-white/10 rounded text-white text-xs max-w-md max-h-32 overflow-y-auto"
    >
      {/* Header */}
      <div className="flex items-center gap-1.5 mb-1.5">
        {anyListening && (
          <span className="inline-block w-2 h-2 rounded-full bg-red-400 animate-pulse" />
        )}
        <span className="font-semibold text-white/70">
          {anyListening ? 'Listening...' : 'Transcription'}
        </span>
        {isListening && (
          <span className="text-[9px] px-1 py-0.5 rounded bg-red-500/30 text-red-300">Mic</span>
        )}
        {isSpeakerListening && (
          <span className="text-[9px] px-1 py-0.5 rounded bg-blue-500/30 text-blue-300">Speaker</span>
        )}
      </div>

      {/* Entries */}
      <div className="space-y-1">
        {allEntries.map((entry, i) => (
          <div key={i} className="flex gap-1.5">
            <span
              className={`font-bold text-[10px] shrink-0 mt-0.5 ${
                entry.speaker === 'you' ? 'text-red-400' : 'text-blue-400'
              }`}
            >
              {entry.speaker === 'you' ? 'You:' : 'Speaker:'}
            </span>
            <span className="text-white/90">{entry.text}</span>
          </div>
        ))}

        {micInterim && (
          <div className="flex gap-1.5 opacity-50">
            <span className="font-bold text-[10px] text-red-400 shrink-0 mt-0.5">You:</span>
            <span className="italic">{micInterim}</span>
          </div>
        )}
        {speakerInterim && (
          <div className="flex gap-1.5 opacity-50">
            <span className="font-bold text-[10px] text-blue-400 shrink-0 mt-0.5">Speaker:</span>
            <span className="italic">{speakerInterim}</span>
          </div>
        )}

        {anyListening && !hasContent && (
          <span className="text-white/40 italic">Speak now...</span>
        )}
      </div>
    </div>
  )
}

export default TranscriptionDisplay
