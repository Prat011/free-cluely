import { useState, useRef, useCallback, useEffect } from 'react'

const STORAGE_KEY = 'speechRecognitionLang'

export function useSpeakerTranscription() {
  const [transcript, setTranscript] = useState('')
  const [interimText, setInterimText] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const streamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const workletNodeRef = useRef<AudioWorkletNode | null>(null)
  const cleanupIpcRef = useRef<(() => void) | null>(null)
  const cleanupStatusRef = useRef<(() => void) | null>(null)
  const startingRef = useRef(false)
  const stopRef = useRef<() => Promise<void>>()

  const stop = useCallback(async () => {
    workletNodeRef.current?.disconnect()
    workletNodeRef.current = null

    await audioContextRef.current?.close().catch(() => {})
    audioContextRef.current = null

    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null

    await window.electronAPI.stopSpeakerTranscription()

    cleanupIpcRef.current?.()
    cleanupIpcRef.current = null
    cleanupStatusRef.current?.()
    cleanupStatusRef.current = null

    startingRef.current = false
    setIsListening(false)
  }, [])

  // Keep ref in sync for unmount cleanup
  stopRef.current = stop

  const start = useCallback(async () => {
    if (startingRef.current || isListening) return
    startingRef.current = true

    setError(null)
    setTranscript('')
    setInterimText('')

    const language = localStorage.getItem(STORAGE_KEY) || navigator.language || 'en-US'

    // 1. Start Gemini Live API session on main process
    try {
      const result = await window.electronAPI.startSpeakerTranscription(language)
      if (!result.success) {
        console.log('[SpeakerTranscription] Not available:', result.error)
        startingRef.current = false
        return
      }
    } catch (err) {
      console.log('[SpeakerTranscription] Failed to start:', err)
      startingRef.current = false
      return
    }

    // 2. Capture system audio via getDisplayMedia
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        audio: true,
        video: false,
      } as any)
    } catch (err) {
      console.log('[SpeakerTranscription] getDisplayMedia failed:', err)
      await window.electronAPI.stopSpeakerTranscription()
      startingRef.current = false
      return
    }

    if (stream.getAudioTracks().length === 0) {
      console.log('[SpeakerTranscription] No audio tracks in stream')
      stream.getTracks().forEach(t => t.stop())
      await window.electronAPI.stopSpeakerTranscription()
      startingRef.current = false
      return
    }

    // Discard video tracks (we only need audio)
    stream.getVideoTracks().forEach(t => t.stop())
    streamRef.current = stream

    // 3. AudioContext at 16kHz -> AudioWorklet -> IPC
    try {
      const audioContext = new AudioContext({ sampleRate: 16000 })
      audioContextRef.current = audioContext

      await audioContext.audioWorklet.addModule('/pcm-processor.js')

      const source = audioContext.createMediaStreamSource(stream)
      const workletNode = new AudioWorkletNode(audioContext, 'pcm-processor')
      workletNodeRef.current = workletNode

      workletNode.port.onmessage = (event) => {
        if (event.data.type === 'pcm-chunk') {
          window.electronAPI.sendSpeakerAudioChunk(event.data.data)
        }
      }

      source.connect(workletNode)

      // Silent gain node keeps the pipeline alive without audible output
      const silentGain = audioContext.createGain()
      silentGain.gain.value = 0
      workletNode.connect(silentGain)
      silentGain.connect(audioContext.destination)
    } catch (err) {
      console.error('[SpeakerTranscription] AudioContext setup failed:', err)
      stream.getTracks().forEach(t => t.stop())
      await window.electronAPI.stopSpeakerTranscription()
      setError('Audio processing setup failed')
      startingRef.current = false
      return
    }

    // 4. Listen for transcription results from main process
    cleanupIpcRef.current = window.electronAPI.onSpeakerTranscription((data) => {
      if (data.isFinal && data.text) {
        setTranscript(prev => prev ? prev + ' ' + data.text : data.text)
        setInterimText('')
      } else if (data.text) {
        setInterimText(data.text)
      }
    })

    cleanupStatusRef.current = window.electronAPI.onSpeakerTranscriptionStatus((data) => {
      if (data.status === 'disconnected') {
        setIsListening(false)
      }
    })

    setIsListening(true)
  }, [isListening])

  const reset = useCallback(() => {
    setTranscript('')
    setInterimText('')
    setError(null)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRef.current?.()
    }
  }, [])

  return { transcript, interimText, isListening, start, stop, reset, error }
}
