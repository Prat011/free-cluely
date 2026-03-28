import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai"
import fs from "fs"
import path from "path"

interface OllamaResponse {
  response: string
  done: boolean
}

interface OllamaChatResponse {
  message?: {
    content?: string
  }
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

export interface OllamaModelCapability {
  name: string
  supportsVision: boolean
  supportsAudio: boolean
}

export class LLMHelper {
  private model: GenerativeModel | null = null
  private readonly systemPrompt = `You are Wingman AI, a helpful, proactive assistant for any kind of problem or situation (not just coding). For any user input, analyze the situation, provide a clear problem statement, relevant context, and suggest several possible responses or actions the user could take next. Always explain your reasoning. Present your suggestions as a list of options or next steps.`
  private useOllama: boolean = false
  private ollamaModel: string = "llama3.2"
  private ollamaUrl: string = "http://localhost:11434"

  constructor(apiKey?: string, useOllama: boolean = false, ollamaModel?: string, ollamaUrl?: string) {
    this.useOllama = useOllama
    
    if (useOllama) {
      this.ollamaUrl = ollamaUrl || "http://localhost:11434"
      this.ollamaModel = ollamaModel || "gemma:latest" // Default fallback
      console.log(`[LLMHelper] Using Ollama with model: ${this.ollamaModel}`)
      
      // Auto-detect and use first available model if specified model doesn't exist
      this.initializeOllamaModel()
    } else if (apiKey) {
      const genAI = new GoogleGenerativeAI(apiKey)
      this.model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" })
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
    // Remove markdown code block syntax if present
    text = text.replace(/^```(?:json)?\n/, '').replace(/\n```$/, '');
    // Remove any leading/trailing whitespace
    text = text.trim();
    return text;
  }

  private ensureGeminiModel(): GenerativeModel {
    if (!this.model) {
      throw new Error("Gemini model is not initialized. Switch to Gemini for this feature.")
    }
    return this.model
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
    try {
      const response = await fetch(`${this.ollamaUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.ollamaModel,
          prompt: prompt,
          stream: false,
          options: {
            temperature: 0.7,
            top_p: 0.9,
          }
        }),
      })

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`)
      }

      const data: OllamaResponse = await response.json()
      return data.response
    } catch (error) {
      console.error("[LLMHelper] Error calling Ollama:", error)
      throw new Error(`Failed to connect to Ollama: ${error.message}. Make sure Ollama is running on ${this.ollamaUrl}`)
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
      console.error("[LLMHelper] Error calling Ollama chat with images:", error)
      throw new Error(`Failed Ollama image analysis: ${error.message}. Ensure selected Ollama model supports vision.`)
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
        errors.push(error.message)
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

      // Check if current model exists, if not use the first available
      if (!availableModels.includes(this.ollamaModel)) {
        this.ollamaModel = availableModels[0]
        console.log(`[LLMHelper] Auto-selected first available model: ${this.ollamaModel}`)
      }

      // Test the selected model works
      const testResult = await this.callOllama("Hello")
      console.log(`[LLMHelper] Successfully initialized with model: ${this.ollamaModel}`)
    } catch (error) {
      console.error(`[LLMHelper] Failed to initialize Ollama model: ${error.message}`)
      // Try to use first available model as fallback
      try {
        const models = await this.getOllamaModels()
        if (models.length > 0) {
          this.ollamaModel = models[0]
          console.log(`[LLMHelper] Fallback to: ${this.ollamaModel}`)
        }
      } catch (fallbackError) {
        console.error(`[LLMHelper] Fallback also failed: ${fallbackError.message}`)
      }
    }
  }

  public async extractProblemFromImages(imagePaths: string[]) {
    try {
      const imageParts = await Promise.all(imagePaths.map(path => this.fileToGenerativePart(path)))
      
      const prompt = `${this.systemPrompt}\n\nYou are a wingman. Please analyze these images and extract the following information in JSON format:\n{
  "problem_statement": "A clear statement of the problem or situation depicted in the images.",
  "context": "Relevant background or context from the images.",
  "suggested_responses": ["First possible answer or action", "Second possible answer or action", "..."],
  "reasoning": "Explanation of why these suggestions are appropriate."
}\nImportant: Return ONLY the JSON object, without any markdown formatting or code blocks.`

      let text: string
      if (this.useOllama) {
        const images = imageParts.map(part => part.inlineData.data)
        text = this.cleanJsonResponse(await this.callOllamaWithImages(prompt, images))
      } else {
        const result = await this.ensureGeminiModel().generateContent([prompt, ...imageParts])
        const response = await result.response
        text = this.cleanJsonResponse(response.text())
      }
      return JSON.parse(text)
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

    console.log(`[LLMHelper] Calling ${this.useOllama ? "Ollama" : "Gemini"} LLM for solution...`);
    try {
      let text: string
      if (this.useOllama) {
        text = this.cleanJsonResponse(await this.callOllama(prompt))
      } else {
        const result = await this.ensureGeminiModel().generateContent(prompt)
        console.log("[LLMHelper] Gemini LLM returned result.");
        const response = await result.response
        text = this.cleanJsonResponse(response.text())
      }
      const parsed = JSON.parse(text)
      console.log("[LLMHelper] Parsed LLM response:", parsed)
      return parsed
    } catch (error) {
      console.error("[LLMHelper] Error in generateSolution:", error);
      throw error;
    }
  }

  public async debugSolutionWithImages(problemInfo: any, currentCode: string, debugImagePaths: string[]) {
    try {
      const imageParts = await Promise.all(debugImagePaths.map(path => this.fileToGenerativePart(path)))
      
      const prompt = `${this.systemPrompt}\n\nYou are a wingman. Given:\n1. The original problem or situation: ${JSON.stringify(problemInfo, null, 2)}\n2. The current response or approach: ${currentCode}\n3. The debug information in the provided images\n\nPlease analyze the debug information and provide feedback in this JSON format:\n{
  "solution": {
    "code": "The code or main answer here.",
    "problem_statement": "Restate the problem or situation.",
    "context": "Relevant background/context.",
    "suggested_responses": ["First possible answer or action", "Second possible answer or action", "..."],
    "reasoning": "Explanation of why these suggestions are appropriate."
  }
}\nImportant: Return ONLY the JSON object, without any markdown formatting or code blocks.`

      let text: string
      if (this.useOllama) {
        const images = imageParts.map(part => part.inlineData.data)
        text = this.cleanJsonResponse(await this.callOllamaWithImages(prompt, images))
      } else {
        const result = await this.ensureGeminiModel().generateContent([prompt, ...imageParts])
        const response = await result.response
        text = this.cleanJsonResponse(response.text())
      }
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
      const mimeType = this.getAudioMimeTypeFromPath(audioPath)

      if (this.useOllama) {
        const prompt = `${this.systemPrompt}\n\nDescribe this audio clip in a short, concise answer. In addition to your main answer, suggest several possible actions or responses the user could take next based on the audio. Do not return a structured JSON object, just answer naturally as you would to a user.`
        const text = await this.callOllamaWithAudio(prompt, audioData.toString("base64"), mimeType)
        return { text, timestamp: Date.now() }
      }

      const audioPart = {
        inlineData: {
          data: audioData.toString("base64"),
          mimeType
        }
      };
      const prompt = `${this.systemPrompt}\n\nDescribe this audio clip in a short, concise answer. In addition to your main answer, suggest several possible actions or responses the user could take next based on the audio. Do not return a structured JSON object, just answer naturally as you would to a user.`;
      const result = await this.ensureGeminiModel().generateContent([prompt, audioPart]);
      const response = await result.response;
      const text = response.text();
      return { text, timestamp: Date.now() };
    } catch (error) {
      console.error("Error analyzing audio file:", error);
      throw error;
    }
  }

  public async analyzeAudioFromBase64(data: string, mimeType: string) {
    try {
      if (this.useOllama) {
        const prompt = `${this.systemPrompt}\n\nDescribe this audio clip in a short, concise answer. In addition to your main answer, suggest several possible actions or responses the user could take next based on the audio. Do not return a structured JSON object, just answer naturally as you would to a user and be concise.`
        const text = await this.callOllamaWithAudio(prompt, data, mimeType)
        return { text, timestamp: Date.now() }
      }

      const audioPart = {
        inlineData: {
          data,
          mimeType
        }
      };
      const prompt = `${this.systemPrompt}\n\nDescribe this audio clip in a short, concise answer. In addition to your main answer, suggest several possible actions or responses the user could take next based on the audio. Do not return a structured JSON object, just answer naturally as you would to a user and be concise.`;
      const result = await this.ensureGeminiModel().generateContent([prompt, audioPart]);
      const response = await result.response;
      const text = response.text();
      return { text, timestamp: Date.now() };
    } catch (error) {
      console.error("Error analyzing audio from base64:", error);
      throw error;
    }
  }

  public async analyzeImageFile(imagePath: string) {
    try {
      const imageData = await fs.promises.readFile(imagePath);
      const imageBase64 = imageData.toString("base64");
      const imagePart = {
        inlineData: {
          data: imageBase64,
          mimeType: "image/png"
        }
      };
      const prompt = `${this.systemPrompt}\n\nDescribe the content of this image in a short, concise answer. In addition to your main answer, suggest several possible actions or responses the user could take next based on the image. Do not return a structured JSON object, just answer naturally as you would to a user. Be concise and brief.`;
      let text: string;
      if (this.useOllama) {
        text = await this.callOllamaWithImages(prompt, [imageBase64]);
      } else {
        const result = await this.ensureGeminiModel().generateContent([prompt, imagePart]);
        const response = await result.response;
        text = response.text();
      }
      return { text, timestamp: Date.now() };
    } catch (error) {
      console.error("Error analyzing image file:", error);
      throw error;
    }
  }

  public async chatWithGemini(message: string): Promise<string> {
    try {
      if (this.useOllama) {
        return this.callOllama(message);
      } else if (this.model) {
        const result = await this.model.generateContent(message);
        const response = await result.response;
        return response.text();
      } else {
        throw new Error("No LLM provider configured");
      }
    } catch (error) {
      console.error("[LLMHelper] Error in chatWithGemini:", error);
      throw error;
    }
  }

  public async chat(message: string): Promise<string> {
    return this.chatWithGemini(message);
  }

  public isUsingOllama(): boolean {
    return this.useOllama;
  }

  public async getOllamaModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.ollamaUrl}/api/tags`);
      if (!response.ok) throw new Error('Failed to fetch models');

      const data: OllamaTagsResponse = await response.json();
      return data.models?.map((model) => model.name) || [];
    } catch (error) {
      console.error("[LLMHelper] Error fetching Ollama models:", error);
      return [];
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

  public getCurrentProvider(): "ollama" | "gemini" {
    return this.useOllama ? "ollama" : "gemini";
  }

  public getCurrentModel(): string {
    return this.useOllama ? this.ollamaModel : "gemini-2.0-flash";
  }

  public async switchToOllama(model?: string, url?: string): Promise<void> {
    this.useOllama = true;
    if (url) this.ollamaUrl = url;
    
    if (model) {
      this.ollamaModel = model;
    } else {
      // Auto-detect first available model
      await this.initializeOllamaModel();
    }
    
    console.log(`[LLMHelper] Switched to Ollama: ${this.ollamaModel} at ${this.ollamaUrl}`);
  }

  public async switchToGemini(apiKey?: string): Promise<void> {
    if (apiKey) {
      const genAI = new GoogleGenerativeAI(apiKey);
      this.model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    }
    
    if (!this.model && !apiKey) {
      throw new Error("No Gemini API key provided and no existing model instance");
    }
    
    this.useOllama = false;
    console.log("[LLMHelper] Switched to Gemini");
  }

  public async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      if (this.useOllama) {
        const available = await this.checkOllamaAvailable();
        if (!available) {
          return { success: false, error: `Ollama not available at ${this.ollamaUrl}` };
        }
        // Test with a simple prompt
        await this.callOllama("Hello");
        return { success: true };
      } else {
        if (!this.model) {
          return { success: false, error: "No Gemini model configured" };
        }
        // Test with a simple prompt
        const result = await this.model.generateContent("Hello");
        const response = await result.response;
        const text = response.text(); // Ensure the response is valid
        if (text) {
          return { success: true };
        } else {
          return { success: false, error: "Empty response from Gemini" };
        }
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
} 