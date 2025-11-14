/**
 * Horalix Halo - Live Transcription Component
 *
 * Real-time transcription with voice activity indicators
 * CLUELY DOESN'T HAVE THIS!
 */

import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card } from '../ui/card'

interface TranscriptSegment {
  id: string
  speaker: string
  text: string
  timestamp: number
  confidence: number
  isActive: boolean
}

interface LiveTranscriptionProps {
  meetingId: string
  isRecording: boolean
}

export function LiveTranscription({ meetingId, isRecording }: LiveTranscriptionProps) {
  const [segments, setSegments] = useState<TranscriptSegment[]>([])
  const [activeSpeakers, setActiveSpeakers] = useState<Set<string>>(new Set())
  const [waveformData, setWaveformData] = useState<number[]>(Array(40).fill(0))
  const scrollRef = useRef<HTMLDivElement>(null)

  // Simulate real-time transcription (replace with actual WebSocket)
  useEffect(() => {
    if (!isRecording) return

    const interval = setInterval(() => {
      // Simulate voice activity
      const speakers = ['You', 'Alice', 'Bob', 'Charlie']
      const activeSpeaker = speakers[Math.floor(Math.random() * speakers.length)]

      // Add new segment
      const newSegment: TranscriptSegment = {
        id: Date.now().toString(),
        speaker: activeSpeaker,
        text: 'This is a simulated transcription segment. Replace with real audio transcription.',
        timestamp: Date.now(),
        confidence: 0.85 + Math.random() * 0.15,
        isActive: true,
      }

      setSegments((prev) => {
        const updated = prev.map((s) => ({ ...s, isActive: false }))
        return [...updated, newSegment].slice(-20) // Keep last 20
      })

      setActiveSpeakers(new Set([activeSpeaker]))

      // Update waveform
      setWaveformData((prev) => {
        const newData = [...prev.slice(1), Math.random()]
        return newData
      })

      // Auto-scroll to bottom
      setTimeout(() => {
        scrollRef.current?.scrollTo({
          top: scrollRef.current.scrollHeight,
          behavior: 'smooth',
        })
      }, 100)
    }, 3000)

    return () => clearInterval(interval)
  }, [isRecording])

  const getSpeakerColor = (speaker: string) => {
    const colors: Record<string, string> = {
      You: 'from-purple-600 to-pink-600',
      Alice: 'from-blue-600 to-cyan-600',
      Bob: 'from-green-600 to-emerald-600',
      Charlie: 'from-orange-600 to-amber-600',
    }
    return colors[speaker] || 'from-gray-600 to-gray-700'
  }

  return (
    <Card className="p-6 bg-black/40 backdrop-blur-xl border-purple-500/30 h-[600px] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            🎤 Live Transcription
            {isRecording && (
              <motion.span
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="text-red-500 text-sm"
              >
                ● REC
              </motion.span>
            )}
          </h2>
          <p className="text-gray-400 text-sm">Real-time speech-to-text with AI</p>
        </div>

        {/* Active Speakers */}
        <div className="flex items-center gap-2">
          <AnimatePresence>
            {Array.from(activeSpeakers).map((speaker) => (
              <motion.div
                key={speaker}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                className={`px-3 py-1 rounded-full bg-gradient-to-r ${getSpeakerColor(speaker)} text-white text-sm font-semibold shadow-lg`}
              >
                {speaker} 🔊
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Waveform Visualization */}
      <div className="mb-4 p-4 bg-black/30 rounded-lg">
        <div className="flex items-end justify-between gap-1 h-16">
          {waveformData.map((value, index) => (
            <motion.div
              key={index}
              className="flex-1 bg-gradient-to-t from-purple-600 to-pink-600 rounded-full"
              animate={{
                height: `${value * 100}%`,
              }}
              transition={{ duration: 0.1 }}
              style={{ minHeight: '2px' }}
            />
          ))}
        </div>
      </div>

      {/* Transcript Segments */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 scrollbar-thin scrollbar-thumb-purple-500 scrollbar-track-black/20">
        <AnimatePresence>
          {segments.map((segment, index) => (
            <motion.div
              key={segment.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className={`p-4 rounded-lg transition-all ${
                segment.isActive
                  ? 'bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/50 shadow-lg shadow-purple-500/20'
                  : 'bg-black/30 border border-gray-700/30'
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Speaker Avatar */}
                <div
                  className={`w-10 h-10 rounded-full bg-gradient-to-br ${getSpeakerColor(segment.speaker)} flex items-center justify-center text-white font-bold flex-shrink-0 shadow-lg`}
                >
                  {segment.speaker[0]}
                </div>

                <div className="flex-1">
                  {/* Speaker Name & Timestamp */}
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white font-semibold">{segment.speaker}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 text-xs">
                        {new Date(segment.timestamp).toLocaleTimeString()}
                      </span>
                      {/* Confidence Indicator */}
                      <div className="flex items-center gap-1">
                        {[...Array(5)].map((_, i) => (
                          <div
                            key={i}
                            className={`w-1 h-3 rounded-full ${
                              i < Math.floor(segment.confidence * 5)
                                ? 'bg-green-400'
                                : 'bg-gray-600'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Transcript Text */}
                  <p className="text-gray-300 leading-relaxed">
                    {segment.text}
                  </p>

                  {/* Live Typing Indicator */}
                  {segment.isActive && (
                    <motion.div
                      className="mt-2 flex items-center gap-1"
                      animate={{ opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    >
                      <div className="w-2 h-2 rounded-full bg-purple-500" />
                      <div className="w-2 h-2 rounded-full bg-purple-500" />
                      <div className="w-2 h-2 rounded-full bg-purple-500" />
                      <span className="text-xs text-purple-400 ml-2">Transcribing...</span>
                    </motion.div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {!isRecording && segments.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <motion.div
              animate={{
                scale: [1, 1.1, 1],
              }}
              transition={{ duration: 2, repeat: Infinity }}
              className="text-6xl mb-4"
            >
              🎤
            </motion.div>
            <p className="text-gray-400 text-lg">Start recording to see live transcription</p>
            <p className="text-gray-500 text-sm mt-2">AI will automatically transcribe speech in real-time</p>
          </div>
        )}
      </div>

      {/* Footer Stats */}
      {segments.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-700/30 flex items-center justify-between text-sm">
          <div className="text-gray-400">
            <span className="text-white font-semibold">{segments.length}</span> segments
          </div>
          <div className="text-gray-400">
            Avg confidence:{' '}
            <span className="text-green-400 font-semibold">
              {Math.round((segments.reduce((acc, s) => acc + s.confidence, 0) / segments.length) * 100)}%
            </span>
          </div>
          <button className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition text-sm font-semibold">
            Export Transcript
          </button>
        </div>
      )}
    </Card>
  )
}
