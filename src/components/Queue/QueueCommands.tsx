import React, { useState, useEffect, useRef } from "react"
import { IoLogOutOutline } from "react-icons/io5"
import { Dialog, DialogContent, DialogClose } from "../ui/dialog"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'

// Function to format text with markdown support
const formatText = (text: string) => {
  const parts: (string | JSX.Element)[] = []
  let lastIndex = 0

  // Handle code blocks first (```code```)
  const codeBlockRegex = /```(\w+)?\n?([\s\S]*?)```/g
  let match
  while ((match = codeBlockRegex.exec(text)) !== null) {
    // Add text before the code block
    if (match.index > lastIndex) {
      parts.push(formatInlineMarkdown(text.slice(lastIndex, match.index)))
    }

    // Add the code block
    const language = match[1] || 'text'
    const code = match[2].trim()
    parts.push(
      <div key={`code-${match.index}`} className="my-2 rounded-md overflow-hidden">
        <SyntaxHighlighter
          language={language}
          style={oneDark}
          customStyle={{
            margin: 0,
            padding: '12px',
            fontSize: '11px',
            background: '#1e1e1e'
          }}
        >
          {code}
        </SyntaxHighlighter>
      </div>
    )

    lastIndex = match.index + match[0].length
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(formatInlineMarkdown(text.slice(lastIndex)))
  }

  return parts
}

// Function to format inline markdown (bold, italic, code, links)
const formatInlineMarkdown = (text: string) => {
  const parts: (string | JSX.Element)[] = []
  let lastIndex = 0

  // Handle inline code first
  const inlineCodeRegex = /`([^`]+)`/g
  let match
  while ((match = inlineCodeRegex.exec(text)) !== null) {
    // Add text before the code
    if (match.index > lastIndex) {
      parts.push(formatSimpleMarkdown(text.slice(lastIndex, match.index)))
    }

    // Add the inline code
    parts.push(
      <code key={`inline-${match.index}`} className="bg-gray-800 px-1 py-0.5 rounded text-xs font-mono">
        {match[1]}
      </code>
    )

    lastIndex = match.index + match[0].length
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(formatSimpleMarkdown(text.slice(lastIndex)))
  }

  return parts.length > 0 ? <>{parts}</> : text
}

// Function to format simple markdown (bold, italic, links)
const formatSimpleMarkdown = (text: string) => {
  // Handle line breaks
  const lines = text.split('\n')
  const formattedLines: (string | JSX.Element)[] = []

  lines.forEach((line, index) => {
    // Handle bold (**text**)
    line = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    // Handle italic (*text*)
    line = line.replace(/\*(.*?)\*/g, '<em>$1</em>')
    // Handle links [text](url)
    line = line.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-blue-400 underline hover:text-blue-300">$1</a>')

    if (index > 0) {
      formattedLines.push(<br key={`br-${index}`} />)
    }
    formattedLines.push(<span key={`line-${index}`} dangerouslySetInnerHTML={{ __html: line }} />)
  })

  return <>{formattedLines}</>
}

interface QueueCommandsProps {
  onTooltipVisibilityChange: (visible: boolean, height: number) => void
  screenshots: Array<{ path: string; preview: string }>
  onChatToggle: () => void
  onSettingsToggle: () => void
}

const QueueCommands: React.FC<QueueCommandsProps> = ({
  onTooltipVisibilityChange,
  screenshots,
  onChatToggle,
  onSettingsToggle
}) => {
  const [isHelpDialogOpen, setIsHelpDialogOpen] = useState(false)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null)
  const [audioResult, setAudioResult] = useState<string | null>(null)
  const chunks = useRef<Blob[]>([])
  // Remove all chat-related state, handlers, and the Dialog overlay from this file.

  useEffect(() => {
    let tooltipHeight = 0
    if (tooltipRef.current && isHelpDialogOpen) {
      tooltipHeight = tooltipRef.current.offsetHeight + 10
    }
    onTooltipVisibilityChange(isHelpDialogOpen, tooltipHeight)
  }, [isHelpDialogOpen])

  const handleHelpClick = () => {
    setIsHelpDialogOpen(!isHelpDialogOpen)
  }

  const handleRecordClick = async () => {
    if (!isRecording) {
      // Start recording
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        const recorder = new MediaRecorder(stream)
        recorder.ondataavailable = (e) => chunks.current.push(e.data)
        recorder.onstop = async () => {
          const blob = new Blob(chunks.current, { type: chunks.current[0]?.type || 'audio/webm' })
          chunks.current = []
          const reader = new FileReader()
          reader.onloadend = async () => {
            const base64Data = (reader.result as string).split(',')[1]
            try {
              const result = await window.electronAPI.analyzeAudioFromBase64(base64Data, blob.type)
              setAudioResult(result.text)
            } catch (err) {
              setAudioResult('Audio analysis failed.')
            }
          }
          reader.readAsDataURL(blob)
        }
        setMediaRecorder(recorder)
        recorder.start()
        setIsRecording(true)
      } catch (err) {
        setAudioResult('Could not start recording.')
      }
    } else {
      // Stop recording
      mediaRecorder?.stop()
      setIsRecording(false)
      setMediaRecorder(null)
    }
  }

  // Remove handleChatSend function

  return (
    <div className="w-fit">
      <div className="text-xs text-white/90 liquid-glass-bar py-1 px-4 flex items-center justify-center gap-4 draggable-area">
        {/* Show/Hide */}
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <button
              onClick={() => window.electronAPI.hideWindow().catch(console.error)}
              className="bg-white/100 hover:bg-white/20 transition-colors rounded-md px-2 py-1 text-[11px] leading-none text-black/70"
            >
              Hide
            </button>
          </div>
        </div>

        {/* Screenshot */}
        {/* Removed screenshot button from main bar for seamless screenshot-to-LLM UX */}

        {/* Solve Command */}
        {screenshots.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] leading-none">Solve</span>
            <div className="flex gap-1">
              <button
                onClick={() => window.electronAPI.processScreenshots()}
                className="bg-white/10 hover:bg-white/20 transition-colors rounded-md px-1.5 py-1 text-[11px] leading-none text-white/70"
              >
                ⌘
              </button>
              <button
                onClick={() => window.electronAPI.processScreenshots()}
                className="bg-white/10 hover:bg-white/20 transition-colors rounded-md px-1.5 py-1 text-[11px] leading-none text-white/70"
              >
                ↵
              </button>
            </div>
          </div>
        )}

        {/* Voice Recording Button */}
        <div className="flex items-center gap-2">
          <button
            className={`bg-white/100 hover:bg-white/20 transition-colors rounded-md px-2 py-1 text-[11px] leading-none text-black/70 flex items-center gap-1 ${isRecording ? 'bg-red-500/70 hover:bg-red-500/90' : ''}`}
            onClick={handleRecordClick}
            type="button"
          >
            {isRecording ? (
              <span className="animate-pulse">● Stop Recording</span>
            ) : (
              <span>Record Voice</span>
            )}
          </button>
        </div>

        {/* Chat Button */}
        <div className="flex items-center gap-2">
          <button
            className="bg-white/100 hover:bg-white/20 transition-colors rounded-md px-2 py-1 text-[11px] leading-none text-black/70 flex items-center gap-1"
            onClick={onChatToggle}
            type="button"
          >
            Chat
          </button>
        </div>

        {/* Settings Button */}
        <div className="flex items-center gap-2">
          <button
            className="bg-white/100 hover:bg-white/20 transition-colors rounded-md px-2 py-1 text-[11px] leading-none text-black/70 flex items-center gap-1"
            onClick={onSettingsToggle}
            type="button"
          >
            Models
          </button>
        </div>

        {/* Add this button in the main button row, before the separator and sign out */}
        {/* Remove the Chat button */}

        {/* Question mark with help dialog */}
        <div className="relative inline-block">
          <button
            className="w-5 h-5 rounded-full bg-white/100 hover:bg-white/20 backdrop-blur-sm transition-colors flex items-center justify-center cursor-pointer z-10"
            onClick={handleHelpClick}
            type="button"
          >
            <span className="text-xs text-black/70">?</span>
          </button>

          {/* Help Dialog */}
          {isHelpDialogOpen && (
            <div
              ref={tooltipRef}
              className="absolute top-full right-0 mt-2 w-80 z-20"
            >
              <div className="p-4 text-xs bg-black/90 backdrop-blur-md rounded-lg border border-white/20 text-white/90 shadow-xl">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">Help & Shortcuts</h3>
                    <button
                      onClick={() => setIsHelpDialogOpen(false)}
                      className="text-white/60 hover:text-white/90 text-sm"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="space-y-3">
                    {/* Toggle Command */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span>Toggle Window</span>
                        <div className="flex gap-1 flex-shrink-0">
                          <span className="bg-white/10 px-1.5 py-0.5 rounded text-[10px] leading-none">
                            ctrl + 
                          </span>
                          <span className="bg-white/10 px-1.5 py-0.5 rounded text-[10px] leading-none">
                            B
                          </span>
                        </div>
                      </div>
                      <p className="text-[10px] leading-relaxed text-white/70">
                        Show or hide this window.
                      </p>
                    </div>
                    {/* Screenshot Command */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span>Take Screenshot</span>
                        <div className="flex gap-1 flex-shrink-0">
                          <span className="bg-white/10 px-1.5 py-0.5 rounded text-[10px] leading-none">
                            ctrl +
                          </span>
                          <span className="bg-white/10 px-1.5 py-0.5 rounded text-[10px] leading-none">
                            H
                          </span>
                        </div>
                      </div>
                      <p className="text-[10px] leading-relaxed text-white/70">
                        Take a screenshot of the problem description. The tool
                        will extract and analyze the problem.
                      </p>
                    </div>

                    {/* Solve Command */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span>Solve Problem</span>
                        <div className="flex gap-1 flex-shrink-0">
                          <span className="bg-white/10 px-1.5 py-0.5 rounded text-[10px] leading-none">
                            ctrl +
                          </span>
                          <span className="bg-white/10 px-1.5 py-0.5 rounded text-[10px] leading-none">
                            ↵
                          </span>
                        </div>
                      </div>
                      <p className="text-[10px] leading-relaxed text-white/70">
                        Generate a solution based on the current problem.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Separator */}
        <div className="mx-2 h-4 w-px bg-white/20" />

        {/* Sign Out Button - Moved to end */}
        <button
          className="text-white-500/70 hover:text-red-500/90 transition-colors hover:cursor-pointer"
          title="Sign Out"
          onClick={() => window.electronAPI.quitApp()}
        >
          <IoLogOutOutline className="w-4 h-4" />
        </button>
      </div>
      {/* Audio Result Display */}
      {audioResult && (
        <div className="mt-2 p-2 bg-white/10 rounded text-white text-xs max-w-md relative">
          <button
            onClick={() => setAudioResult(null)}
            className="absolute top-1 right-1 w-4 h-4 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 rounded-full transition-colors"
            aria-label="Close audio result"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div className="pr-6">
            <span className="font-semibold">Audio Result:</span> {formatText(audioResult)}
          </div>
        </div>
      )}
      {/* Chat Dialog Overlay */}
      {/* Remove the Dialog component */}
    </div>
  )
}

export default QueueCommands
