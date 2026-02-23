import React, { useState, useEffect, useRef } from "react"
import { useQuery } from "react-query"
import ReactMarkdown from "react-markdown"
import type { Components } from "react-markdown"
import remarkGfm from "remark-gfm"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { oneLight } from "react-syntax-highlighter/dist/esm/styles/prism"
import ScreenshotQueue from "../components/Queue/ScreenshotQueue"
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

const detectCodeLanguage = (content: string): string => {
  if (/(#include\s*<|std::|vector<|unordered_map<|using\s+namespace\s+std)/.test(content)) {
    return "cpp"
  }
  if (/(^\s*def\s+\w+\(|^\s*import\s+\w+|^\s*from\s+\w+\s+import\s+)/m.test(content)) {
    return "python"
  }
  if (/(^\s*(const|let|var)\s+\w+|console\.log\(|=>\s*{?|function\s+\w+\()/m.test(content)) {
    return "javascript"
  }
  if (/(^\s*public\s+class\s+\w+|System\.out\.println|^\s*class\s+\w+\s*{)/m.test(content)) {
    return "java"
  }
  if (/(^\s*func\s+\w+\(|^\s*package\s+main|fmt\.)/m.test(content)) {
    return "go"
  }
  if (/(^\s*fn\s+\w+\(|^\s*let\s+mut\s+\w+)/m.test(content)) {
    return "rust"
  }
  return "text"
}

const isLikelyPlainCodeBlock = (content: string): boolean => {
  const trimmed = content.trim()
  if (!trimmed || trimmed.startsWith("```")) return false

  const lines = trimmed.split("\n").map((line) => line.trim()).filter(Boolean)
  if (lines.length < 3) return false

  const codeLikeLines = lines.filter((line) =>
    /[{};]$|^\s*#include|^\s*(class|def|function|public:|private:|protected:|return|if|for|while|switch)\b|^\s*\w[\w:<>,\s*&]*\s+\w+\s*\([^)]*\)\s*\{?$/.test(
      line
    )
  )

  return codeLikeLines.length >= Math.max(2, Math.floor(lines.length * 0.35))
}

const chatMarkdownComponents: Components = {
  p: ({ children }) => (
    <p className="mb-2 whitespace-pre-wrap last:mb-0">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="mb-2 list-disc pl-4 last:mb-0">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-2 list-decimal pl-4 last:mb-0">{children}</ol>
  ),
  li: ({ children }) => <li className="mb-1 last:mb-0">{children}</li>,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-blue-600 underline underline-offset-2"
    >
      {children}
    </a>
  ),
  pre: ({ children }) => <>{children}</>,
  code: ({ className, children }) => {
    const languageMatch = /language-(\w+)/.exec(className || "")
    const codeText = String(children).replace(/\n$/, "")
    const isBlock = Boolean(languageMatch) || codeText.includes("\n")

    if (!isBlock) {
      return (
        <code className="rounded bg-gray-200/70 px-1 py-0.5 font-mono text-[11px] text-gray-900">
          {children}
        </code>
      )
    }

    return (
      <div className="my-2 overflow-hidden rounded-md border border-gray-300 bg-gray-100/95">
        <SyntaxHighlighter
          language={languageMatch?.[1] || "text"}
          style={oneLight}
          customStyle={{
            margin: 0,
            padding: "0.75rem",
            fontSize: "0.72rem",
            lineHeight: "1.45",
            background: "transparent",
            color: "#111827"
          }}
          lineNumberStyle={{ color: "#4b5563" }}
          codeTagProps={{ style: { color: "#111827" } }}
          wrapLongLines
        >
          {codeText}
        </SyntaxHighlighter>
      </div>
    )
  }
}

const ChatMarkdown = ({ content }: { content: string }) => (
  <div className="text-xs leading-relaxed text-gray-700">
    {isLikelyPlainCodeBlock(content) ? (
      <div className="my-1 overflow-hidden rounded-md border border-gray-300 bg-gray-100/95">
        <SyntaxHighlighter
          language={detectCodeLanguage(content)}
          style={oneLight}
          customStyle={{
            margin: 0,
            padding: "0.75rem",
            fontSize: "0.72rem",
            lineHeight: "1.45",
            background: "transparent",
            color: "#111827"
          }}
          lineNumberStyle={{ color: "#4b5563" }}
          codeTagProps={{ style: { color: "#111827" } }}
          wrapLongLines
        >
          {content.trim()}
        </SyntaxHighlighter>
      </div>
    ) : (
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={chatMarkdownComponents}>
        {content}
      </ReactMarkdown>
    )}
  </div>
)

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
  const [chatMessages, setChatMessages] = useState<{role: "user"|"gemini", text: string}[]>([])
  const [chatLoading, setChatLoading] = useState(false)
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [attachLatestScreenshot, setAttachLatestScreenshot] = useState(true)
  const chatInputRef = useRef<HTMLInputElement>(null)
  
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [currentModel, setCurrentModel] = useState<{ provider: string; model: string }>({ provider: "gemini", model: "gemini-3-pro-preview" })

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
    const trimmedInput = chatInput.trim()
    const latestScreenshotPath =
      screenshots.length > 0 ? screenshots[screenshots.length - 1].path : ""
    const shouldAttachImage = attachLatestScreenshot && Boolean(latestScreenshotPath)

    if (!trimmedInput && !shouldAttachImage) return

    setChatMessages((msgs) => [
      ...msgs,
      {
        role: "user",
        text: shouldAttachImage
          ? `${trimmedInput || "Solve the attached screenshot."}\n[Attached: latest screenshot]`
          : trimmedInput
      }
    ])
    setChatLoading(true)
    setChatInput("")
    try {
      const response = shouldAttachImage
        ? await window.electronAPI.invoke(
            "gemini-chat-with-image",
            trimmedInput,
            latestScreenshotPath
          )
        : await window.electronAPI.invoke("gemini-chat", trimmedInput)

      setChatMessages((msgs) => [...msgs, { role: "gemini", text: response }])
    } catch (err) {
      const errorText = String(err)
      const hint =
        shouldAttachImage &&
        (errorText.includes("No handler registered") ||
          errorText.includes("No handler") ||
          errorText.includes("No listeners registered"))
          ? " Image chat route is not loaded. Restart the app once."
          : ""
      setChatMessages((msgs) => [...msgs, { role: "gemini", text: "Error: " + errorText + hint }])
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

  const handleModelChange = (provider: "ollama" | "gemini", model: string) => {
    setCurrentModel({ provider, model })
    // Update chat messages to reflect the model change
    const modelName = provider === "ollama" ? model : "Gemini"
    setChatMessages((msgs) => [...msgs, {
      role: "gemini",
      text: `Switched to ${provider === "ollama" ? "Ollama" : "Gemini"} ${modelName}. Ready for your questions!`
    }])
  }


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
              {chatMessages.length === 0 ? (
                <div className="text-sm text-gray-600 text-center mt-8">
                  Chat with {currentModel.provider === "ollama" ? "Ollama" : "Gemini"} {currentModel.model}
                  <br />
                  <span className="text-xs text-gray-500">Take a screenshot (Cmd+H), then press Send to solve</span>
                  <br />
                  <span className="text-xs text-gray-500">Click Models to switch AI providers</span>
                </div>
              ) : (
                chatMessages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`w-full flex ${msg.role === "user" ? "justify-end" : "justify-start"} mb-3`}
                  >
                    <div
                      className={`max-w-[80%] px-3 py-1.5 rounded-xl text-xs shadow-md backdrop-blur-sm border ${
                        msg.role === "user" 
                          ? "bg-gray-700/80 text-gray-100 ml-12 border-gray-600/40" 
                          : "bg-white/85 text-gray-700 mr-12 border-gray-200/50"
                      }`}
                      style={{ wordBreak: "break-word", lineHeight: "1.4" }}
                    >
                      {msg.role === "gemini" ? (
                        <ChatMarkdown content={msg.text} />
                      ) : (
                        <span className="whitespace-pre-wrap">{msg.text}</span>
                      )}
                    </div>
                  </div>
                ))
              )}
              {chatLoading && (
                <div className="flex justify-start mb-3">
                  <div className="bg-white/85 text-gray-600 px-3 py-1.5 rounded-xl text-xs backdrop-blur-sm border border-gray-200/50 shadow-md mr-12">
                    <span className="inline-flex items-center">
                      <span className="animate-pulse text-gray-400">.</span>
                      <span className="animate-pulse animation-delay-200 text-gray-400">.</span>
                      <span className="animate-pulse animation-delay-400 text-gray-400">.</span>
                      <span className="ml-2">{currentModel.model} is replying...</span>
                    </span>
                  </div>
                </div>
              )}
            </div>
            <div className="mb-2 flex items-center justify-between px-1 text-[11px] text-gray-600">
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={attachLatestScreenshot}
                  onChange={(e) => setAttachLatestScreenshot(e.target.checked)}
                  className="h-3 w-3 rounded border-gray-300 text-gray-700 focus:ring-gray-500"
                />
                Attach latest screenshot
              </label>
              {attachLatestScreenshot && (
                <span className={screenshots.length > 0 ? "text-gray-600" : "text-red-500"}>
                  {screenshots.length > 0 ? "ready" : "no screenshot available"}
                </span>
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
                placeholder={attachLatestScreenshot ? "Add instruction (optional) and send..." : "Type your message..."}
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                disabled={chatLoading}
              />
              <button
                type="submit"
                className="p-2 rounded-lg bg-gray-600/80 hover:bg-gray-700/80 border border-gray-500/60 flex items-center justify-center transition-all duration-200 backdrop-blur-sm shadow-lg disabled:opacity-50"
                disabled={
                  chatLoading ||
                  (!chatInput.trim() && !(attachLatestScreenshot && screenshots.length > 0))
                }
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
