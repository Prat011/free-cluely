import { useState, useRef, useCallback, useEffect } from 'react'

const STORAGE_KEY = 'speechRecognitionLang'

export function useSpeechRecognition() {
  const [transcript, setTranscript] = useState('')
  const [interimText, setInterimText] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const shouldBeListening = useRef(false)

  const isSupported = typeof webkitSpeechRecognition !== 'undefined'

  const start = useCallback(() => {
    if (!isSupported) {
      setError('Speech recognition not supported')
      return
    }
    setError(null)
    setTranscript('')
    setInterimText('')

    const lang = localStorage.getItem(STORAGE_KEY) || navigator.language || 'en-US'
    const recognition = new webkitSpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = lang

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let final = ''
      let interim = ''
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          final += result[0].transcript
        } else {
          interim += result[0].transcript
        }
      }
      setTranscript(final)
      setInterimText(interim)
    }

    recognition.onerror = (event) => {
      if (event.error !== 'no-speech') {
        setError(event.error)
      }
    }

    recognition.onend = () => {
      if (shouldBeListening.current) {
        try { recognition.start() } catch { /* ignore */ }
        return
      }
      setIsListening(false)
    }

    recognitionRef.current = recognition
    shouldBeListening.current = true
    recognition.start()
    setIsListening(true)
  }, [isSupported])

  const stop = useCallback(() => {
    shouldBeListening.current = false
    recognitionRef.current?.stop()
    setIsListening(false)
  }, [])

  const reset = useCallback(() => {
    setTranscript('')
    setInterimText('')
    setError(null)
  }, [])

  useEffect(() => {
    return () => {
      shouldBeListening.current = false
      recognitionRef.current?.abort()
    }
  }, [])

  return { transcript, interimText, isListening, start, stop, reset, isSupported, error }
}
