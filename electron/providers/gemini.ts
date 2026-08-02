import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai"
import { AIError } from "../ai/errors"
import { logProviderEvent } from "../ai/logger"
import { AIHealthResult, AIInputAttachment, AIProvider, AIProviderName, AIRequest, AIResult, AIStreamChunk } from "../ai/types"

const DEFAULT_GEMINI_MODEL = process.env.MODEL_GEMINI || "gemini-3.5-flash-lite"

function toGenerativePart(attachment: AIInputAttachment) {
  return {
    inlineData: {
      data: attachment.data,
      mimeType: attachment.mimeType
    }
  }
}

function extractTextFromResult(result: any): string {
  const response = result?.response ?? result
  return response?.text?.() || response?.candidates?.[0]?.content?.parts?.map((part: any) => part.text || "").join("") || ""
}

export class GeminiProvider implements AIProvider {
  public readonly providerName: AIProviderName = "gemini"
  private readonly client: GoogleGenerativeAI
  private readonly modelName: string

  constructor(apiKey: string, options?: { modelName?: string }) {
    this.client = new GoogleGenerativeAI(apiKey)
    this.modelName = options?.modelName || DEFAULT_GEMINI_MODEL
  }

  public async health(): Promise<AIHealthResult> {
    return {
      ok: true,
      provider: this.providerName,
      model: this.modelName,
      message: "Gemini client initialized"
    }
  }

  public async generate(request: AIRequest, options?: { timeoutMs?: number; signal?: AbortSignal }): Promise<AIResult> {
    const startedAt = Date.now()
    const model = this.client.getGenerativeModel({ model: this.modelName })
    const contents = this.buildContents(request)

    try {
      const result = await this.withTimeout(model.generateContent(contents), options?.timeoutMs)
      const text = extractTextFromResult(result)
      if (!text) {
        throw new AIError(`Gemini returned an empty response for model ${this.modelName}`, { provider: this.providerName, code: "INVALID_RESPONSE", retryable: false })
      }

      const usage = (result as any)?.response?.usageMetadata || (result as any)?.usageMetadata
      logProviderEvent(this.providerName, "generate", {
        model: this.modelName,
        latencyMs: Date.now() - startedAt,
        inputTokens: usage?.promptTokenCount,
        outputTokens: usage?.candidatesTokenCount
      })

      return {
        text,
        provider: this.providerName,
        model: this.modelName,
        latencyMs: Date.now() - startedAt,
        inputTokens: usage?.promptTokenCount,
        outputTokens: usage?.candidatesTokenCount
      }
    } catch (error: any) {
      const status = error?.status || error?.response?.status
      const retryable = status === 429 || status === 500 || status === 502 || status === 503 || status === 504
      const normalized = error instanceof AIError ? error : new AIError(String(error?.message || error || "Gemini request failed"), { provider: this.providerName, status, code: "GEMINI_REQUEST_FAILED", retryable })
      throw normalized
    }
  }

  public async *stream(request: AIRequest, options?: { timeoutMs?: number; signal?: AbortSignal }): AsyncGenerator<AIStreamChunk, AIResult, void> {
    const startedAt = Date.now()
    const model = this.client.getGenerativeModel({ model: this.modelName })
    const contents = this.buildContents(request)

    try {
      const response = await this.withTimeout(model.generateContentStream(contents), options?.timeoutMs)
      let aggregated = ""
      for await (const chunk of response.stream as any) {
        const text = chunk?.text?.() || ""
        if (text) {
          aggregated += text
          yield { text, provider: this.providerName, model: this.modelName }
        }
      }

      const result: AIResult = {
        text: aggregated,
        provider: this.providerName,
        model: this.modelName,
        latencyMs: Date.now() - startedAt
      }
      logProviderEvent(this.providerName, "stream", { model: this.modelName, latencyMs: result.latencyMs })
      return result
    } catch (error: any) {
      const status = error?.status || error?.response?.status
      const retryable = status === 429 || status === 500 || status === 502 || status === 503 || status === 504
      throw error instanceof AIError ? error : new AIError(String(error?.message || error || "Gemini stream failed"), { provider: this.providerName, status, code: "GEMINI_STREAM_FAILED", retryable })
    }
  }

  private buildContents(request: AIRequest): any[] | string {
    if (!request.attachments || request.attachments.length === 0) {
      return request.systemPrompt ? `${request.systemPrompt}\n\n${request.prompt}` : request.prompt
    }

    const promptParts = []
    if (request.systemPrompt) {
      promptParts.push({ text: request.systemPrompt })
    }
    promptParts.push({ text: request.prompt })
    for (const attachment of request.attachments) {
      promptParts.push(toGenerativePart(attachment))
    }
    return promptParts
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs?: number): Promise<T> {
    const effectiveTimeout = timeoutMs || Number(process.env.TIMEOUT_MS) || 30000
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined
    try {
      const timeoutPromise = new Promise<T>((_, reject) => {
        timeoutHandle = setTimeout(() => reject(new AIError(`Gemini request timed out after ${effectiveTimeout}ms`, { provider: this.providerName, code: "TIMEOUT", retryable: true, status: 408 })), effectiveTimeout)
      })
      return await Promise.race([promise, timeoutPromise])
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle)
    }
  }
}