import fs from "fs"
import { GeminiProvider } from "./providers/gemini"
import { GroqProvider } from "./providers/groq"
import { AIInputAttachment, AIProviderName, AIRequest, AIResult } from "./ai/types"
import { ProviderManager } from "./ai/providerManager"
import { parseJsonResponse } from "./ai/responseParser"

const DEFAULT_GROQ_MODEL = process.env.MODEL_GROQ || "qwen/qwen3-coder"
const GROQ_MODEL_FALLBACK_1 = process.env.MODEL_GROQ_FALLBACK_1 || "llama-3.3-70b-versatile"
const GROQ_MODEL_FALLBACK_2 = process.env.MODEL_GROQ_FALLBACK_2 || "kimi-k2"
const DEFAULT_GEMINI_MODEL = process.env.MODEL_GEMINI || "gemini-3.5-flash-lite"
const DEFAULT_TIMEOUT_MS = Number(process.env.TIMEOUT_MS) || 30000
const DEFAULT_PRIMARY_PROVIDER: AIProviderName = (process.env.PRIMARY_AI_PROVIDER as AIProviderName) || "groq"
const DEFAULT_FALLBACK_PROVIDER: AIProviderName = (process.env.FALLBACK_AI_PROVIDER as AIProviderName) || "gemini"

interface OllamaResponse {
  response: string
  done: boolean
}

export class LLMHelper {
  private readonly systemPrompt = `You are Wingman AI, a helpful, proactive assistant for any kind of problem or situation (not just coding). For any user input, analyze the situation, provide a clear problem statement, relevant context, and suggest several possible responses or actions the user could take next. Always explain your reasoning. Present your suggestions as a list of options or next steps.`
  private useOllama = false
  private ollamaModel = "llama3.2"
  private ollamaUrl = "http://localhost:11434"
  private groqApiKey: string | null = process.env.GROQ_API_KEY || null
  private geminiApiKey: string | null = process.env.GEMINI_API_KEY || null
  private groqModelCandidates = [DEFAULT_GROQ_MODEL, GROQ_MODEL_FALLBACK_1, GROQ_MODEL_FALLBACK_2]
  private geminiModelName = DEFAULT_GEMINI_MODEL
  private primaryProvider: AIProviderName = DEFAULT_PRIMARY_PROVIDER
  private fallbackProvider: AIProviderName = DEFAULT_FALLBACK_PROVIDER
  private providerManager: ProviderManager | null = null

  constructor(
    apiKey?: string,
    useOllama = false,
    ollamaModel?: string,
    ollamaUrl?: string,
    geminiModel?: string,
    config?: {
      groqApiKey?: string
      geminiApiKey?: string
      primaryProvider?: AIProviderName
      fallbackProvider?: AIProviderName
    }
  ) {
    this.useOllama = useOllama
    this.ollamaUrl = ollamaUrl || "http://localhost:11434"
    this.ollamaModel = ollamaModel || "gemma:latest"

    if (config?.groqApiKey) {
      this.groqApiKey = config.groqApiKey
    }

    if (config?.geminiApiKey) {
      this.geminiApiKey = config.geminiApiKey
    }

    if (config?.primaryProvider) {
      this.primaryProvider = config.primaryProvider
    }

    if (config?.fallbackProvider) {
      this.fallbackProvider = config.fallbackProvider
    }

    if (apiKey) {
      this.geminiApiKey = apiKey
    }

    if (geminiModel) {
      this.geminiModelName = geminiModel
    }

    this.rebuildProviderManager()

    if (this.useOllama) {
      console.log(`[LLMHelper] Using Ollama with model: ${this.ollamaModel}`)
      this.initializeOllamaModel()
      return
    }

    console.log(
      `[LLMHelper] Using AI pipeline: primary=${this.primaryProvider}, fallback=${this.fallbackProvider}, groqModel=${this.groqModelCandidates[0]}, geminiModel=${this.geminiModelName}`
    )
  }

  private rebuildProviderManager(): void {
    const groqProvider = this.groqApiKey
      ? new GroqProvider(this.groqApiKey, {
          modelCandidates: this.groqModelCandidates,
          timeoutMs: DEFAULT_TIMEOUT_MS
        })
      : null

    const geminiProvider = this.geminiApiKey
      ? new GeminiProvider(this.geminiApiKey, { modelName: this.geminiModelName })
      : null

    this.providerManager = new ProviderManager({
      primaryProvider: this.primaryProvider,
      fallbackProvider: this.fallbackProvider,
      groq: groqProvider,
      gemini: geminiProvider,
      timeoutMs: DEFAULT_TIMEOUT_MS
    })
  }

  private getProviderManager(): ProviderManager {
    if (!this.providerManager) {
      this.rebuildProviderManager()
    }

    return this.providerManager as ProviderManager
  }

  private async fileToGenerativePart(filePath: string): Promise<AIInputAttachment> {
    const fileData = await fs.promises.readFile(filePath)
    const mimeType = filePath.endsWith(".mp3")
      ? "audio/mp3"
      : filePath.endsWith(".wav")
        ? "audio/wav"
        : "image/png"

    return {
      kind: mimeType.startsWith("audio/") ? "audio" : "image",
      data: fileData.toString("base64"),
      mimeType
    }
  }

  private async callOllama(prompt: string): Promise<string> {
    try {
      const response = await fetch(`${this.ollamaUrl}/api/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: this.ollamaModel,
          prompt,
          stream: false,
          options: {
            temperature: 0.7,
            top_p: 0.9
          }
        })
      })

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`)
      }

      const data: OllamaResponse = await response.json()
      return data.response
    } catch (error: any) {
      console.error("[LLMHelper] Error calling Ollama:", error)
      throw new Error(`Failed to connect to Ollama: ${error.message}. Make sure Ollama is running on ${this.ollamaUrl}`)
    }
  }

  private async initializeOllamaModel(): Promise<void> {
    try {
      const availableModels = await this.getOllamaModels()
      if (availableModels.length === 0) {
        console.warn("[LLMHelper] No Ollama models found")
        return
      }

      if (!availableModels.includes(this.ollamaModel)) {
        this.ollamaModel = availableModels[0]
        console.log(`[LLMHelper] Auto-selected first available model: ${this.ollamaModel}`)
      }

      await this.callOllama("Hello")
      console.log(`[LLMHelper] Successfully initialized with model: ${this.ollamaModel}`)
    } catch (error: any) {
      console.error(`[LLMHelper] Failed to initialize Ollama model: ${error.message}`)
      try {
        const models = await this.getOllamaModels()
        if (models.length > 0) {
          this.ollamaModel = models[0]
          console.log(`[LLMHelper] Fallback to: ${this.ollamaModel}`)
        }
      } catch (fallbackError: any) {
        console.error(`[LLMHelper] Fallback also failed: ${fallbackError.message}`)
      }
    }
  }

  private createTextRequest(prompt: string, systemPrompt?: string): AIRequest {
    return { prompt, systemPrompt, format: "text" }
  }

  private createAttachmentRequest(prompt: string, attachments: AIInputAttachment[], systemPrompt?: string): AIRequest {
    return { prompt, systemPrompt, attachments, format: "text" }
  }

  private async generateWithProviders(request: AIRequest, validate?: (text: string) => void): Promise<AIResult> {
    if (this.useOllama) {
      const text = await this.callOllama(`${request.systemPrompt ? `${request.systemPrompt}\n\n` : ""}${request.prompt}`)
      return {
        text,
        provider: "ollama",
        model: this.ollamaModel,
        latencyMs: 0
      }
    }

    const result = await this.getProviderManager().generate(request, { timeoutMs: DEFAULT_TIMEOUT_MS, validate })
    return result
  }

  private async generateText(request: AIRequest): Promise<AIResult> {
    return this.generateWithProviders(request)
  }

  public async extractProblemFromImages(imagePaths: string[]) {
    try {
      const imageParts = await Promise.all(imagePaths.map((path) => this.fileToGenerativePart(path)))
      const prompt = `${this.systemPrompt}\n\nYou are a wingman. Please analyze these images and extract the following information in JSON format:\n{
  "problem_statement": "A clear statement of the problem or situation depicted in the images.",
  "context": "Relevant background or context from the images.",
  "suggested_responses": ["First possible answer or action", "Second possible answer or action", "..."],
  "reasoning": "Explanation of why these suggestions are appropriate."
}\nImportant: Return ONLY the JSON object, without any markdown formatting or code blocks.`

      const result = await this.generateWithProviders(this.createAttachmentRequest(prompt, imageParts), (text) => {
        parseJsonResponse(text, this.getCurrentProvider())
      })

      return parseJsonResponse(result.text, result.provider)
    } catch (error) {
      console.error("Error extracting problem from images:", error)
      throw error
    }
  }

  public async generateSolution(problemInfo: any) {
    const prompt = `${this.systemPrompt}\n\nGiven this problem or situation:\n${JSON.stringify(problemInfo, null, 2)}\n\nPlease provide your response in the following JSON format:\n{
  "solution": {
    "code": "The code or main answer here.",
    "problem_statement": "Restate the problem or situation.",
    "context": "Relevant background/context.",
    "suggested_responses": ["First possible answer or action", "Second possible answer or action", "..."],
    "reasoning": "Explanation of why these suggestions are appropriate."
  }
}\nImportant: Return ONLY the JSON object, without any markdown formatting or code blocks.`

    console.log("[LLMHelper] Calling AI pipeline for solution...")
    try {
      const result = await this.generateWithProviders(this.createTextRequest(prompt), (text) => {
        parseJsonResponse(text, this.getCurrentProvider())
      })
      console.log(`[LLMHelper] AI pipeline returned result from ${result.provider}.`)
      const parsed = parseJsonResponse(result.text, result.provider)
      console.log("[LLMHelper] Parsed LLM response:", parsed)
      return parsed
    } catch (error) {
      console.error("[LLMHelper] Error in generateSolution:", error)
      throw error
    }
  }

  public async debugSolutionWithImages(problemInfo: any, currentCode: string, debugImagePaths: string[]) {
    try {
      const imageParts = await Promise.all(debugImagePaths.map((path) => this.fileToGenerativePart(path)))
      const prompt = `${this.systemPrompt}\n\nYou are a wingman. Given:\n1. The original problem or situation: ${JSON.stringify(problemInfo, null, 2)}\n2. The current response or approach: ${currentCode}\n3. The debug information in the provided images\n\nPlease analyze the debug information and provide feedback in this JSON format:\n{
  "solution": {
    "code": "The code or main answer here.",
    "problem_statement": "Restate the problem or situation.",
    "context": "Relevant background/context.",
    "suggested_responses": ["First possible answer or action", "Second possible answer or action", "..."],
    "reasoning": "Explanation of why these suggestions are appropriate."
  }
}\nImportant: Return ONLY the JSON object, without any markdown formatting or code blocks.`

      const result = await this.generateWithProviders(this.createAttachmentRequest(prompt, imageParts), (text) => {
        parseJsonResponse(text, this.getCurrentProvider())
      })

      const parsed = parseJsonResponse(result.text, result.provider)
      console.log("[LLMHelper] Parsed debug LLM response:", parsed)
      return parsed
    } catch (error) {
      console.error("Error debugging solution with images:", error)
      throw error
    }
  }

  public async analyzeAudioFile(audioPath: string) {
    try {
      const audioData = await fs.promises.readFile(audioPath)
      const audioPart: AIInputAttachment = {
        kind: "audio",
        data: audioData.toString("base64"),
        mimeType: "audio/mp3"
      }
      const prompt = `${this.systemPrompt}\n\nDescribe this audio clip in a short, concise answer. In addition to your main answer, suggest several possible actions or responses the user could take next based on the audio. Do not return a structured JSON object, just answer naturally as you would to a user.`

      const result = await this.generateText(this.createAttachmentRequest(prompt, [audioPart]))
      return { text: result.text, timestamp: Date.now() }
    } catch (error) {
      console.error("Error analyzing audio file:", error)
      throw error
    }
  }

  public async analyzeAudioFromBase64(data: string, mimeType: string) {
    try {
      const audioPart: AIInputAttachment = { kind: "audio", data, mimeType }
      const prompt = `${this.systemPrompt}\n\nDescribe this audio clip in a short, concise answer. In addition to your main answer, suggest several possible actions or responses the user could take next based on the audio. Do not return a structured JSON object, just answer naturally as you would to a user and be concise.`

      const result = await this.generateText(this.createAttachmentRequest(prompt, [audioPart]))
      return { text: result.text, timestamp: Date.now() }
    } catch (error) {
      console.error("Error analyzing audio from base64:", error)
      throw error
    }
  }

  public async analyzeImageFile(imagePath: string) {
    try {
      const imagePart = await this.fileToGenerativePart(imagePath)
      const prompt = `${this.systemPrompt}\n\nAnalyze this screenshot and explain it clearly. Describe what is visible, what it likely means, and answer the user's underlying question or situation if one is implied by the image. Include a short explanation of the important details in the screenshot and suggest several possible actions or responses the user could take next based on it. Do not return a structured JSON object; just answer naturally and clearly.`

      const result = await this.generateText(this.createAttachmentRequest(prompt, [imagePart]))
      return { text: result.text, timestamp: Date.now() }
    } catch (error) {
      console.error("Error analyzing image file:", error)
      throw error
    }
  }

  public async chatWithGemini(message: string): Promise<string> {
    try {
      if (this.useOllama) {
        return this.callOllama(message)
      }

      const result = await this.generateText(this.createTextRequest(message))
      return result.text
    } catch (error) {
      console.error("[LLMHelper] Error in chatWithGemini:", error)
      throw error
    }
  }

  public async chat(message: string): Promise<string> {
    return this.chatWithGemini(message)
  }

  public async chatWithScreenshots(message: string, screenshotPaths: string[]): Promise<string> {
    try {
      if (!screenshotPaths || screenshotPaths.length === 0) {
        return this.chat(message)
      }

      const imageParts = await Promise.all(
        screenshotPaths.map((p) => this.fileToGenerativePart(p))
      )
      const prompt = `${this.systemPrompt}\n\nThe user has shared screenshot(s) and asks: ${message}\n\nAnalyze the screenshot(s) and answer the user's question. Be clear and helpful.`
      const result = await this.generateText(this.createAttachmentRequest(prompt, imageParts))
      return result.text
    } catch (error) {
      console.error("[LLMHelper] Error in chatWithScreenshots:", error)
      throw error
    }
  }

  public isUsingOllama(): boolean {
    return this.useOllama
  }

  public async getOllamaModels(): Promise<string[]> {
    if (!this.useOllama) return []

    try {
      const response = await fetch(`${this.ollamaUrl}/api/tags`)
      if (!response.ok) throw new Error("Failed to fetch models")

      const data = await response.json()
      return data.models?.map((model: any) => model.name) || []
    } catch (error) {
      console.error("[LLMHelper] Error fetching Ollama models:", error)
      return []
    }
  }

  public getCurrentProvider(): AIProviderName {
    return this.useOllama ? "ollama" : this.primaryProvider
  }

  public getCurrentModel(): string {
    if (this.useOllama) return this.ollamaModel
    return this.primaryProvider === "groq" ? this.groqModelCandidates[0] : this.geminiModelName
  }

  public async switchToOllama(model?: string, url?: string): Promise<void> {
    this.useOllama = true
    if (url) this.ollamaUrl = url

    if (model) {
      this.ollamaModel = model
    } else {
      await this.initializeOllamaModel()
    }

    console.log(`[LLMHelper] Switched to Ollama: ${this.ollamaModel} at ${this.ollamaUrl}`)
  }

  public async switchToGroq(apiKey?: string): Promise<void> {
    if (apiKey) {
      this.groqApiKey = apiKey
    }

    this.useOllama = false
    this.primaryProvider = "groq"
    this.rebuildProviderManager()
    console.log(`[LLMHelper] Switched to Groq model: ${this.groqModelCandidates[0]}`)
  }

  public async switchToGemini(apiKey?: string): Promise<void> {
    if (apiKey) {
      this.geminiApiKey = apiKey
    }

    this.useOllama = false
    this.primaryProvider = "gemini"
    this.rebuildProviderManager()
    console.log(`[LLMHelper] Switched to Gemini model: ${this.geminiModelName}`)
  }

  public async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      if (this.useOllama) {
        const response = await fetch(`${this.ollamaUrl}/api/tags`)
        if (!response.ok) {
          return { success: false, error: `Ollama not available at ${this.ollamaUrl}` }
        }

        await this.callOllama("Hello")
        return { success: true }
      }

      const result = await this.generateText(this.createTextRequest("Hello"))
      return { success: !!result.text }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }
}