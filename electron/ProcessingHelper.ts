// ProcessingHelper.ts

import { app } from "electron"
import { AppState } from "./main"
import { LLMHelper } from "./LLMHelper"
import fs from "fs"
import path from "path"
import dotenv from "dotenv"

dotenv.config({ path: path.join(app.getAppPath(), '.env') })
dotenv.config()

const isDev = process.env.NODE_ENV === "development"
const isDevTest = process.env.IS_DEV_TEST === "true"
const MOCK_API_WAIT_TIME = Number(process.env.MOCK_API_WAIT_TIME) || 500
const DEFAULT_GEMINI_MODEL = process.env.MODEL_GEMINI || process.env.GEMINI_MODEL || "gemini-3.5-flash-lite"
const DEFAULT_GROQ_MODEL = process.env.MODEL_GROQ || "qwen/qwen3-coder"
const DEFAULT_PROVIDER: "groq" | "gemini" = (process.env.PRIMARY_AI_PROVIDER as "groq" | "gemini") || "groq"
const DEFAULT_FALLBACK_PROVIDER: "groq" | "gemini" = (process.env.FALLBACK_AI_PROVIDER as "groq" | "gemini") || "gemini"

interface SolutionResponse {
  solution: {
    code: string
  }
}

interface PersistedLLMConfig {
  provider?: "groq" | "gemini" | "ollama"
  primaryProvider?: "groq" | "gemini"
  fallbackProvider?: "groq" | "gemini"
  groqApiKey?: string
  groqModel?: string
  geminiApiKey?: string
  geminiModel?: string
  useOllama?: boolean
  ollamaModel?: string
  ollamaUrl?: string
}

export class ProcessingHelper {
  private appState: AppState
  private llmHelper: LLMHelper
  private currentProcessingAbortController: AbortController | null = null
  private currentExtraProcessingAbortController: AbortController | null = null
  private readonly llmConfigPath = path.join(app.getPath("userData"), "llm-config.json")
  private persistedLLMConfig: PersistedLLMConfig = {}

  constructor(appState: AppState) {
    this.appState = appState
    this.persistedLLMConfig = this.loadPersistedLLMConfig()
    
    // Check if user wants to use Ollama
    const useOllama = process.env.USE_OLLAMA === "true" || this.persistedLLMConfig.useOllama === true
    const ollamaModel = process.env.OLLAMA_MODEL || this.persistedLLMConfig.ollamaModel // Don't set default here, let LLMHelper auto-detect
    const ollamaUrl = process.env.OLLAMA_URL || this.persistedLLMConfig.ollamaUrl || "http://localhost:11434"
    const geminiModel = process.env.MODEL_GEMINI || process.env.GEMINI_MODEL || this.persistedLLMConfig.geminiModel || DEFAULT_GEMINI_MODEL
    const groqModel = process.env.MODEL_GROQ || this.persistedLLMConfig.groqModel || DEFAULT_GROQ_MODEL
    const primaryProvider = this.persistedLLMConfig.primaryProvider || DEFAULT_PROVIDER
    const fallbackProvider = this.persistedLLMConfig.fallbackProvider || DEFAULT_FALLBACK_PROVIDER
    
    if (useOllama) {
      console.log("[ProcessingHelper] Initializing with Ollama")
      this.llmHelper = new LLMHelper(undefined, true, ollamaModel, ollamaUrl)
    } else {
      const groqApiKey = process.env.GROQ_API_KEY || this.persistedLLMConfig.groqApiKey
      const geminiApiKey = process.env.GEMINI_API_KEY || this.persistedLLMConfig.geminiApiKey
      if (groqApiKey || geminiApiKey) {
        console.log(`[ProcessingHelper] Initializing with AI provider=${primaryProvider}, fallback=${fallbackProvider}, groqModel=${groqModel}, geminiModel=${geminiModel}`)
      } else {
        console.warn(
          `[ProcessingHelper] No AI API key found. Groq will be primary and Gemini fallback will stay inactive until configured. Groq model: ${groqModel}, Gemini model: ${geminiModel}`
        )
      }
      this.llmHelper = new LLMHelper(
        geminiApiKey || undefined,
        false,
        undefined,
        undefined,
        geminiModel,
        {
          groqApiKey,
          geminiApiKey,
          primaryProvider,
          fallbackProvider
        }
      )
    }
  }

  private loadPersistedLLMConfig(): PersistedLLMConfig {
    try {
      if (!fs.existsSync(this.llmConfigPath)) {
        return {}
      }

      const raw = fs.readFileSync(this.llmConfigPath, "utf-8")
      return JSON.parse(raw) as PersistedLLMConfig
    } catch (error) {
      console.warn("[ProcessingHelper] Failed to load persisted LLM config:", error)
      return {}
    }
  }

  private savePersistedLLMConfig(): void {
    try {
      fs.writeFileSync(this.llmConfigPath, JSON.stringify(this.persistedLLMConfig, null, 2), "utf-8")
    } catch (error) {
      console.warn("[ProcessingHelper] Failed to save persisted LLM config:", error)
    }
  }

  public async switchToGemini(apiKey?: string): Promise<void> {
    await this.llmHelper.switchToGemini(apiKey)
    this.persistedLLMConfig.useOllama = false
    this.persistedLLMConfig.provider = "gemini"
    this.persistedLLMConfig.primaryProvider = "gemini"
    this.persistedLLMConfig.fallbackProvider = "groq"
    this.persistedLLMConfig.geminiModel = this.llmHelper.getCurrentModel()
    if (apiKey) {
      this.persistedLLMConfig.geminiApiKey = apiKey
    }
    this.savePersistedLLMConfig()
  }

  public async switchToGroq(apiKey?: string): Promise<void> {
    await this.llmHelper.switchToGroq(apiKey)
    this.persistedLLMConfig.useOllama = false
    this.persistedLLMConfig.provider = "groq"
    this.persistedLLMConfig.primaryProvider = "groq"
    this.persistedLLMConfig.fallbackProvider = "gemini"
    this.persistedLLMConfig.groqModel = this.llmHelper.getCurrentModel()
    if (apiKey) {
      this.persistedLLMConfig.groqApiKey = apiKey
    }
    this.savePersistedLLMConfig()
  }

  public async switchToOllama(model?: string, url?: string): Promise<void> {
    await this.llmHelper.switchToOllama(model, url)
    this.persistedLLMConfig.useOllama = true
    this.persistedLLMConfig.provider = "ollama"
    this.persistedLLMConfig.ollamaModel = this.llmHelper.getCurrentModel()
    this.persistedLLMConfig.ollamaUrl = url || this.persistedLLMConfig.ollamaUrl || "http://localhost:11434"
    this.savePersistedLLMConfig()
  }

  public async processScreenshots(): Promise<void> {
    const mainWindow = this.appState.getMainWindow()
    if (!mainWindow) return

    const view = this.appState.getView()

    if (view === "queue") {
      const screenshotQueue = this.appState.getScreenshotHelper().getScreenshotQueue()
      if (screenshotQueue.length === 0) {
        mainWindow.webContents.send(this.appState.PROCESSING_EVENTS.NO_SCREENSHOTS)
        return
      }

      // Check if last screenshot is an audio file
      const allPaths = this.appState.getScreenshotHelper().getScreenshotQueue();
      const lastPath = allPaths[allPaths.length - 1];
      if (lastPath.endsWith('.mp3') || lastPath.endsWith('.wav')) {
        mainWindow.webContents.send(this.appState.PROCESSING_EVENTS.INITIAL_START);
        this.appState.setView('solutions');
        try {
          const audioResult = await this.llmHelper.analyzeAudioFile(lastPath);
          mainWindow.webContents.send(this.appState.PROCESSING_EVENTS.PROBLEM_EXTRACTED, audioResult);
          this.appState.setProblemInfo({ problem_statement: audioResult.text, input_format: {}, output_format: {}, constraints: [], test_cases: [] });
          return;
        } catch (err: any) {
          console.error('Audio processing error:', err);
          mainWindow.webContents.send(this.appState.PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR, err.message);
          return;
        }
      }

      // NEW: Handle screenshot as plain text (like audio)
      mainWindow.webContents.send(this.appState.PROCESSING_EVENTS.INITIAL_START)
      this.appState.setView("solutions")
      this.currentProcessingAbortController = new AbortController()
      try {
        const imageResult = await this.llmHelper.analyzeImageFile(lastPath);
        const problemInfo = {
          problem_statement: imageResult.text,
          input_format: { description: "Generated from screenshot", parameters: [] as any[] },
          output_format: { description: "Generated from screenshot", type: "string", subtype: "text" },
          complexity: { time: "N/A", space: "N/A" },
          test_cases: [] as any[],
          validation_type: "manual",
          difficulty: "custom"
        };
        mainWindow.webContents.send(this.appState.PROCESSING_EVENTS.PROBLEM_EXTRACTED, problemInfo);
        this.appState.setProblemInfo(problemInfo);
      } catch (error: any) {
        console.error("Image processing error:", error)
        mainWindow.webContents.send(this.appState.PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR, error.message)
      } finally {
        this.currentProcessingAbortController = null
      }
      return;
    } else {
      // Debug mode
      const extraScreenshotQueue = this.appState.getScreenshotHelper().getExtraScreenshotQueue()
      if (extraScreenshotQueue.length === 0) {
        console.log("No extra screenshots to process")
        mainWindow.webContents.send(this.appState.PROCESSING_EVENTS.NO_SCREENSHOTS)
        return
      }

      mainWindow.webContents.send(this.appState.PROCESSING_EVENTS.DEBUG_START)
      this.currentExtraProcessingAbortController = new AbortController()

      try {
        // Get problem info and current solution
        const problemInfo = this.appState.getProblemInfo()
        if (!problemInfo) {
          throw new Error("No problem info available")
        }

        // Get current solution from state
        const currentSolution = await this.llmHelper.generateSolution(problemInfo) as SolutionResponse
        const currentCode = currentSolution.solution.code

        // Debug the solution using vision model
        const debugResult = await this.llmHelper.debugSolutionWithImages(
          problemInfo,
          currentCode,
          extraScreenshotQueue
        )

        this.appState.setHasDebugged(true)
        mainWindow.webContents.send(
          this.appState.PROCESSING_EVENTS.DEBUG_SUCCESS,
          debugResult
        )

      } catch (error: any) {
        console.error("Debug processing error:", error)
        mainWindow.webContents.send(
          this.appState.PROCESSING_EVENTS.DEBUG_ERROR,
          error.message
        )
      } finally {
        this.currentExtraProcessingAbortController = null
      }
    }
  }

  public cancelOngoingRequests(): void {
    if (this.currentProcessingAbortController) {
      this.currentProcessingAbortController.abort()
      this.currentProcessingAbortController = null
    }

    if (this.currentExtraProcessingAbortController) {
      this.currentExtraProcessingAbortController.abort()
      this.currentExtraProcessingAbortController = null
    }

    this.appState.setHasDebugged(false)
  }

  public async processAudioBase64(data: string, mimeType: string) {
    // Directly use LLMHelper to analyze inline base64 audio
    return this.llmHelper.analyzeAudioFromBase64(data, mimeType);
  }

  // Add audio file processing method
  public async processAudioFile(filePath: string) {
    return this.llmHelper.analyzeAudioFile(filePath);
  }

  public getLLMHelper() {
    return this.llmHelper;
  }
}
