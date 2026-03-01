import React, { useState, useEffect, useRef } from "react"
import { IoLogOutOutline } from "react-icons/io5"
import { Dialog, DialogContent, DialogClose } from "../ui/dialog"

// Simple markdown to HTML converter
function simpleMarkdown(text: string): string {
  if (!text) return "";
  let html = text
    // Escape HTML
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    // Headers
    .replace(/^### (.+)$/gm, "<strong>$1</strong>")
    .replace(/^## (.+)$/gm, "<strong style='font-size:1.1em'>$1</strong>")
    .replace(/^# (.+)$/gm, "<strong style='font-size:1.2em'>$1</strong>")
    // Bold and italic
    .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    // Inline code
    .replace(/`([^`]+)`/g, "<code style='background:rgba(255,255,255,0.1);padding:1px 4px;border-radius:3px;font-size:0.9em'>$1</code>")
    // Bullet points
    .replace(/^\* (.+)$/gm, "• $1")
    .replace(/^- (.+)$/gm, "• $1")
    // Numbered lists
    .replace(/^\d+\. (.+)$/gm, "  $1")
    // Line breaks
    .replace(/\n/g, "<br/>")
  return html;
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

  const [liveTranscript, setLiveTranscript] = useState({ final: '', interim: '' })
  const deepgramSocketRef = useRef<WebSocket | null>(null)
  const isRecordingRef = useRef<boolean>(false)
  const [deepgramStatus, setDeepgramStatus] = useState<"disconnected" | "connecting" | "connected" | "error">("disconnected")
  const [deepgramError, setDeepgramError] = useState<string>("")
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

  // Shared recording toggle function (used by both button and shortcut)
  // Mutex to prevent concurrent calls
  const isTogglingRef = useRef(false);
  const recordingStartTimeRef = useRef<number>(0);

  const toggleRecording = async () => {
    // Hard mutex: if we're already mid-toggle, ignore
    if (isTogglingRef.current) {
      console.log('[Recording] Toggle blocked - already toggling');
      return;
    }
    isTogglingRef.current = true;

    try {
      if (!isRecordingRef.current) {
        // ============ START RECORDING ============
        console.log('[Recording] Starting...');
        isRecordingRef.current = true;
        setIsRecording(true);
        recordingStartTimeRef.current = Date.now();

        let combinedStream: MediaStream;

        try {
          try {
            // Get desktop sources for system audio capture
            const sources = await window.electronAPI.getDesktopSources()
            if (sources.length === 0) throw new Error("No desktop sources available")

            // Capture system audio via desktopCapturer (includes meeting audio)
            const systemStream = await navigator.mediaDevices.getUserMedia({
              audio: {
                mandatory: {
                  chromeMediaSource: 'desktop',
                }
              } as any,
              video: {
                mandatory: {
                  chromeMediaSource: 'desktop',
                  chromeMediaSourceId: sources[0].id,
                  maxWidth: 1,
                  maxHeight: 1,
                  maxFrameRate: 1,
                }
              } as any,
            })

            // Remove the dummy video track (we only need audio)
            systemStream.getVideoTracks().forEach(track => track.stop())

            // Also capture mic audio
            let micStream: MediaStream | null = null
            try {
              micStream = await navigator.mediaDevices.getUserMedia({ audio: true })
            } catch {
              console.log("Mic not available, using system audio only")
            }

            // Merge system audio + mic into one stream
            const audioContext = new AudioContext()
            const destination = audioContext.createMediaStreamDestination()

            const systemSource = audioContext.createMediaStreamSource(systemStream)
            systemSource.connect(destination)

            if (micStream) {
              const micSource = audioContext.createMediaStreamSource(micStream)
              micSource.connect(destination)
            }

            combinedStream = destination.stream
          } catch (err) {
            console.log("System audio capture failed, falling back to mic-only:", err)
            // Fallback to mic-only recording
            combinedStream = await navigator.mediaDevices.getUserMedia({ audio: true })
          }

          const deepgramApiKey = localStorage.getItem("deepgram_api_key")
          const targetLanguage = localStorage.getItem("translation_target_lang")

          // Buffer for audio chunks that arrive before WS is open
          const pendingChunks: Blob[] = [];
          let wsReady = false;

          // Initialize Deepgram WebSocket if we have an API key
          if (deepgramApiKey) {
            try {
              setDeepgramStatus("connecting")
              setDeepgramError("")

              // Build websocket URL
              let wsUrl = `wss://api.deepgram.com/v1/listen?model=nova-3&punctuate=true&interim_results=true&smart_format=true`;
              if (targetLanguage) {
                wsUrl += `&translate=${targetLanguage}`;
              }

              const socket = new WebSocket(wsUrl, ['token', deepgramApiKey]);

              socket.onopen = () => {
                console.log('[Deepgram] WebSocket connected, flushing', pendingChunks.length, 'buffered chunks');
                setDeepgramStatus("connected");
                wsReady = true;

                // Flush any buffered audio chunks (including the critical WebM header!)
                for (const chunk of pendingChunks) {
                  socket.send(chunk);
                }
                pendingChunks.length = 0;
              };

              socket.onmessage = (message) => {
                const received = JSON.parse(message.data);

                if (received.channel && received.channel.alternatives && received.channel.alternatives[0]) {
                  const transcript = received.channel.alternatives[0].transcript;
                  const translated = received.channel.alternatives[0].translations?.[0]?.translation;

                  // Display translation if requested, otherwise original transcript
                  const displayText = targetLanguage ? (translated || transcript) : transcript;

                  if (displayText) {
                    if (received.is_final) {
                      setLiveTranscript(prev => ({
                        final: prev.final + displayText + ' ',
                        interim: ''
                      }));
                    } else {
                      setLiveTranscript(prev => ({
                        ...prev,
                        interim: displayText
                      }));
                    }
                  }
                }
              };

              socket.onerror = (error) => {
                console.error('[Deepgram] WebSocket Error:', error);
                setDeepgramStatus("error");
                setDeepgramError("WebSocket connection failed.");
              };

              socket.onclose = (event) => {
                console.log('[Deepgram] WebSocket closed. Code:', event.code, 'Reason:', event.reason);
                setDeepgramStatus("disconnected");
              };

              deepgramSocketRef.current = socket;
              setLiveTranscript({ final: '', interim: '' });
            } catch (e) {
              console.error("[Deepgram] Failed to connect:", e);
              setDeepgramStatus("error")
              setDeepgramError(String(e))
            }
          } else {
            console.log("No Deepgram API key found, skipping live STT")
          }

          // Deepgram prefers specifically Opus encoding for webm
          let mimeType = 'audio/webm';
          if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
            mimeType = 'audio/webm;codecs=opus';
          }

          // Use a smaller timeslice (250ms) to stream chunks to Deepgram quickly
          const recorder = new MediaRecorder(combinedStream, { mimeType })

          recorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
              chunks.current.push(e.data)

              // Buffer or send to Deepgram
              if (deepgramSocketRef.current) {
                if (wsReady && deepgramSocketRef.current.readyState === WebSocket.OPEN) {
                  deepgramSocketRef.current.send(e.data);
                } else {
                  // WebSocket not open yet — buffer the chunk (including the critical WebM header!)
                  pendingChunks.push(e.data);
                }
              }
            }
          }

          recorder.onstop = async () => {
            const recordingDuration = Date.now() - recordingStartTimeRef.current;
            console.log('[Recording] Stopped. Duration:', recordingDuration, 'ms');

            const blob = new Blob(chunks.current, { type: chunks.current[0]?.type || 'audio/webm' })
            chunks.current = []

            // Stop all tracks to release resources
            combinedStream.getTracks().forEach(track => track.stop())

            // Close Deepgram socket
            if (deepgramSocketRef.current) {
              deepgramSocketRef.current.close();
              deepgramSocketRef.current = null;
            }

            // Only send to Gemini if the recording was at least 1 second
            // This prevents micro-recordings from duplicate toggles from spamming the API
            if (recordingDuration < 1000) {
              console.log('[Recording] Too short, skipping Gemini analysis');
              return;
            }

            const reader = new FileReader()
            reader.onloadend = async () => {
              const base64Data = (reader.result as string).split(',')[1]
              let cleanupStream = () => { };
              try {
                setAudioResult('')

                setLiveTranscript(prev => {
                  const fullText = prev.final.trim();

                  if (fullText) {
                    // We already have the full text from Deepgram, just pass it to Gemini instead of the raw audio bytes!
                    // To do this, we re-use the LLM chat pipeline but feed it the Deepgram transcript.
                    cleanupStream = window.electronAPI.onChatStream((chunk: string) => {
                      setAudioResult(current => (current || '') + chunk)
                    });

                    window.electronAPI.invoke("gemini-chat-stream", `Please answer or respond to the following transcribed audio: "${fullText}"`).catch(err => {
                      console.error(err);
                      setAudioResult('Gemini analysis failed.');
                    });

                  } else {
                    // Fallback to uploading the entire raw audio file to Gemini if Deepgram wasn't configured or failed
                    cleanupStream = window.electronAPI.onAudioStream((chunk: string) => {
                      setAudioResult(prev => (prev || '') + chunk)
                    })
                    window.electronAPI.analyzeAudioFromBase64Stream(base64Data, blob.type).catch(err => {
                      console.error(err);
                      setAudioResult('Audio analysis failed.');
                    })
                  }

                  return prev;
                });

              } catch (err) {
                setAudioResult('Audio analysis failed.')
              } finally {
                setTimeout(() => cleanupStream(), 100);
              }
            }
            reader.readAsDataURL(blob)
          }

          setMediaRecorder(recorder)
          recorder.start(250)
          console.log('[Recording] MediaRecorder started with 250ms timeslice');

        } catch (err) {
          // If start failed, unlock
          console.error('[Recording] Failed to start:', err);
          isRecordingRef.current = false;
          setIsRecording(false);
          setAudioResult('Could not start recording.')
        }
      } else {
        // ============ STOP RECORDING ============
        console.log('[Recording] Stopping...');
        mediaRecorder?.stop()
        setIsRecording(false)
        isRecordingRef.current = false;
        setMediaRecorder(null)
      }
    } finally {
      // Release the mutex
      isTogglingRef.current = false;
    }
  }

  // Listen for Ctrl+Shift+R shortcut from main process
  const toggleRecordingRef = useRef(toggleRecording)
  useEffect(() => {
    toggleRecordingRef.current = toggleRecording
  })

  useEffect(() => {
    const cleanup = window.electronAPI.onToggleRecording(() => {
      toggleRecordingRef.current()
    })
    return cleanup
  }, [])

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
                className="bg-white/100 hover:bg-white/20 transition-colors rounded-md px-1.5 py-1 text-[11px] leading-none text-black/70"
              >
                ⌘
              </button>
              <button
                onClick={() => window.electronAPI.processScreenshots()}
                className="bg-white/100 hover:bg-white/20 transition-colors rounded-md px-1.5 py-1 text-[11px] leading-none text-black/70"
              >
                ↵
              </button>
            </div>
          </div>
        )}

        {/* Voice Recording Button */}
        <div className="flex items-center gap-2">
          <button
            className={`bg-white/100 hover:bg-white/20 transition-colors rounded-md px-2 py-1 text-[11px] leading-none text-black/70 flex items-center gap-1 ${isRecording ? 'bg-red-500/70 hover:bg-red-500/90 text-white/100' : ''}`}
            onClick={toggleRecording}
            type="button"
            title="Toggle recording (Ctrl+Shift+R)"
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
              className="absolute bottom-full right-0 mb-2 w-80 z-20"
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
                            ⌘
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
                            ⌘
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
                            ⌘
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
          className="text-red-500/70 hover:text-red-500/90 transition-colors hover:cursor-pointer"
          title="Sign Out"
          onClick={() => window.electronAPI.quitApp()}
        >
          <IoLogOutOutline className="w-4 h-4" />
        </button>
      </div>

      {/* Live Transcription Display */}
      {isRecording && (
        <div className="w-full flex justify-start mt-3 px-4 flex-col gap-1">
          {deepgramStatus === "connecting" && (
            <div className="text-[10px] text-white/50 px-2">Connecting to Deepgram...</div>
          )}
          {deepgramStatus === "error" && (
            <div className="text-[10px] text-red-500/80 px-2 flex flex-col">
              <span>Deepgram Connection Error. Falling back to Gemini full-audio upload.</span>
              <span>{deepgramError}</span>
            </div>
          )}

          {(liveTranscript.final || liveTranscript.interim) && (
            <div
              className="max-w-[85%] px-3 py-2 rounded-xl text-xs shadow-md backdrop-blur-sm border bg-black/90 text-white border-black/80"
              style={{ wordBreak: "break-word", lineHeight: "1.4" }}
            >
              <span className="font-semibold block mb-1 text-red-400 animate-pulse">
                Live Transcription {localStorage.getItem("translation_target_lang") ? "(Translating)" : ""}...
              </span>
              <span>{liveTranscript.final}</span>
              <span className="text-white/60">{liveTranscript.interim}</span>
            </div>
          )}
        </div>
      )}

      {/* Audio Result Display */}
      {audioResult && (
        <div className="w-full flex justify-start mt-3 px-4">
          <div
            className="max-w-[85%] px-3 py-2 rounded-xl text-xs shadow-md backdrop-blur-sm border bg-black/90 text-white border-black/80"
            style={{ wordBreak: "break-word", lineHeight: "1.4" }}
          >
            <span className="font-semibold block mb-1">Audio Result:</span>
            <span dangerouslySetInnerHTML={{ __html: simpleMarkdown(audioResult) }} />
          </div>
        </div>
      )}
      {/* Chat Dialog Overlay */}
      {/* Remove the Dialog component */}
    </div>
  )
}

export default QueueCommands
