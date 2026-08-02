import Groq from "groq-sdk"
import { AIError } from "../ai/errors"
import { logProviderEvent } from "../ai/logger"
import { AIHealthResult, AIInputAttachment, AIProvider, AIProviderName, AIRequest, AIResult, AIStreamChunk } from "../ai/types"

const DEFAULT_GROQ_MODEL = process.env.MODEL_GROQ || "qwen/qwen3-coder"
const GROQ_MODEL_FALLBACK_1 = process.env.MODEL_GROQ_FALLBACK_1 || "llama-3.3-70b-versatile"
const GROQ_MODEL_FALLBACK_2 = process.env.MODEL_GROQ_FALLBACK_2 || "kimi-k2"
const DEFAULT_TIMEOUT_MS = Number(process.env.TIMEOUT_MS) || 30000

function readCandidateModels(): string[] {
  const envList = process.env.MODEL_GROQ_CANDIDATES
  const candidates = envList ? envList.split(",").map((value) => value.trim()).filter(Boolean) : [DEFAULT_GROQ_MODEL, GROQ_MODEL_FALLBACK_1, GROQ_MODEL_FALLBACK_2]
  return [...new Set(candidates)]
}

function isUnavailableModelError(error: any): boolean {
  const message = String(error?.message || error || "").toLowerCase()
  return error?.status === 404 || message.includes("not found") || message.includes("no longer available")
}

function isTimeoutError(error: any): boolean {
  const message = String(error?.message || error || "").toLowerCase()
  return message.includes("timeout") || message.includes("timed out") || message.includes("abort")
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, abort?: AbortController): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined
  try {
    const timeoutPromise = new Promise<T>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        abort?.abort()
        reject(new AIError(`Groq request timed out after ${timeoutMs}ms`, { provider: "groq", code: "TIMEOUT", retryable: true, status: 408 }))
      }, timeoutMs)
    })

    return await Promise.race([promise, timeoutPromise])
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle)
  }
}

function toTextAttachmentError(): AIError {
  return new AIError("Groq provider currently supports text-only prompts for the selected model. Falling back to Gemini for multimodal input.", {
    provider: "groq",
    code: "UNSUPPORTED_CONTENT",
    retryable: false
  })
}

export class GroqProvider implements AIProvider {
  public readonly providerName: AIProviderName = "groq"
  private readonly client: Groq
  private readonly modelCandidates: string[]
  private readonly timeoutMs: number

  constructor(apiKey: string, options?: { modelCandidates?: string[]; timeoutMs?: number }) {
    this.client = new Groq({ apiKey })
    this.modelCandidates = options?.modelCandidates?.length ? options.modelCandidates : readCandidateModels()
    this.timeoutMs = options?.timeoutMs || DEFAULT_TIMEOUT_MS
  }

  public async health(): Promise<AIHealthResult> {
    return {
      ok: true,
      provider: this.providerName,
      model: this.modelCandidates[0],
      message: "Groq client initialized"
    }
  }

  public async generate(request: AIRequest, options?: { timeoutMs?: number; signal?: AbortSignal }): Promise<AIResult> {
    if (request.attachments && request.attachments.length > 0) {
      throw toTextAttachmentError()
    }

    const timeoutMs = options?.timeoutMs || this.timeoutMs
    const startedAt = Date.now()
    let lastError: unknown

    for (const model of this.modelCandidates) {
      try {
        const abortController = new AbortController()
        const maybeSignal = options?.signal || abortController.signal
        const response = await withTimeout(
          this.client.chat.completions.create(
            {
              model,
              messages: this.buildMessages(request),
              temperature: request.temperature ?? 0.2,
              max_tokens: request.maxTokens,
              stream: false
            } as any,
            { signal: maybeSignal }
          ),
          timeoutMs,
          abortController
        )

        const text = response.choices?.[0]?.message?.content
        if (!text) {
          throw new AIError(`Groq returned an empty response for model ${model}`, { provider: this.providerName, code: "INVALID_RESPONSE", retryable: false })
        }

        const usage = (response as any).usage
        logProviderEvent(this.providerName, "generate", {
          model,
          latencyMs: Date.now() - startedAt,
          inputTokens: usage?.prompt_tokens,
          outputTokens: usage?.completion_tokens,
          fallbackUsed: model !== this.modelCandidates[0]
        })

        return {
          text,
          provider: this.providerName,
          model,
          latencyMs: Date.now() - startedAt,
          inputTokens: usage?.prompt_tokens,
          outputTokens: usage?.completion_tokens
        }
      } catch (error: any) {
        lastError = error
        if (isUnavailableModelError(error)) {
          continue
        }
        if (isTimeoutError(error)) {
          throw new AIError(`Groq request timed out after ${timeoutMs}ms`, { provider: this.providerName, code: "TIMEOUT", retryable: true, status: 408 })
        }
        throw this.normalizeError(error, model)
      }
    }

    throw this.normalizeError(lastError, this.modelCandidates[0])
  }

  public async *stream(request: AIRequest, options?: { timeoutMs?: number; signal?: AbortSignal }): AsyncGenerator<AIStreamChunk, AIResult, void> {
    if (request.attachments && request.attachments.length > 0) {
      throw toTextAttachmentError()
    }

    const timeoutMs = options?.timeoutMs || this.timeoutMs
    const startedAt = Date.now()

    for (const model of this.modelCandidates) {
      try {
        const abortController = new AbortController()
        const maybeSignal = options?.signal || abortController.signal
        const stream = await withTimeout(
          this.client.chat.completions.create(
            {
              model,
              messages: this.buildMessages(request),
              temperature: request.temperature ?? 0.2,
              max_tokens: request.maxTokens,
              stream: true
            } as any,
            { signal: maybeSignal }
          ),
          timeoutMs,
          abortController
        )

        let aggregated = ""
        for await (const chunk of stream as any) {
          const text = chunk?.choices?.[0]?.delta?.content || ""
          if (text) {
            aggregated += text
            yield { text, provider: this.providerName, model }
          }
        }

        const result: AIResult = {
          text: aggregated,
          provider: this.providerName,
          model,
          latencyMs: Date.now() - startedAt
        }
        logProviderEvent(this.providerName, "stream", { model, latencyMs: result.latencyMs })
        return result
      } catch (error: any) {
        if (isUnavailableModelError(error)) {
          continue
        }
        throw this.normalizeError(error, model)
      }
    }

    throw this.normalizeError(new Error("No Groq model available"), this.modelCandidates[0])
  }

  private buildMessages(request: AIRequest) {
    const messages: Array<{ role: "system" | "user"; content: any }> = []
    if (request.systemPrompt) {
      messages.push({ role: "system", content: request.systemPrompt })
    }

    if (!request.attachments || request.attachments.length === 0) {
      messages.push({ role: "user", content: request.prompt })
      return messages
    }

    messages.push({ role: "user", content: request.prompt })
    return messages
  }

  private normalizeError(error: unknown, model: string): AIError {
    if (error instanceof AIError) {
      return error
    }

    const status = (error as any)?.status ?? (error as any)?.response?.status
    const message = String((error as any)?.message || error || "Groq request failed")
    const retryable = status === 429 || status === 500 || status === 502 || status === 503 || status === 504 || isTimeoutError(error)
    return new AIError(message, { provider: this.providerName, status, code: "GROQ_REQUEST_FAILED", retryable })
  }
}