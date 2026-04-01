import React, { useState, useEffect, useRef } from "react"
import { useQuery } from "react-query"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkBreaks from "remark-breaks"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { oneLight } from "react-syntax-highlighter/dist/esm/styles/prism"
import {
  Toast,
  ToastTitle,
  ToastDescription,
  ToastVariant,
  ToastMessage
} from "../components/ui/toast"
import QueueCommands from "../components/Queue/QueueCommands"
import ModelSelector from "../components/ui/ModelSelector"

interface QueueProps {
  setView: React.Dispatch<React.SetStateAction<"queue" | "solutions" | "debug">>
}

type SessionSource = "chat" | "audio" | "image" | "assistant" | "system"

interface SessionEntry {
  id: string
  source: SessionSource
  text: string
  timestamp: number
  metadata?: Record<string, any>
}

interface FormattedMessageProps {
  text: string
  tone: "assistant" | "user"
}

const FormattedMessage: React.FC<FormattedMessageProps> = ({ text, tone }) => {
  const isAssistant = tone === "assistant"
  const linkClass = isAssistant ? "text-blue-700 underline" : "text-blue-200 underline"
  const inlineCodeClass = isAssistant
    ? "rounded px-1 py-0.5 font-mono text-[11px] bg-gray-200/70 text-gray-800"
    : "rounded px-1 py-0.5 font-mono text-[11px] bg-black/20 text-gray-100"
  const normalizedText = !text.includes("\n") && text.includes("\\n")
    ? text.replace(/\\n/g, "\n")
    : text

  return (
    <div className="chat-markdown text-xs leading-relaxed whitespace-pre-wrap break-words">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={{
          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>,
          li: ({ children }) => <li>{children}</li>,
          h1: ({ children }) => <h1 className="text-[13px] font-semibold mb-1">{children}</h1>,
          h2: ({ children }) => <h2 className="text-[13px] font-semibold mb-1">{children}</h2>,
          h3: ({ children }) => <h3 className="text-[12px] font-semibold mb-1">{children}</h3>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-gray-400/60 pl-2 italic mb-2">{children}</blockquote>
          ),
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer" className={linkClass}>
              {children}
            </a>
          ),
          code: ({ className, children, ...props }) => {
            const languageMatch = /language-(\w+)/.exec(className || "")
            const content = String(children).replace(/\n$/, "")
            const isInlineCode = !className && !content.includes("\n")

            if (isInlineCode) {
              return (
                <code className={inlineCodeClass} {...props}>
                  {children}
                </code>
              )
            }

            return (
              <SyntaxHighlighter
                style={oneLight as any}
                language={languageMatch?.[1] || "text"}
                PreTag="div"
                customStyle={{
                  margin: "0 0 0.5rem 0",
                  borderRadius: "0.5rem",
                  fontSize: "11px",
                  padding: "0.6rem"
                }}
              >
                {content}
              </SyntaxHighlighter>
            )
          }
        }}
      >
        {normalizedText}
      </ReactMarkdown>
    </div>
  )
}

const Queue: React.FC<QueueProps> = ({ setView }) => {
  const [toastOpen, setToastOpen] = useState(false)
  const [toastMessage, setToastMessage] = useState<ToastMessage>({
    title: "",
    description: "",
    variant: "neutral"
  })

  const [isTooltipVisible, setIsTooltipVisible] = useState(false)
  const [tooltipHeight, setTooltipHeight] = useState(0)
  const contentRef = useRef<HTMLDivElement>(null)

  const [chatInput, setChatInput] = useState("")
  const [sessionEntries, setSessionEntries] = useState<SessionEntry[]>([])
  const [chatLoading, setChatLoading] = useState(false)
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [realtimeAudioActive, setRealtimeAudioActive] = useState(false)
  const [realtimeSessionTranscript, setRealtimeSessionTranscript] = useState("")
  const [realtimePartialTranscript, setRealtimePartialTranscript] = useState("")
  const prevRealtimeAudioActiveRef = useRef(false)
  const lastAudioToastRef = useRef<{ key: string; at: number }>({ key: "", at: 0 })
  const [hotkeys, setHotkeys] = useState({
    screenshot: "Ctrl+Alt+Shift+H",
    solve: "Ctrl+Alt+Shift+Enter",
    openChat: "Ctrl+Alt+Shift+C",
    sttToggle: "Ctrl+Alt+Shift+S"
  })
  const chatInputRef = useRef<HTMLInputElement>(null)
  
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [currentModel, setCurrentModel] = useState<{ provider: string; model: string }>({ provider: "gemini", model: "gemini-2.0-flash" })

  const barRef = useRef<HTMLDivElement>(null)

  const { data: screenshots = [], refetch } = useQuery<Array<{ path: string; preview: string }>, Error>(
    ["screenshots"],
    async () => {
      try {
        const existing = await window.electronAPI.getScreenshots()
        return existing
      } catch (error) {
        console.error("Error loading screenshots:", error)
        showToast("Error", "Failed to load existing screenshots", "error")
        return []
      }
    },
    {
      staleTime: Infinity,
      cacheTime: Infinity,
      refetchOnWindowFocus: true,
      refetchOnMount: true
    }
  )

  const showToast = (
    title: string,
    description: string,
    variant: ToastVariant
  ) => {
    setToastMessage({ title, description, variant })
    setToastOpen(true)
  }

  const showAudioToastDeduped = (
    title: string,
    description: string,
    variant: ToastVariant
  ) => {
    const key = `${title}:${description}`
    const now = Date.now()
    const last = lastAudioToastRef.current
    if (last.key === key && now - last.at < 2000) {
      return
    }

    lastAudioToastRef.current = { key, at: now }
    showToast(title, description, variant)
  }

  const handleDeleteScreenshot = async (index: number) => {
    const screenshotToDelete = screenshots[index]

    try {
      const response = await window.electronAPI.deleteScreenshot(
        screenshotToDelete.path
      )

      if (response.success) {
        refetch()
      } else {
        console.error("Failed to delete screenshot:", response.error)
        showToast("Error", "Failed to delete the screenshot file", "error")
      }
    } catch (error) {
      console.error("Error deleting screenshot:", error)
    }
  }

  const handleChatSend = async () => {
    if (!chatInput.trim()) return
    const message = chatInput.trim()
    setChatLoading(true)
    setChatInput("")
    try {
      await window.electronAPI.submitTaggedInput("chat", message, {
        trigger: "chat-ui"
      })
    } catch (err) {
      const errorEntry: SessionEntry = {
        id: `error-${Date.now()}`,
        source: "assistant",
        text: `Error: ${String(err)}`,
        timestamp: Date.now()
      }
      setSessionEntries((entries) => [...entries, errorEntry])
    } finally {
      setChatLoading(false)
      chatInputRef.current?.focus()
    }
  }

  // Load current model configuration on mount
  useEffect(() => {
    const loadCurrentModel = async () => {
      try {
        const config = await window.electronAPI.getCurrentLlmConfig();
        setCurrentModel({ provider: config.provider, model: config.model });
      } catch (error) {
        console.error('Error loading current model config:', error);
      }
    };
    loadCurrentModel();
  }, []);

  useEffect(() => {
    const loadSessionEntries = async () => {
      try {
        const entries = await window.electronAPI.getSessionEntries()
        setSessionEntries(entries)
      } catch (error) {
        console.error("Error loading session entries:", error)
      }
    }

    const loadRealtimeState = async () => {
      try {
        const state = await window.electronAPI.getRealtimeAudioTranscriptionState()
        setRealtimeAudioActive(state.active)
        setRealtimeSessionTranscript(state.finalTranscript || "")
        setRealtimePartialTranscript(state.partial)
        prevRealtimeAudioActiveRef.current = state.active
      } catch (error) {
        console.error("Error loading realtime transcription state:", error)
      }
    }

    const loadHotkeys = async () => {
      try {
        const remote = await window.electronAPI.getHotkeys()
        setHotkeys({
          screenshot: remote.screenshot,
          solve: remote.solve,
          openChat: remote.openChat,
          sttToggle: remote.sttToggle
        })
      } catch (error) {
        console.error("Error loading hotkeys:", error)
      }
    }

    loadSessionEntries()
    loadRealtimeState()
    loadHotkeys()

    const updateDimensions = () => {
      if (contentRef.current) {
        let contentHeight = contentRef.current.scrollHeight
        const contentWidth = contentRef.current.scrollWidth
        if (isTooltipVisible) {
          contentHeight += tooltipHeight
        }
        window.electronAPI.updateContentDimensions({
          width: contentWidth,
          height: contentHeight
        })
      }
    }

    const resizeObserver = new ResizeObserver(updateDimensions)
    if (contentRef.current) {
      resizeObserver.observe(contentRef.current)
    }
    updateDimensions()

    const cleanupFunctions = [
      window.electronAPI.onScreenshotTaken(() => refetch()),
      window.electronAPI.onResetView(() => refetch()),
      window.electronAPI.onOpenChat(() => {
        setIsChatOpen(true)
        setTimeout(() => chatInputRef.current?.focus(), 0)
      }),
      window.electronAPI.onSessionEntryAdded((entry) => {
        setSessionEntries((prev) => {
          if (prev.some((existing) => existing.id === entry.id)) {
            return prev
          }
          return [...prev, entry]
        })
      }),
      window.electronAPI.onAudioTranscriptStream((event) => {
        if (event.type === "partial") {
          setRealtimePartialTranscript(event.text)
          return
        }

        if (event.type === "final") {
          const finalText = (event.text || "").trim()
          if (finalText) {
            setRealtimeSessionTranscript((prev) => {
              if (!prev) return finalText
              if (prev.endsWith(finalText)) return prev
              return `${prev}\n${finalText}`
            })
          }
          setRealtimePartialTranscript("")
          return
        }

        if (event.type === "error") {
          showAudioToastDeduped("Audio Transcription Error", event.text, "error")
          return
        }

        if (event.type === "warn") {
          showAudioToastDeduped("Audio Transcription", event.text, "neutral")
          return
        }

        if (event.type === "status") {
          const statusText = (event.text || "").toLowerCase()
          const important =
            statusText.includes("starting stt") ||
            statusText.includes("stopped") ||
            statusText.includes("mic configured")

          if (important) {
            showAudioToastDeduped("Audio Transcription", event.text, "neutral")
          }
        }
      }),
      window.electronAPI.onAudioTranscriptionState((state) => {
        const wasActive = prevRealtimeAudioActiveRef.current
        if (state.active && !wasActive) {
          setRealtimeSessionTranscript("")
          setRealtimePartialTranscript("")
        }

        setRealtimeAudioActive(state.active)
        if (!state.active) {
          setRealtimePartialTranscript("")
        }

        prevRealtimeAudioActiveRef.current = state.active
      }),
      window.electronAPI.onSolutionError((error: string) => {
        showToast(
          "Processing Failed",
          "There was an error processing your screenshots.",
          "error"
        )
        setView("queue")
        console.error("Processing error:", error)
      }),
      window.electronAPI.onProcessingNoScreenshots(() => {
        showToast(
          "No Screenshots",
          "There are no screenshots to process.",
          "neutral"
        )
      })
    ]

    return () => {
      resizeObserver.disconnect()
      cleanupFunctions.forEach((cleanup) => cleanup())
    }
  }, [isTooltipVisible, tooltipHeight])

  const handleTooltipVisibilityChange = (visible: boolean, height: number) => {
    setIsTooltipVisible(visible)
    setTooltipHeight(height)
  }

  const handleChatToggle = () => {
    setIsChatOpen(!isChatOpen)
  }

  const handleSettingsToggle = () => {
    setIsSettingsOpen(!isSettingsOpen)
  }

  const handleModelChange = (provider: "ollama" | "gemini" | "nvidia", model: string) => {
    setCurrentModel({ provider, model })
    setIsChatOpen(true)
  }

  const formatSourceLabel = (entry: SessionEntry): string => {
    if (entry.source === "assistant") {
      const origin = typeof entry.metadata?.source === "string" ? String(entry.metadata.source) : ""
      return origin ? `assistant • ${origin}` : "assistant"
    }
    return entry.source
  }

  const visibleEntries = sessionEntries
    .filter((entry) => entry.source !== "system")
    .sort((a, b) => a.timestamp - b.timestamp)

  const liveAudioTranscript = [realtimeSessionTranscript, realtimePartialTranscript]
    .filter(Boolean)
    .join("\n")


  return (
    <div
      ref={barRef}
      style={{
        position: "relative",
        width: "100%",
        pointerEvents: "auto"
      }}
      className="select-none"
    >
      <div className="bg-transparent w-full">
        <div className="px-2 py-1">
          <Toast
            open={toastOpen}
            onOpenChange={setToastOpen}
            variant={toastMessage.variant}
            duration={3000}
          >
            <ToastTitle>{toastMessage.title}</ToastTitle>
            <ToastDescription>{toastMessage.description}</ToastDescription>
          </Toast>
          <div className="w-fit">
            <QueueCommands
              screenshots={screenshots}
              onTooltipVisibilityChange={handleTooltipVisibilityChange}
              onChatToggle={handleChatToggle}
              onSettingsToggle={handleSettingsToggle}
              hotkeys={hotkeys}
            />
          </div>
          {/* Conditional Settings Interface */}
          {isSettingsOpen && (
            <div className="mt-4 w-full mx-auto">
              <ModelSelector onModelChange={handleModelChange} onChatOpen={() => setIsChatOpen(true)} />
            </div>
          )}
          
          {/* Conditional Chat Interface */}
          {isChatOpen && (
            <div className="mt-4 w-full mx-auto liquid-glass chat-container p-4 flex flex-col">
            <div className="flex-1 overflow-y-auto mb-3 p-3 rounded-lg bg-white/10 backdrop-blur-md max-h-64 min-h-[120px] glass-content border border-white/20 shadow-lg">
              {visibleEntries.length === 0 ? (
                <div className="text-sm text-gray-600 text-center mt-8">
                  💬 Session Chat with {currentModel.provider === "ollama" ? "🏠" : currentModel.provider === "nvidia" ? "🟢" : "☁️"} {currentModel.model}
                  <br />
                  <span className="text-xs text-gray-500">Capture screenshot: Ctrl+H, process/solve: Ctrl+Enter</span>
                  <br />
                  <span className="text-xs text-gray-500">Capture screenshot: {hotkeys.screenshot}, process/solve: {hotkeys.solve}</span>
                  <br />
                  <span className="text-xs text-gray-500">Open chat: {hotkeys.openChat}, realtime STT toggle: {hotkeys.sttToggle}</span>
                </div>
              ) : (
                visibleEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className={`w-full flex ${entry.source === "assistant" ? "justify-start" : "justify-end"} mb-3`}
                  >
                    <div
                      className={`max-w-[80%] px-3 py-1.5 rounded-xl text-xs shadow-md backdrop-blur-sm border ${
                        entry.source === "assistant"
                          ? "bg-white/85 text-gray-700 mr-12 border-gray-200/50"
                          : entry.source === "chat" || entry.source === "audio" || entry.source === "image"
                          ? "bg-gray-700/80 text-gray-100 ml-12 border-gray-600/40" 
                          : "bg-white/85 text-gray-700 mr-12 border-gray-200/50"
                      }`}
                      style={{ wordBreak: "break-word", lineHeight: "1.4" }}
                    >
                      <div className="text-[10px] uppercase tracking-wide opacity-60 mb-1">[{formatSourceLabel(entry)}]</div>
                      <FormattedMessage
                        text={entry.text}
                        tone={entry.source === "assistant" ? "assistant" : "user"}
                      />
                    </div>
                  </div>
                ))
              )}
              {realtimeAudioActive && liveAudioTranscript && (
                <div className="flex justify-end mb-3">
                  <div className="max-w-[80%] px-3 py-1.5 rounded-xl text-xs shadow-md backdrop-blur-sm border bg-gray-700/80 text-gray-100 ml-12 border-gray-600/40">
                    <div className="text-[10px] uppercase tracking-wide opacity-60 mb-1">[audio-live]</div>
                    <FormattedMessage text={liveAudioTranscript} tone="user" />
                  </div>
                </div>
              )}
              {chatLoading && (
                <div className="flex justify-start mb-3">
                  <div className="bg-white/85 text-gray-600 px-3 py-1.5 rounded-xl text-xs backdrop-blur-sm border border-gray-200/50 shadow-md mr-12">
                    <span className="inline-flex items-center">
                      <span className="animate-pulse text-gray-400">●</span>
                      <span className="animate-pulse animation-delay-200 text-gray-400">●</span>
                      <span className="animate-pulse animation-delay-400 text-gray-400">●</span>
                      <span className="ml-2">{currentModel.model} is replying...</span>
                    </span>
                  </div>
                </div>
              )}
            </div>
            <form
              className="flex gap-2 items-center glass-content"
              onSubmit={e => {
                e.preventDefault();
                handleChatSend();
              }}
            >
              <input
                ref={chatInputRef}
                className="flex-1 rounded-lg px-3 py-2 bg-white/25 backdrop-blur-md text-gray-800 placeholder-gray-500 text-xs focus:outline-none focus:ring-1 focus:ring-gray-400/60 border border-white/40 shadow-lg transition-all duration-200"
                placeholder="Type your message..."
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                disabled={chatLoading}
              />
              <button
                type="submit"
                className="p-2 rounded-lg bg-gray-600/80 hover:bg-gray-700/80 border border-gray-500/60 flex items-center justify-center transition-all duration-200 backdrop-blur-sm shadow-lg disabled:opacity-50"
                disabled={chatLoading || !chatInput.trim()}
                tabIndex={-1}
                aria-label="Send"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="white" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-7.5-15-7.5v6l10 1.5-10 1.5v6z" />
                </svg>
              </button>
            </form>
          </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Queue
