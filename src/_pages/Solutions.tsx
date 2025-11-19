// Solutions.tsx
import React, { useState, useEffect, useRef } from "react"
import { useQuery, useQueryClient } from "react-query"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { dracula } from "react-syntax-highlighter/dist/esm/styles/prism"
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'

import ScreenshotQueue from "../components/Queue/ScreenshotQueue"
import {
  Toast,
  ToastDescription,
  ToastMessage,
  ToastTitle,
  ToastVariant
} from "../components/ui/toast"
import { ProblemStatementData } from "../types/solutions"
import { AudioResult } from "../types/audio"
import SolutionCommands from "../components/Solutions/SolutionCommands"
import Debug from "./Debug"

// (Using global ElectronAPI type from src/types/electron.d.ts)

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

export const ContentSection = ({
  title,
  content,
  isLoading
}: {
  title: string
  content: React.ReactNode
  isLoading: boolean
}) => (
  <div className="space-y-2">
    <h2 className="text-[13px] font-medium text-white tracking-wide">
      {title}
    </h2>
    {isLoading ? (
      <div className="mt-4 flex">
        <p className="text-xs bg-gradient-to-r from-gray-300 via-gray-100 to-gray-300 bg-clip-text text-transparent animate-pulse">
          Extracting problem statement...
        </p>
      </div>
    ) : (
      <div className="text-[13px] leading-[1.4] text-gray-100 max-w-[600px]">
        {typeof content === 'string' && title === 'Audio Result'
          ? formatText(content)
          : content}
      </div>
    )}
  </div>
)
const SolutionSection = ({
  title,
  content,
  isLoading
}: {
  title: string
  content: React.ReactNode
  isLoading: boolean
}) => (
  <div className="space-y-2">
    <h2 className="text-[13px] font-medium text-white tracking-wide">
      {title}
    </h2>
    {isLoading ? (
      <div className="space-y-1.5">
        <div className="mt-4 flex">
          <p className="text-xs bg-gradient-to-r from-gray-300 via-gray-100 to-gray-300 bg-clip-text text-transparent animate-pulse">
            Loading solutions...
          </p>
        </div>
      </div>
    ) : (
      <div className="w-full">
        <SyntaxHighlighter
          showLineNumbers
          language="python"
          style={dracula}
          customStyle={{
            maxWidth: "100%",
            margin: 0,
            padding: "1rem",
            whiteSpace: "pre-wrap",
            wordBreak: "break-all"
          }}
          wrapLongLines={true}
        >
          {content as string}
        </SyntaxHighlighter>
      </div>
    )}
  </div>
)

export const ComplexitySection = ({
  timeComplexity,
  spaceComplexity,
  isLoading
}: {
  timeComplexity: string | null
  spaceComplexity: string | null
  isLoading: boolean
}) => (
  <div className="space-y-2">
    <h2 className="text-[13px] font-medium text-white tracking-wide">
      Complexity (Updated)
    </h2>
    {isLoading ? (
      <p className="text-xs bg-gradient-to-r from-gray-300 via-gray-100 to-gray-300 bg-clip-text text-transparent animate-pulse">
        Calculating complexity...
      </p>
    ) : (
      <div className="space-y-1">
        <div className="flex items-start gap-2 text-[13px] leading-[1.4] text-gray-100">
          <div className="w-1 h-1 rounded-full bg-blue-400/80 mt-2 shrink-0" />
          <div>
            <strong>Time:</strong> {timeComplexity}
          </div>
        </div>
        <div className="flex items-start gap-2 text-[13px] leading-[1.4] text-gray-100">
          <div className="w-1 h-1 rounded-full bg-blue-400/80 mt-2 shrink-0" />
          <div>
            <strong>Space:</strong> {spaceComplexity}
          </div>
        </div>
      </div>
    )}
  </div>
)

interface SolutionsProps {
  setView: React.Dispatch<React.SetStateAction<"queue" | "solutions" | "debug">>
}
const Solutions: React.FC<SolutionsProps> = ({ setView }) => {
  const queryClient = useQueryClient()
  const contentRef = useRef<HTMLDivElement>(null)

  // Audio recording state
  const [audioRecording, setAudioRecording] = useState(false)
  const [audioResult, setAudioResult] = useState<AudioResult | null>(null)

  const [debugProcessing, setDebugProcessing] = useState(false)
  const [problemStatementData, setProblemStatementData] =
    useState<ProblemStatementData | null>(null)
  const [solutionData, setSolutionData] = useState<string | null>(null)
  const [thoughtsData, setThoughtsData] = useState<string[] | null>(null)
  const [timeComplexityData, setTimeComplexityData] = useState<string | null>(
    null
  )
  const [spaceComplexityData, setSpaceComplexityData] = useState<string | null>(
    null
  )
  const [customContent, setCustomContent] = useState<string | null>(null)

  const [toastOpen, setToastOpen] = useState(false)
  const [toastMessage, setToastMessage] = useState<ToastMessage>({
    title: "",
    description: "",
    variant: "neutral"
  })

  const [isTooltipVisible, setIsTooltipVisible] = useState(false)
  const [tooltipHeight, setTooltipHeight] = useState(0)

  const [isResetting, setIsResetting] = useState(false)

  const { data: extraScreenshots = [], refetch } = useQuery<Array<{ path: string; preview: string }>, Error>(
    ["extras"],
    async () => {
      try {
        const existing = await window.electronAPI.getScreenshots()
        return existing
      } catch (error) {
        console.error("Error loading extra screenshots:", error)
        return []
      }
    },
    {
      staleTime: Infinity,
      cacheTime: Infinity
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

  const handleDeleteExtraScreenshot = async (index: number) => {
    const screenshotToDelete = extraScreenshots[index]

    try {
      const response = await window.electronAPI.deleteScreenshot(
        screenshotToDelete.path
      )

      if (response.success) {
        refetch() // Refetch screenshots instead of managing state directly
      } else {
        console.error("Failed to delete extra screenshot:", response.error)
      }
    } catch (error) {
      console.error("Error deleting extra screenshot:", error)
    }
  }

  useEffect(() => {
    // Height update logic
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

    // Initialize resize observer
    const resizeObserver = new ResizeObserver(updateDimensions)
    if (contentRef.current) {
      resizeObserver.observe(contentRef.current)
    }
    updateDimensions()

    // Set up event listeners
    const cleanupFunctions = [
      window.electronAPI.onScreenshotTaken(() => refetch()),
      window.electronAPI.onResetView(() => {
        // Set resetting state first
        setIsResetting(true)

        // Clear the queries
        queryClient.removeQueries(["solution"])
        queryClient.removeQueries(["new_solution"])

        // Reset other states
        refetch()

        // After a small delay, clear the resetting state
        setTimeout(() => {
          setIsResetting(false)
        }, 0)
      }),
      window.electronAPI.onSolutionStart(async () => {
        // Reset UI state for a new solution
        setSolutionData(null)
        setThoughtsData(null)
        setTimeComplexityData(null)
        setSpaceComplexityData(null)
        setCustomContent(null)
        setAudioResult(null)

        // Start audio recording from user's microphone
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
          const mediaRecorder = new MediaRecorder(stream)
          const chunks: Blob[] = []
          mediaRecorder.ondataavailable = (e) => chunks.push(e.data)
          mediaRecorder.start()
          setAudioRecording(true)
          // Record for 5 seconds (or adjust as needed)
          setTimeout(() => mediaRecorder.stop(), 5000)
          mediaRecorder.onstop = async () => {
            setAudioRecording(false)
            const blob = new Blob(chunks, { type: chunks[0]?.type || 'audio/webm' })
            const reader = new FileReader()
            reader.onloadend = async () => {
              const base64Data = (reader.result as string).split(',')[1]
              // Send audio to Gemini for analysis
              try {
                const result = await window.electronAPI.analyzeAudioFromBase64(
                  base64Data,
                  blob.type
                )
                // Store result in react-query cache
                queryClient.setQueryData(["audio_result"], result)
                setAudioResult(result)
              } catch (err) {
                console.error('Audio analysis failed:', err)
              }
            }
            reader.readAsDataURL(blob)
          }
        } catch (err) {
          console.error('Audio recording error:', err)
        }

        // Simulate receiving custom content shortly after start
        setTimeout(() => {
          setCustomContent(
            "This is the dynamically generated content appearing after loading starts."
          )
        }, 1500) // Example delay
      }),
      //if there was an error processing the initial solution
      window.electronAPI.onSolutionError((error: string) => {
        showToast(
          "Processing Failed",
          "There was an error processing your extra screenshots.",
          "error"
        )
        // Reset solutions in the cache (even though this shouldn't ever happen) and complexities to previous states
        const solution = queryClient.getQueryData(["solution"]) as {
          code: string
          thoughts: string[]
          time_complexity: string
          space_complexity: string
        } | null
        if (!solution) {
          setView("queue") //make sure that this is correct. or like make sure there's a toast or something
        }
        setSolutionData(solution?.code || null)
        setThoughtsData(solution?.thoughts || null)
        setTimeComplexityData(solution?.time_complexity || null)
        setSpaceComplexityData(solution?.space_complexity || null)
        console.error("Processing error:", error)
      }),
      //when the initial solution is generated, we'll set the solution data to that
      window.electronAPI.onSolutionSuccess((data) => {
        if (!data?.solution) {
          console.warn("Received empty or invalid solution data")
          return
        }

        console.log({ solution: data.solution })

        const solutionData = {
          code: data.solution.code,
          thoughts: data.solution.thoughts,
          time_complexity: data.solution.time_complexity,
          space_complexity: data.solution.space_complexity
        }

        queryClient.setQueryData(["solution"], solutionData)
        setSolutionData(solutionData.code || null)
        setThoughtsData(solutionData.thoughts || null)
        setTimeComplexityData(solutionData.time_complexity || null)
        setSpaceComplexityData(solutionData.space_complexity || null)
      }),

      //########################################################
      //DEBUG EVENTS
      //########################################################
      window.electronAPI.onDebugStart(() => {
        //we'll set the debug processing state to true and use that to render a little loader
        setDebugProcessing(true)
      }),
      //the first time debugging works, we'll set the view to debug and populate the cache with the data
      window.electronAPI.onDebugSuccess((data) => {
        console.log({ debug_data: data })

        queryClient.setQueryData(["new_solution"], data.solution)
        setDebugProcessing(false)
      }),
      //when there was an error in the initial debugging, we'll show a toast and stop the little generating pulsing thing.
      window.electronAPI.onDebugError(() => {
        showToast(
          "Processing Failed",
          "There was an error debugging your code.",
          "error"
        )
        setDebugProcessing(false)
      }),
      window.electronAPI.onProcessingNoScreenshots(() => {
        showToast(
          "No Screenshots",
          "There are no extra screenshots to process.",
          "neutral"
        )
      })
    ]

    return () => {
      resizeObserver.disconnect()
      cleanupFunctions.forEach((cleanup) => cleanup())
    }
  }, [isTooltipVisible, tooltipHeight])

  useEffect(() => {
    setProblemStatementData(
      queryClient.getQueryData(["problem_statement"]) || null
    )
    setSolutionData(queryClient.getQueryData(["solution"]) || null)

    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event?.query.queryKey[0] === "problem_statement") {
        setProblemStatementData(
          queryClient.getQueryData(["problem_statement"]) || null
        )
        // If this is from audio processing, show it in the custom content section
        const audioResult = queryClient.getQueryData(["audio_result"]) as AudioResult | undefined;
        if (audioResult) {
          // Update all relevant sections when audio result is received
          setProblemStatementData({
            problem_statement: audioResult.text,
            input_format: {
              description: "Generated from audio input",
              parameters: []
            },
            output_format: {
              description: "Generated from audio input",
              type: "string",
              subtype: "text"
            },
            complexity: {
              time: "N/A",
              space: "N/A"
            },
            test_cases: [],
            validation_type: "manual",
            difficulty: "custom"
          });
          setSolutionData(null); // Reset solution to trigger loading state
          setThoughtsData(null);
          setTimeComplexityData(null);
          setSpaceComplexityData(null);
        }
      }
      if (event?.query.queryKey[0] === "solution") {
        const solution = queryClient.getQueryData(["solution"]) as {
          code: string
          thoughts: string[]
          time_complexity: string
          space_complexity: string
        } | null

        setSolutionData(solution?.code ?? null)
        setThoughtsData(solution?.thoughts ?? null)
        setTimeComplexityData(solution?.time_complexity ?? null)
        setSpaceComplexityData(solution?.space_complexity ?? null)
      }
    })
    return () => unsubscribe()
  }, [queryClient])

  const handleTooltipVisibilityChange = (visible: boolean, height: number) => {
    setIsTooltipVisible(visible)
    setTooltipHeight(height)
  }

  return (
    <>
      {!isResetting && queryClient.getQueryData(["new_solution"]) ? (
        <>
          <Debug
            isProcessing={debugProcessing}
            setIsProcessing={setDebugProcessing}
          />
        </>
      ) : (
        <div ref={contentRef} className="relative space-y-3 px-4 py-3">
          <Toast
            open={toastOpen}
            onOpenChange={setToastOpen}
            variant={toastMessage.variant}
            duration={3000}
          >
            <ToastTitle>{toastMessage.title}</ToastTitle>
            <ToastDescription>{toastMessage.description}</ToastDescription>
          </Toast>

          {/* Conditionally render the screenshot queue if solutionData is available */}
          {solutionData && (
            <div className="bg-transparent w-fit">
              <div className="pb-3">
                <div className="space-y-3 w-fit">
                  <ScreenshotQueue
                    isLoading={debugProcessing}
                    screenshots={extraScreenshots}
                    onDeleteScreenshot={handleDeleteExtraScreenshot}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Navbar of commands with the SolutionsHelper */}
          <SolutionCommands
            extraScreenshots={extraScreenshots}
            onTooltipVisibilityChange={handleTooltipVisibilityChange}
          />

          {/* Main Content - Modified width constraints */}
          <div className="w-full text-sm text-black bg-black/60 rounded-md">
            <div className="rounded-lg overflow-hidden">
              <div className="px-4 py-3 space-y-4 max-w-full">
                {/* Show Screenshot or Audio Result as main output if validation_type is manual */}
                {problemStatementData?.validation_type === "manual" ? (
                  <ContentSection
                    title={problemStatementData?.output_format?.subtype === "voice" ? "Audio Result" : "Screenshot Result"}
                    content={problemStatementData.problem_statement}
                    isLoading={false}
                  />
                ) : (
                  <>
                    {/* Problem Statement Section - Only for non-manual */}
                    <ContentSection
                      title={problemStatementData?.output_format?.subtype === "voice" ? "Voice Input" : "Problem Statement"}
                      content={problemStatementData?.problem_statement}
                      isLoading={!problemStatementData}
                    />
                    {/* Show loading state when waiting for solution */}
                    {problemStatementData && !solutionData && (
                      <div className="mt-4 flex">
                        <p className="text-xs bg-gradient-to-r from-gray-300 via-gray-100 to-gray-300 bg-clip-text text-transparent animate-pulse">
                          {problemStatementData?.output_format?.subtype === "voice" 
                            ? "Processing voice input..." 
                            : "Generating solutions..."}
                        </p>
                      </div>
                    )}
                    {/* Solution Sections (legacy, only for non-manual) */}
                    {solutionData && (
                      <>
                        <ContentSection
                          title="Analysis"
                          content={
                            thoughtsData && (
                              <div className="space-y-3">
                                <div className="space-y-1">
                                  {thoughtsData.map((thought, index) => (
                                    <div
                                      key={index}
                                      className="flex items-start gap-2"
                                    >
                                      <div className="w-1 h-1 rounded-full bg-blue-400/80 mt-2 shrink-0" />
                                      <div>{thought}</div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )
                          }
                          isLoading={!thoughtsData}
                        />
                        <SolutionSection
                          title={problemStatementData?.output_format?.subtype === "voice" ? "Response" : "Solution"}
                          content={solutionData}
                          isLoading={!solutionData}
                        />
                        {problemStatementData?.output_format?.subtype !== "voice" && (
                          <ComplexitySection
                            timeComplexity={timeComplexityData}
                            spaceComplexity={spaceComplexityData}
                            isLoading={!timeComplexityData || !spaceComplexityData}
                          />
                        )}
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default Solutions
