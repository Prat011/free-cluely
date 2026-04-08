import fs from "fs"
import { ProviderRegistry, GeminiProvider, OllamaProvider } from "./llm"

export class LLMHelper {
  private registry: ProviderRegistry
  private geminiProvider: GeminiProvider | null = null
  private ollamaProvider: OllamaProvider | null = null

  private readonly systemPrompt = `You are Wingman AI, a helpful, proactive assistant for any kind of problem or situation (not just coding). For any user input, analyze the situation, provide a clear problem statement, relevant context, and suggest several possible responses or actions the user could take next. Always explain your reasoning. Present your suggestions as a list of options or next steps.`

  constructor(apiKey?: string, useOllama: boolean = false, ollamaModel?: string, ollamaUrl?: string) {
    this.registry = new ProviderRegistry()

    if (useOllama) {
      this.ollamaProvider = new OllamaProvider(
        ollamaModel || "gemma:latest",
        ollamaUrl || "http://localhost:11434"
      )
      this.registry.register(this.ollamaProvider)
      console.log(`[LLMHelper] Using Ollama with model: ${this.ollamaProvider.config.model}`)
      this.initializeOllamaModel()
    } else if (apiKey) {
      this.geminiProvider = new GeminiProvider(apiKey)
      this.registry.register(this.geminiProvider)
      console.log("[LLMHelper] Using Google Gemini")
    } else {
      throw new Error("Either provide Gemini API key or enable Ollama mode")
    }
  }

  public getRegistry(): ProviderRegistry {
    return this.registry
  }

  private cleanJsonResponse(text: string): string {
    text = text.replace(/^```(?:json)?\n/, "").replace(/\n```$/, "")
    return text.trim()
  }

  private async generate(contents: string | object[]): Promise<string> {
    if (this.geminiProvider) {
      return this.geminiProvider.generate(contents)
    }
    if (typeof contents === "string") {
      return this.registry.chat(contents)
    }
    throw new Error("Multimodal content requires Gemini provider")
  }

  private async initializeOllamaModel(): Promise<void> {
    if (!this.ollamaProvider) return
    try {
      const models = await this.ollamaProvider.getAvailableModels()
      if (models.length === 0) {
        console.warn("[LLMHelper] No Ollama models found")
        return
      }

      const currentModel = this.ollamaProvider.config.model
      if (!models.some((m) => m.id === currentModel)) {
        this.ollamaProvider.setModel(models[0].id)
        console.log(`[LLMHelper] Auto-selected first available model: ${models[0].id}`)
      }

      await this.ollamaProvider.chat("Hello")
      console.log(`[LLMHelper] Successfully initialized with model: ${this.ollamaProvider.config.model}`)
    } catch (error) {
      console.error(`[LLMHelper] Failed to initialize Ollama model: ${(error as Error).message}`)
      try {
        const models = await this.ollamaProvider.getAvailableModels()
        if (models.length > 0) {
          this.ollamaProvider.setModel(models[0].id)
          console.log(`[LLMHelper] Fallback to: ${models[0].id}`)
        }
      } catch (fallbackError) {
        console.error(`[LLMHelper] Fallback also failed: ${(fallbackError as Error).message}`)
      }
    }
  }

  public async extractProblemFromImages(imagePaths: string[]) {
    try {
      const imageParts = await Promise.all(
        imagePaths.map(async (p) => {
          const data = await fs.promises.readFile(p)
          return { inlineData: { data: data.toString("base64"), mimeType: "image/png" } }
        })
      )
      const prompt = `${this.systemPrompt}\n\nYou are a wingman. Please analyze these images and extract the following information in JSON format:\n{
  "problem_statement": "A clear statement of the problem or situation depicted in the images.",
  "context": "Relevant background or context from the images.",
  "suggested_responses": ["First possible answer or action", "Second possible answer or action", "..."],
  "reasoning": "Explanation of why these suggestions are appropriate."
}\nImportant: Return ONLY the JSON object, without any markdown formatting or code blocks.`
      const text = await this.generate([{ text: prompt }, ...imageParts])
      return JSON.parse(this.cleanJsonResponse(text))
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

    console.log("[LLMHelper] Calling Gemini LLM for solution...")
    try {
      const text = await this.generate(prompt)
      const parsed = JSON.parse(this.cleanJsonResponse(text))
      console.log("[LLMHelper] Parsed LLM response:", parsed)
      return parsed
    } catch (error) {
      console.error("[LLMHelper] Error in generateSolution:", error)
      throw error
    }
  }

  public async debugSolutionWithImages(problemInfo: any, currentCode: string, debugImagePaths: string[]) {
    try {
      const imageParts = await Promise.all(
        debugImagePaths.map(async (p) => {
          const data = await fs.promises.readFile(p)
          return { inlineData: { data: data.toString("base64"), mimeType: "image/png" } }
        })
      )
      const prompt = `${this.systemPrompt}\n\nYou are a wingman. Given:\n1. The original problem or situation: ${JSON.stringify(problemInfo, null, 2)}\n2. The current response or approach: ${currentCode}\n3. The debug information in the provided images\n\nPlease analyze the debug information and provide feedback in this JSON format:\n{
  "solution": {
    "code": "The code or main answer here.",
    "problem_statement": "Restate the problem or situation.",
    "context": "Relevant background/context.",
    "suggested_responses": ["First possible answer or action", "Second possible answer or action", "..."],
    "reasoning": "Explanation of why these suggestions are appropriate."
  }
}\nImportant: Return ONLY the JSON object, without any markdown formatting or code blocks.`
      const text = await this.generate([{ text: prompt }, ...imageParts])
      const parsed = JSON.parse(this.cleanJsonResponse(text))
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
      const audioPart = { inlineData: { data: audioData.toString("base64"), mimeType: "audio/mp3" } }
      const prompt = `${this.systemPrompt}\n\nDescribe this audio clip in a short, concise answer. In addition to your main answer, suggest several possible actions or responses the user could take next based on the audio. Do not return a structured JSON object, just answer naturally as you would to a user.`
      const text = await this.generate([{ text: prompt }, audioPart])
      return { text, timestamp: Date.now() }
    } catch (error) {
      console.error("Error analyzing audio file:", error)
      throw error
    }
  }

  public async analyzeAudioFromBase64(data: string, mimeType: string) {
    try {
      const audioPart = { inlineData: { data, mimeType } }
      const prompt = `${this.systemPrompt}\n\nDescribe this audio clip in a short, concise answer. In addition to your main answer, suggest several possible actions or responses the user could take next based on the audio. Do not return a structured JSON object, just answer naturally as you would to a user and be concise.`
      const text = await this.generate([{ text: prompt }, audioPart])
      return { text, timestamp: Date.now() }
    } catch (error) {
      console.error("Error analyzing audio from base64:", error)
      throw error
    }
  }

  public async analyzeImageFile(imagePath: string) {
    try {
      const imageData = await fs.promises.readFile(imagePath)
      const imagePart = { inlineData: { data: imageData.toString("base64"), mimeType: "image/png" } }
      const prompt = `${this.systemPrompt}\n\nDescribe the content of this image in a short, concise answer. In addition to your main answer, suggest several possible actions or responses the user could take next based on the image. Do not return a structured JSON object, just answer naturally as you would to a user. Be concise and brief.`
      const text = await this.generate([{ text: prompt }, imagePart])
      return { text, timestamp: Date.now() }
    } catch (error) {
      console.error("Error analyzing image file:", error)
      throw error
    }
  }

  public async chatWithGemini(message: string): Promise<string> {
    try {
      return await this.registry.chat(message)
    } catch (error) {
      console.error("[LLMHelper] Error in chatWithGemini:", error)
      throw error
    }
  }

  public async chat(message: string): Promise<string> {
    return this.chatWithGemini(message)
  }

  public isUsingOllama(): boolean {
    return this.registry.getActiveProvider()?.config.id === "ollama"
  }

  public async getOllamaModels(): Promise<string[]> {
    if (!this.ollamaProvider) return []
    const models = await this.ollamaProvider.getAvailableModels()
    return models.map((m) => m.id)
  }

  public getCurrentProvider(): "ollama" | "gemini" {
    return this.isUsingOllama() ? "ollama" : "gemini"
  }

  public getCurrentModel(): string {
    const provider = this.registry.getActiveProvider()
    return provider?.config.model ?? "unknown"
  }

  public async switchToOllama(model?: string, url?: string): Promise<void> {
    if (!this.ollamaProvider) {
      this.ollamaProvider = new OllamaProvider(model || "gemma:latest", url)
      this.registry.register(this.ollamaProvider)
    } else {
      if (model) this.ollamaProvider.setModel(model)
    }
    this.registry.setActiveProvider("ollama")

    if (!model) {
      await this.initializeOllamaModel()
    }

    console.log(`[LLMHelper] Switched to Ollama: ${this.ollamaProvider.config.model} at ${this.ollamaProvider.getUrl()}`)
  }

  public async switchToGemini(apiKey?: string): Promise<void> {
    if (apiKey) {
      this.geminiProvider = new GeminiProvider(apiKey)
      // Re-register to update the provider instance
      this.registry.register(this.geminiProvider)
    }

    if (!this.geminiProvider && !apiKey) {
      throw new Error("No Gemini API key provided and no existing client instance")
    }

    this.registry.setActiveProvider("gemini")
    console.log("[LLMHelper] Switched to Gemini")
  }

  public async testConnection(): Promise<{ success: boolean; error?: string }> {
    return this.registry.testConnection()
  }
}
