/**
 * Horalix Halo - ChatPanel Component
 *
 * Main chat interface with real-time streaming.
 * The heart of the Horalix Halo experience.
 */

import React, { useRef, useEffect, useState } from "react"
import { useSessionStore, useLlmStore, useSettingsStore } from "../../store"
import { GlassCard, GlassButton, GlassPill, GlassTextarea } from "../glass"
import { cn, formatRelativeTime } from "../../lib/utils"
import ReactMarkdown from "react-markdown"
import { motion, AnimatePresence } from "framer-motion"

export const ChatPanel: React.FC = () => {
  const [input, setInput] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const {
    messages,
    streamingMessage,
    streamingReasoning,
    isProcessing,
    currentMode,
    currentAnswerType,
    addMessage,
    setProcessing,
  } = useSessionStore()

  const { isStreaming } = useLlmStore()
  const { showReasoningByDefault, defaultMode, defaultAnswerType } =
    useSettingsStore()

  const [showReasoning, setShowReasoning] = useState(showReasoningByDefault)

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, streamingMessage])

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [input])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isProcessing) return

    // Add user message
    addMessage({
      sessionId: "", // Will be set by store
      role: "user",
      content: input.trim(),
    })

    setInput("")
    setProcessing(true)

    // TODO: Call LLM Engine via IPC
    // For now, simulate
    setTimeout(() => {
      addMessage({
        sessionId: "",
        role: "assistant",
        content: "This is a simulated response. LLM integration coming next!",
      })
      setProcessing(false)
    }, 1000)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  return (
    <GlassCard className="flex flex-col h-full" padding="none">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-white">Chat</h2>
          <GlassPill size="sm" variant="primary">
            {currentMode}
          </GlassPill>
          {currentAnswerType !== "auto" && (
            <GlassPill size="sm" variant="info">
              {currentAnswerType}
            </GlassPill>
          )}
        </div>

        <div className="flex items-center gap-2">
          {streamingReasoning && (
            <GlassButton
              size="sm"
              variant="ghost"
              onClick={() => setShowReasoning(!showReasoning)}
            >
              {showReasoning ? "Hide" : "Show"} Reasoning
            </GlassButton>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <AnimatePresence>
          {messages.map((message, index) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChatMessage
                message={message}
                showReasoning={showReasoning}
              />
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Streaming Message */}
        {(streamingMessage || isStreaming) && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-halo-gradient flex items-center justify-center text-white text-sm font-semibold">
                H
              </div>
              <div className="flex-1 space-y-2">
                {streamingMessage && (
                  <GlassCard variant="subtle" padding="md">
                    <ReactMarkdown className="prose prose-invert prose-sm max-w-none">
                      {streamingMessage}
                    </ReactMarkdown>
                    <div className="mt-2 flex items-center gap-1">
                      <div className="w-2 h-2 bg-halo-purple-500 rounded-full animate-pulse" />
                      <div
                        className="w-2 h-2 bg-halo-indigo-500 rounded-full animate-pulse"
                        style={{ animationDelay: "0.2s" }}
                      />
                      <div
                        className="w-2 h-2 bg-halo-teal-500 rounded-full animate-pulse"
                        style={{ animationDelay: "0.4s" }}
                      />
                    </div>
                  </GlassCard>
                )}

                {showReasoning && streamingReasoning && (
                  <GlassCard
                    variant="default"
                    padding="md"
                    className="border-halo-purple-500/30"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <svg
                        className="w-4 h-4 text-halo-purple-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                        />
                      </svg>
                      <span className="text-xs font-medium text-halo-purple-400">
                        Reasoning
                      </span>
                    </div>
                    <ReactMarkdown className="prose prose-invert prose-sm max-w-none text-slate-400">
                      {streamingReasoning}
                    </ReactMarkdown>
                  </GlassCard>
                )}
              </div>
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-white/10">
        <div className="flex gap-2">
          <GlassTextarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything..."
            className="min-h-[44px] max-h-[200px] resize-none"
            rows={1}
            disabled={isProcessing}
          />
          <GlassButton
            type="submit"
            variant="primary"
            glow
            disabled={!input.trim() || isProcessing}
            loading={isProcessing}
            className="self-end"
          >
            Send
          </GlassButton>
        </div>

        {/* Keyboard Hints */}
        <div className="mt-2 flex items-center gap-4 text-xs text-slate-500">
          <span>⏎ to send • ⇧⏎ for new line</span>
          <span className="ml-auto">⌘K for commands</span>
        </div>
      </form>
    </GlassCard>
  )
}

// ============================================================================
// CHAT MESSAGE COMPONENT
// ============================================================================

interface ChatMessageProps {
  message: any
  showReasoning: boolean
}

const ChatMessage: React.FC<ChatMessageProps> = ({
  message,
  showReasoning,
}) => {
  const isUser = message.role === "user"

  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      {/* Avatar */}
      <div
        className={cn(
          "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold",
          isUser
            ? "bg-slate-700 text-slate-300"
            : "bg-halo-gradient text-white"
        )}
      >
        {isUser ? "U" : "H"}
      </div>

      {/* Content */}
      <div className={cn("flex-1 space-y-2", isUser && "flex flex-col items-end")}>
        <GlassCard
          variant={isUser ? "default" : "subtle"}
          padding="md"
          className={cn(isUser && "bg-halo-gradient-subtle")}
        >
          <ReactMarkdown className="prose prose-invert prose-sm max-w-none">
            {message.content}
          </ReactMarkdown>

          {/* Timestamp */}
          <div
            className={cn(
              "mt-2 text-xs text-slate-500",
              isUser && "text-right"
            )}
          >
            {formatRelativeTime(message.createdAt)}
          </div>
        </GlassCard>

        {/* Reasoning (for assistant messages) */}
        {!isUser && showReasoning && message.reasoningContent && (
          <GlassCard
            variant="default"
            padding="md"
            className="border-halo-purple-500/30"
          >
            <div className="flex items-center gap-2 mb-2">
              <svg
                className="w-4 h-4 text-halo-purple-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                />
              </svg>
              <span className="text-xs font-medium text-halo-purple-400">
                Reasoning
              </span>
            </div>
            <ReactMarkdown className="prose prose-invert prose-sm max-w-none text-slate-400">
              {message.reasoningContent}
            </ReactMarkdown>
          </GlassCard>
        )}
      </div>
    </div>
  )
}
