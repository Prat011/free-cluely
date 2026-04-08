import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai"
import fs from "fs"
import path from "path"
import { AUDIO_ANALYSIS_PROMPT, IMAGE_ANALYSIS_PROMPT, MASTER_SYSTEM_PROMPT } from "./prompts"

interface OllamaChatResponse {
  message?: {
    content?: string
  }
}

interface OllamaGenerateResponse {
  response?: string
}

interface OllamaModelDetails {
  family?: string
  families?: string[]
}

interface OllamaModel {
  name: string
  details?: OllamaModelDetails
}

interface OllamaTagsResponse {
  models?: OllamaModel[]
}

interface NvidiaContentPart {
  type?: string
  text?: string
}

interface NvidiaChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string | NvidiaContentPart[]
    }
  }>
}

interface LLMHelperConfig {
  geminiApiKey?: string
  useOllama?: boolean
  ollamaModel?: string
  ollamaUrl?: string
  useNvidia?: boolean
  nvidiaApiKey?: string
  nvidiaModel?: string
  nvidiaUrl?: string
  nvidiaFallbackModel?: string
}

export interface OllamaModelCapability {
  name: string
  supportsVision: boolean
  supportsAudio: boolean
}

export class LLMHelper {
  private model: GenerativeModel | null = null
  private readonly systemPrompt = MASTER_SYSTEM_PROMPT

  private useOllama: boolean = false
  private ollamaModel: string = "llama3.2"
  private ollamaUrl: string = "http://localhost:11434"

  private useNvidia: boolean = false
  private nvidiaApiKey: string = ""
  private nvidiaModel: string = "microsoft/phi-4-multimodal-instruct"
  private nvidiaUrl: string = "https://integrate.api.nvidia.com/v1/chat/completions"
  private nvidiaFallbackModel: string | null = null

  constructor(config: LLMHelperConfig = {}) {
    this.useOllama = Boolean(config.useOllama)
    this.useNvidia = Boolean(config.useNvidia)

    if (this.useOllama && this.useNvidia) {
      throw new Error("Only one local provider can be active at a time. Choose either Ollama or NVIDIA.")
    }

    if (this.useNvidia) {
      this.nvidiaApiKey = config.nvidiaApiKey || ""
      this.nvidiaModel = config.nvidiaModel || this.nvidiaModel
      this.nvidiaUrl = config.nvidiaUrl || this.nvidiaUrl
      this.nvidiaFallbackModel = config.nvidiaFallbackModel || null

      if (!this.nvidiaApiKey) {
        throw new Error("NVIDIA_API_KEY is required when USE_NVIDIA=true")
      }

      console.log(`[LLMHelper] Using NVIDIA build model: ${this.nvidiaModel}`)
      return
    }

    if (this.useOllama) {
      this.ollamaUrl = config.ollamaUrl || "http://localhost:11434"
      this.ollamaModel = config.ollamaModel || "gemma:latest"
      console.log(`[LLMHelper] Using Ollama with model: ${this.ollamaModel}`)
      this.initializeOllamaModel()
      return
    }

    if (config.geminiApiKey) {
      const genAI = new GoogleGenerativeAI(config.geminiApiKey)
      this.model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" })
      console.log("[LLMHelper] Using Google Gemini")
      return
    }

    throw new Error("No LLM provider configured. Set Gemini, Ollama, or NVIDIA config.")
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

  private ensureGeminiModel(): GenerativeModel {
    if (!this.model) {
      throw new Error("Gemini model is not initialized. Switch provider to Gemini for this feature.")
    }
    return this.model
  }

  private ensureNvidiaApiKey(): string {
    if (!this.nvidiaApiKey) {
      throw new Error("NVIDIA_API_KEY is missing. Set it in settings or environment.")
    }
    return this.nvidiaApiKey
  }

  private extractNvidiaText(data: NvidiaChatCompletionResponse): string {
    const content = data.choices?.[0]?.message?.content
    if (typeof content === "string" && content.trim()) {
      return content.trim()
    }

    if (Array.isArray(content)) {
      const text = content
        .map((item) => (typeof item?.text === "string" ? item.text : ""))
        .join("\n")
        .trim()
      if (text) {
        return text
      }
    }

    throw new Error("NVIDIA API returned no text content")
  }

  private parseNvidiaErrorDetail(rawBody: string): string {
    if (!rawBody) return ""
    try {
      const parsed = JSON.parse(rawBody)
      if (typeof parsed?.detail === "string") return parsed.detail
      if (typeof parsed?.error?.message === "string") return parsed.error.message
      return rawBody
    } catch {
      return rawBody
    }
  }

  private isNvidiaFunctionDegraded(detail: string): boolean {
    return detail.toUpperCase().includes("DEGRADED FUNCTION CANNOT BE INVOKED")
  }

  private async invokeNvidia(model: string, messages: Array<{ role: string; content: any }>): Promise<{ text?: string; detail?: string; status: number; statusText: string }> {
    const apiKey = this.ensureNvidiaApiKey()

    const response = await fetch(this.nvidiaUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: 512,
        temperature: 0.1,
        top_p: 0.7,
        frequency_penalty: 0,
        presence_penalty: 0,
        stream: false
      })
    })

    const rawBody = await response.text()

    if (!response.ok) {
      return {
        status: response.status,
        statusText: response.statusText,
        detail: this.parseNvidiaErrorDetail(rawBody)
      }
    }

    let parsed: NvidiaChatCompletionResponse
    try {
      parsed = JSON.parse(rawBody)
    } catch {
      throw new Error(`NVIDIA API returned non-JSON response: ${rawBody}`)
    }

    return {
      status: response.status,
      statusText: response.statusText,
      text: this.extractNvidiaText(parsed)
    }
  }

  private async callNvidia(messages: Array<{ role: string; content: any }>): Promise<string> {
    if (!this.useNvidia) {
      throw new Error("NVIDIA provider is not active. Switch provider to NVIDIA first.")
    }

    const primaryModel = this.nvidiaModel
    const primaryResult = await this.invokeNvidia(primaryModel, messages)
    if (primaryResult.text) {
      return primaryResult.text
    }

    const primaryDetail = primaryResult.detail || ""
    const degraded = this.isNvidiaFunctionDegraded(primaryDetail)
    if (degraded && this.nvidiaFallbackModel && this.nvidiaFallbackModel !== primaryModel) {
      console.warn(`[LLMHelper] NVIDIA model ${primaryModel} is degraded. Retrying with fallback model ${this.nvidiaFallbackModel}.`)
      const fallbackResult = await this.invokeNvidia(this.nvidiaFallbackModel, messages)
      if (fallbackResult.text) {
        this.nvidiaModel = this.nvidiaFallbackModel
        return fallbackResult.text
      }

      const fallbackDetail = fallbackResult.detail || ""
      throw new Error(`NVIDIA API error: ${fallbackResult.status} ${fallbackResult.statusText}${fallbackDetail ? ` - ${fallbackDetail}` : ""}`)
    }

    if (degraded) {
      throw new Error(
        `NVIDIA model ${primaryModel} is currently degraded and cannot be invoked. Set NVIDIA_MODEL to another available model, configure NVIDIA_FALLBACK_MODEL, or switch provider temporarily.`
      )
    }

    throw new Error(`NVIDIA API error: ${primaryResult.status} ${primaryResult.statusText}${primaryDetail ? ` - ${primaryDetail}` : ""}`)
  }

  private async callNvidiaWithImages(prompt: string, imageBase64List: string[], mimeType: string = "image/png"): Promise<string> {
    const content = [
      { type: "text", text: prompt },
      ...imageBase64List.map((imageBase64) => ({
        type: "image_url",
        image_url: {
          url: `data:${mimeType};base64,${imageBase64}`
        }
      }))
    ]

    return this.callNvidia([{ role: "user", content }])
  }

  private getNvidiaAudioFormat(mimeType: string): string {
    const normalized = (mimeType || "").toLowerCase().split(";")[0]
    if (normalized.includes("wav")) return "wav"
    if (normalized.includes("mpeg") || normalized.includes("mp3")) return "mp3"
    return ""
  }

  private normalizeNvidiaAudioMimeType(mimeType: string): string {
    const lower = (mimeType || "").toLowerCase().split(";")[0]

    if (lower.includes("wav")) return "audio/wav"
    if (lower.includes("mpeg") || lower.includes("mp3")) return "audio/mpeg"
    return ""
  }

  private ensureDataUrl(base64OrDataUrl: string, mimeType: string): string {
    const trimmed = base64OrDataUrl.trim()
    if (trimmed.startsWith("data:")) {
      return trimmed
    }

    return `data:${mimeType};base64,${trimmed}`
  }

  private extractBase64FromDataUrl(base64OrDataUrl: string): string {
    const trimmed = base64OrDataUrl.trim()
    if (!trimmed.startsWith("data:")) return trimmed

    const idx = trimmed.indexOf(",")
    if (idx === -1) return trimmed
    return trimmed.slice(idx + 1)
  }

  private async callNvidiaWithAudio(prompt: string, audioBase64: string, mimeType: string): Promise<string> {
    const normalizedMimeType = this.normalizeNvidiaAudioMimeType(mimeType)
    const format = this.getNvidiaAudioFormat(normalizedMimeType)
    if (!normalizedMimeType || !format) {
      throw new Error(`NVIDIA audio input supports WAV/MP3 only. Received mime type: ${mimeType}. Convert recording to WAV before sending.`)
    }

    const audioDataUrl = this.ensureDataUrl(audioBase64, normalizedMimeType)
    const rawBase64 = this.extractBase64FromDataUrl(audioDataUrl)

    const payloadVariants: any[] = [
      [
        { type: "text", text: prompt },
        { type: "input_audio", input_audio: { data: rawBase64, format } }
      ],
      [
        { type: "text", text: prompt },
        { type: "input_audio", input_audio: { data: audioDataUrl, format } }
      ],
      [
        { type: "text", text: prompt },
        { type: "audio_url", audio_url: { url: audioDataUrl } }
      ],
      [
        { type: "text", text: prompt },
        { type: "audio_url", audio_url: audioDataUrl }
      ],
      [
        {
          type: "text",
          text: `${prompt}\n<audio src=\"${audioDataUrl}\" />`
        }
      ]
    ]

    const errors: string[] = []
    for (const content of payloadVariants) {
      try {
        return await this.callNvidia([{ role: "user", content }])
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error))
      }
    }

    try {
      return await this.callNvidia([
        {
          role: "user",
          content: `${prompt}\n\n<audio src="${audioDataUrl}" />`
        }
      ])
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error))
    }

    throw new Error(`NVIDIA audio analysis failed. ${errors.join(" | ") || "Audio payload not accepted."}`)
  }

  private inferOllamaModelCapability(model: OllamaModel): OllamaModelCapability {
    const detailsText = [
      model.details?.family,
      ...(model.details?.families || []),
      model.name
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()

    const visionIndicators = [
      "vision",
      "-vl",
      " vl",
      "llava",
      "bakllava",
      "moondream",
      "minicpm-v",
      "qwen2.5vl",
      "qwen2-vl",
      "llama3.2-vision"
    ]

    const audioIndicators = [
      "audio",
      "voice",
      "qwen2-audio",
      "ultravox",
      "whisper"
    ]

    const supportsVision = visionIndicators.some((indicator) => detailsText.includes(indicator))
    const supportsAudio = audioIndicators.some((indicator) => detailsText.includes(indicator))

    return {
      name: model.name,
      supportsVision,
      supportsAudio
    }
  }

  private getAudioMimeTypeFromPath(audioPath: string): string {
    const ext = path.extname(audioPath).toLowerCase()
    if (ext === ".wav") return "audio/wav"
    if (ext === ".ogg") return "audio/ogg"
    if (ext === ".m4a") return "audio/mp4"
    if (ext === ".aac") return "audio/aac"
    return "audio/mpeg"
  }

  private getOllamaInstallGuidance(modality: "vision" | "audio"): string {
    if (modality === "vision") {
      return "Install a vision-capable model, for example: `ollama pull llama3.2-vision:11b` or `ollama pull llava:7b`, then run `ollama list`."
    }

    return "Install an audio-capable model if available for your Ollama version, for example: `ollama pull qwen2-audio:7b`, then run `ollama list`."
  }

  private async ensureOllamaCapability(modality: "vision" | "audio"): Promise<void> {
    if (!this.useOllama) return

    const capabilities = await this.getOllamaModelCapabilities()
    if (capabilities.length === 0) {
      throw new Error(`No Ollama models detected. ${this.getOllamaInstallGuidance(modality)}`)
    }

    const current = capabilities.find((model) => model.name === this.ollamaModel)
    const currentSupports = modality === "vision" ? current?.supportsVision : current?.supportsAudio
    if (currentSupports) {
      return
    }

    const fallback = capabilities.find((model) =>
      modality === "vision" ? model.supportsVision : model.supportsAudio
    )

    if (fallback) {
      this.ollamaModel = fallback.name
      console.log(`[LLMHelper] Auto-switched to ${modality}-capable model: ${fallback.name}`)
      return
    }

    throw new Error(
      `Current Ollama model \"${this.ollamaModel}\" does not appear ${modality}-capable, and no installed ${modality}-capable model was found. ${this.getOllamaInstallGuidance(modality)}`
    )
  }

  private async callOllama(prompt: string): Promise<string> {
    if (!this.useOllama) {
      throw new Error("Ollama provider is not active. Switch provider to Ollama before invoking local chat.")
    }

    try {
      const availableModels = await this.getOllamaModels()
      if (availableModels.length === 0) {
        throw new Error(`No Ollama models found at ${this.ollamaUrl}. Run \`ollama pull llama3.2\` and retry.`)
      }

      if (!availableModels.includes(this.ollamaModel)) {
        this.ollamaModel = availableModels[0]
        console.log(`[LLMHelper] Auto-switched to available Ollama model for chat: ${this.ollamaModel}`)
      }

      const response = await fetch(`${this.ollamaUrl}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.ollamaModel,
          stream: false,
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
          options: {
            temperature: 0.7,
            top_p: 0.9,
          }
        }),
      })

      if (response.ok) {
        const data: OllamaChatResponse = await response.json()
        const content = data.message?.content?.trim()
        if (content) {
          return content
        }
      } else {
        const chatError = await response.text()
        console.warn(`[LLMHelper] /api/chat failed (${response.status}): ${chatError}`)
      }

      const fallbackResponse = await fetch(`${this.ollamaUrl}/api/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.ollamaModel,
          prompt,
          stream: false,
          options: {
            temperature: 0.7,
            top_p: 0.9,
          }
        }),
      })

      if (!fallbackResponse.ok) {
        const errorBody = await fallbackResponse.text()
        throw new Error(`Ollama API error: ${fallbackResponse.status} ${fallbackResponse.statusText}${errorBody ? ` - ${errorBody}` : ""}`)
      }

      const data: OllamaGenerateResponse = await fallbackResponse.json()
      if (!data.response?.trim()) {
        throw new Error("Ollama returned an empty response for text chat")
      }

      return data.response
    } catch (error) {
      console.error("[LLMHelper] Error calling Ollama:", error)
      throw new Error(`Ollama text chat failed: ${error instanceof Error ? error.message : String(error)}. Verify provider/model settings and that Ollama is reachable at ${this.ollamaUrl}.`)
    }
  }

  private async callOllamaWithImages(prompt: string, imageBase64List: string[]): Promise<string> {
    try {
      await this.ensureOllamaCapability("vision")

      const response = await fetch(`${this.ollamaUrl}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.ollamaModel,
          stream: false,
          messages: [
            {
              role: "user",
              content: prompt,
              images: imageBase64List,
            },
          ],
          options: {
            temperature: 0.7,
            top_p: 0.9,
          },
        }),
      })

      if (!response.ok) {
        throw new Error(`Ollama chat API error: ${response.status} ${response.statusText}`)
      }

      const data: OllamaChatResponse = await response.json()
      const content = data.message?.content?.trim()
      if (!content) {
        throw new Error("Empty response from Ollama chat API")
      }
      return content
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error("[LLMHelper] Error calling Ollama chat with images:", error)
      throw new Error(`Failed Ollama image analysis: ${message}. Ensure selected Ollama model supports vision.`)
    }
  }

  private async callOllamaWithAudio(prompt: string, audioBase64: string, mimeType: string): Promise<string> {
    await this.ensureOllamaCapability("audio")

    const payloadVariants = [
      {
        messages: [
          {
            role: "user",
            content: prompt,
            audios: [{ data: audioBase64, mime_type: mimeType }]
          }
        ]
      },
      {
        messages: [
          {
            role: "user",
            content: prompt,
            audio: { data: audioBase64, mime_type: mimeType }
          }
        ]
      }
    ]

    const errors: string[] = []

    for (const payload of payloadVariants) {
      try {
        const response = await fetch(`${this.ollamaUrl}/api/chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: this.ollamaModel,
            stream: false,
            ...payload,
            options: {
              temperature: 0.7,
              top_p: 0.9
            }
          })
        })

        if (!response.ok) {
          const errorText = await response.text()
          errors.push(`HTTP ${response.status} ${response.statusText}${errorText ? `: ${errorText}` : ""}`)
          continue
        }

        const data: OllamaChatResponse = await response.json()
        const content = data.message?.content?.trim()
        if (!content) {
          errors.push("Empty response content from Ollama chat")
          continue
        }

        return content
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error))
      }
    }

    throw new Error(
      `Failed Ollama audio analysis. ${errors.join(" | ") || "Audio payload not accepted by Ollama."} ${this.getOllamaInstallGuidance("audio")}`
    )
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
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`[LLMHelper] Failed to initialize Ollama model: ${message}`)
      try {
        const models = await this.getOllamaModels()
        if (models.length > 0) {
          this.ollamaModel = models[0]
          console.log(`[LLMHelper] Fallback to: ${this.ollamaModel}`)
        }
      } catch (fallbackError) {
        const fallbackMessage = fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
        console.error(`[LLMHelper] Fallback also failed: ${fallbackMessage}`)
      }
    }
  }

  public async analyzeAudioFile(audioPath: string) {
    try {
      const audioData = await fs.promises.readFile(audioPath)
      const mimeType = this.getAudioMimeTypeFromPath(audioPath)
      const prompt = `${this.systemPrompt}\n\n${AUDIO_ANALYSIS_PROMPT}`

      if (this.useOllama) {
        const text = await this.callOllamaWithAudio(prompt, audioData.toString("base64"), mimeType)
        return { text, timestamp: Date.now() }
      }

      if (this.useNvidia) {
        const text = await this.callNvidiaWithAudio(prompt, audioData.toString("base64"), mimeType)
        return { text, timestamp: Date.now() }
      }

      const audioPart = {
        inlineData: {
          data: audioData.toString("base64"),
          mimeType
        }
      }
      const result = await this.ensureGeminiModel().generateContent([prompt, audioPart])
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
      const prompt = `${this.systemPrompt}\n\n${AUDIO_ANALYSIS_PROMPT}`

      if (this.useOllama) {
        const text = await this.callOllamaWithAudio(prompt, data, mimeType)
        return { text, timestamp: Date.now() }
      }

      if (this.useNvidia) {
        const text = await this.callNvidiaWithAudio(prompt, data, mimeType)
        return { text, timestamp: Date.now() }
      }

      const audioPart = {
        inlineData: {
          data,
          mimeType
        }
      }
      const result = await this.ensureGeminiModel().generateContent([prompt, audioPart])
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
      const imageBase64 = imageData.toString("base64")
      const imagePart = {
        inlineData: {
          data: imageBase64,
          mimeType: "image/png"
        }
      }
      const prompt = `${this.systemPrompt}\n\n${IMAGE_ANALYSIS_PROMPT}`
      let text: string
      if (this.useOllama) {
        text = await this.callOllamaWithImages(prompt, [imageBase64])
      } else if (this.useNvidia) {
        text = await this.callNvidiaWithImages(prompt, [imageBase64])
      } else {
        const result = await this.ensureGeminiModel().generateContent([prompt, imagePart])
        const response = await result.response
        text = response.text()
      }
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
      }

      if (this.useNvidia) {
        return this.callNvidia([{ role: "user", content: message }])
      }

      if (!this.model) {
        throw new Error("No LLM provider configured")
      }

      const result = await this.model.generateContent(message)
      const response = await result.response
      return response.text()
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

  public isUsingNvidia(): boolean {
    return this.useNvidia
  }

  public async getOllamaModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.ollamaUrl}/api/tags`)
      if (!response.ok) throw new Error("Failed to fetch models")

      const data: OllamaTagsResponse = await response.json()
      return data.models?.map((model) => model.name) || []
    } catch (error) {
      console.error("[LLMHelper] Error fetching Ollama models:", error)
      return []
    }
  }

  public async getOllamaModelCapabilities(): Promise<OllamaModelCapability[]> {
    try {
      const response = await fetch(`${this.ollamaUrl}/api/tags`)
      if (!response.ok) throw new Error("Failed to fetch models")

      const data: OllamaTagsResponse = await response.json()
      return (data.models || []).map((model) => this.inferOllamaModelCapability(model))
    } catch (error) {
      console.error("[LLMHelper] Error fetching Ollama model capabilities:", error)
      return []
    }
  }

  public getCurrentProvider(): "ollama" | "gemini" | "nvidia" {
    if (this.useNvidia) return "nvidia"
    return this.useOllama ? "ollama" : "gemini"
  }

  public getCurrentModel(): string {
    if (this.useNvidia) return this.nvidiaModel
    return this.useOllama ? this.ollamaModel : "gemini-2.0-flash"
  }

  public async switchToOllama(model?: string, url?: string): Promise<void> {
    this.useNvidia = false
    this.useOllama = true

    if (url) this.ollamaUrl = url

    if (model) {
      this.ollamaModel = model
    } else {
      await this.initializeOllamaModel()
    }

    console.log(`[LLMHelper] Switched to Ollama: ${this.ollamaModel} at ${this.ollamaUrl}`)
  }

  public async switchToGemini(apiKey?: string): Promise<void> {
    if (apiKey) {
      const genAI = new GoogleGenerativeAI(apiKey)
      this.model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" })
    }

    if (!this.model && !apiKey) {
      throw new Error("No Gemini API key provided and no existing model instance")
    }

    this.useOllama = false
    this.useNvidia = false
    console.log("[LLMHelper] Switched to Gemini")
  }

  public async switchToNvidia(apiKey?: string, model?: string, url?: string): Promise<void> {
    if (apiKey) {
      this.nvidiaApiKey = apiKey
    }

    if (model) {
      this.nvidiaModel = model
    }

    if (url) {
      this.nvidiaUrl = url
    }

    if (!this.nvidiaApiKey) {
      throw new Error("NVIDIA API key is required to switch to NVIDIA provider")
    }

    this.useNvidia = true
    this.useOllama = false
    console.log(`[LLMHelper] Switched to NVIDIA: ${this.nvidiaModel} at ${this.nvidiaUrl}`)
  }

  public async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      if (this.useNvidia) {
        await this.callNvidia([{ role: "user", content: "Hello" }])
        return { success: true }
      }

      if (this.useOllama) {
        const available = await this.checkOllamaAvailable()
        if (!available) {
          return { success: false, error: `Ollama not available at ${this.ollamaUrl}` }
        }

        await this.callOllama("Hello")
        return { success: true }
      }

      if (!this.model) {
        return { success: false, error: "No Gemini model configured" }
      }

      const result = await this.model.generateContent("Hello")
      const response = await result.response
      const text = response.text()
      if (text) {
        return { success: true }
      }

      return { success: false, error: "Empty response from Gemini" }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  }
}
