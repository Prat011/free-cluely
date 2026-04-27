import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai"
import fs from "fs"

interface OllamaResponse {
  response: string
  done: boolean
}

export class LLMHelper {
  private model: GenerativeModel | null = null
 private readonly systemPrompt = `You're a real-time assistant that gives the user info during meetings and other workflows. Your goal is to answer the user's query directly.

Responses must be EXTREMELY short and terse

- Aim for 1-2 sentences, and if longer, use bullet points for structure
- Get straight to the point and NEVER add filler, preamble, or meta-comments
- Never give the user a direct script or word track to say, your responses must be informative
- Don't end with a question or prompt to the user
- If an example story is needed, give one specific example story without making up details
- If a response calls for code, write all code required with detailed comments and give two lines space b/w  lines of code.

Tone must be natural, human, and conversational

- Never be robotic or overly formal
- Use contractions naturally (“it's” not “it is”)
- Occasionally start with “And” or “But” or use a sentence fragment for flow
- NEVER use hyphens or dashes, split into shorter sentences or use commas
- Avoid unnecessary adjectives or dramatic emphasis unless it adds clear value`

  private useOllama: boolean = false
  private ollamaModel: string = "llama3.2"
  private ollamaUrl: string = "http://localhost:11434"

  constructor(apiKey?: string, useOllama: boolean = false, ollamaModel?: string, ollamaUrl?: string) {
    this.useOllama = useOllama
    
    if (useOllama) {
      this.ollamaUrl = ollamaUrl || "http://localhost:11434"
      this.ollamaModel = ollamaModel || "gemma:latest"
      console.log(`[LLMHelper] Using Ollama with model: ${this.ollamaModel}`)
      this.initializeOllamaModel()
    } else if (apiKey) {
      const genAI = new GoogleGenerativeAI(apiKey)
      this.model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" })
      console.log("[LLMHelper] Using Google Gemini")
    } else {
      throw new Error("Either provide Gemini API key or enable Ollama mode")
    }
  }

  private async fileToGenerativePart(imagePath: string) {
    const imageData = await fs.promises.readFile(imagePath)
    return {
      inlineData: {
        data: imageData.toString("base64"),
        mimeType: "image/png"
      }
    }
  }

  private cleanJsonResponse(text: string): string {
    text = text.replace(/^```(?:json)?\n/, '').replace(/\n```$/, '')
    return text.trim()
  }

  private async callOllama(prompt: string): Promise<string> {
    try {
      const response = await fetch(`${this.ollamaUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.ollamaModel,
          prompt: prompt,
          stream: false,
          options: { temperature: 0.7, top_p: 0.9 }
        }),
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

  private async checkOllamaAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.ollamaUrl}/api/tags`)
      return response.ok
    } catch {
      return false
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

  public async extractProblemFromImages(imagePaths: string[]) {
    try {
      const imageParts = await Promise.all(imagePaths.map(path => this.fileToGenerativePart(path)))
      const prompt = `${this.systemPrompt}\n\nThe images contain a problem or question. Extract the problem and provide a complete solution. For coding problems, provide working code as the final answer. For math/logic/MCQ questions, provide step-by-step solution and final answer.`
      const result = await this.model.generateContent([prompt, ...imageParts])
      const response = await result.response
      const text = this.cleanJsonResponse(response.text())
      return JSON.parse(text)
    } catch (error) {
      console.error("Error extracting problem from images:", error)
      throw error
    }
  }

  public async generateSolution(problemInfo: any) {
    const prompt = `${this.systemPrompt}\n\nGiven this problem or situation:\n${JSON.stringify(problemInfo, null, 2)}\n\nExtract the problem and provide a complete solution. For coding problems, provide working code as the final answer. For math/logic/MCQ questions, provide step-by-step solution and final answer.`
    console.log("[LLMHelper] Calling Gemini LLM for solution...")
    try {
      const result = await this.model.generateContent(prompt)
      console.log("[LLMHelper] Gemini LLM returned result.")
      const response = await result.response
      const text = this.cleanJsonResponse(response.text())
      const parsed = JSON.parse(text)
      console.log("[LLMHelper] Parsed LLM response:", parsed)
      return parsed
    } catch (error) {
      console.error("[LLMHelper] Error in generateSolution:", error)
      throw error
    }
  }

  public async debugSolutionWithImages(problemInfo: any, currentCode: string, debugImagePaths: string[]) {
    try {
      const imageParts = await Promise.all(debugImagePaths.map(path => this.fileToGenerativePart(path)))
      const prompt = `${this.systemPrompt}\n\nGiven:\n1. The original problem or situation: ${JSON.stringify(problemInfo, null, 2)}\n2. The current response or approach: ${currentCode}\n3. The debug information in the provided images\n\nExtract the problem and provide a complete solution. For coding problems, provide working code as the final answer. For math/logic/MCQ questions, provide step-by-step solution and final answer.`
      const result = await this.model.generateContent([prompt, ...imageParts])
      const response = await result.response
      const text = this.cleanJsonResponse(response.text())
      const parsed = JSON.parse(text)
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
      const prompt = `${this.systemPrompt}\n\nThe audio contains a problem or question. Extract the problem and provide a complete solution. For coding problems, provide working code as the final answer. For math/logic/MCQ questions, provide step-by-step solution and final answer.`
      const result = await this.model.generateContent([prompt, audioPart])
      const response = await result.response
      const text = response.text()
      return { text, timestamp: Date.now() }
    } catch (error) {
      console.error("Error analyzing audio file:", error)
      throw error
    }
  }

  public async analyzeAudioFromBase64(data: string, mimeType: string) {
    try {
      const audioPart = { inlineData: { data, mimeType } }
      const prompt = `${this.systemPrompt}\n\nThe audio contains a problem or question. Extract the problem and provide a complete solution. For coding problems, provide working code as the final answer. For math/logic/MCQ questions, provide step-by-step solution and final answer.`
      const result = await this.model.generateContent([prompt, audioPart])
      const response = await result.response
      const text = response.text()
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
      const prompt = `${this.systemPrompt}\n\nThe image contains a problem or question. Extract the problem and provide a complete solution. For coding problems, provide working code as the final answer. For math/logic/MCQ questions, provide step-by-step solution and final answer.`
      const result = await this.model.generateContent([prompt, imagePart])
      const response = await result.response
      const text = response.text()
      return { text, timestamp: Date.now() }
    } catch (error) {
      console.error("Error analyzing image file:", error)
      throw error
    }
  }

  public async chatWithGemini(message: string): Promise<string> {
    try {
      if (this.useOllama) {
        return this.callOllama(message)
      } else if (this.model) {
        const result = await this.model.generateContent(message)
        const response = await result.response
        return response.text()
      } else {
        throw new Error("No LLM provider configured")
      }
    } catch (error) {
      console.error("[LLMHelper] Error in chatWithGemini:", error)
      throw error
    }
  }

  public async chat(message: string): Promise<string> {
    return this.chatWithGemini(message)
  }

  public isUsingOllama(): boolean {
    return this.useOllama
  }

  public async getOllamaModels(): Promise<string[]> {
    if (!this.useOllama) return []
    try {
      const response = await fetch(`${this.ollamaUrl}/api/tags`)
      if (!response.ok) throw new Error('Failed to fetch models')
      const data = await response.json()
      return data.models?.map((model: any) => model.name) || []
    } catch (error) {
      console.error("[LLMHelper] Error fetching Ollama models:", error)
      return []
    }
  }

  public getCurrentProvider(): "ollama" | "gemini" {
    return this.useOllama ? "ollama" : "gemini"
  }

  public getCurrentModel(): string {
    return this.useOllama ? this.ollamaModel : "gemini-2.5-flash"
  }

  public async switchToOllama(model?: string, url?: string): Promise<void> {
    this.useOllama = true
    if (url) this.ollamaUrl = url
    if (model) this.ollamaModel = model
    else await this.initializeOllamaModel()
    console.log(`[LLMHelper] Switched to Ollama: ${this.ollamaModel} at ${this.ollamaUrl}`)
  }

  public async switchToGemini(apiKey?: string): Promise<void> {
    if (apiKey) {
      const genAI = new GoogleGenerativeAI(apiKey)
      this.model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" })
    }
    if (!this.model && !apiKey) throw new Error("No Gemini API key provided and no existing model instance")
    this.useOllama = false
    console.log("[LLMHelper] Switched to Gemini")
  }

  public async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      if (this.useOllama) {
        const available = await this.checkOllamaAvailable()
        if (!available) return { success: false, error: `Ollama not available at ${this.ollamaUrl}` }
        await this.callOllama("Hello")
        return { success: true }
      } else {
        if (!this.model) return { success: false, error: "No Gemini model configured" }
        const result = await this.model.generateContent("Hello")
        const response = await result.response
        const text = response.text()
        if (text) return { success: true }
        return { success: false, error: "Empty response from Gemini" }
      }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }
}
