import { AIError, isFallbackWorthyError, isRetryableAIError } from "./errors"
import { logAI } from "./logger"
import { AIProvider, AIProviderName, AIRequest, AIResult, AIStreamChunk } from "./types"

export interface ProviderManagerConfig {
  primaryProvider: AIProviderName
  fallbackProvider: AIProviderName
  groq?: AIProvider | null
  gemini?: AIProvider | null
  timeoutMs: number
}

export interface GenerateOptions {
  timeoutMs?: number
  validate?: (text: string) => void
}

export class ProviderManager {
  private readonly providers = new Map<AIProviderName, AIProvider>()
  private primaryProvider: AIProviderName
  private fallbackProvider: AIProviderName
  private readonly timeoutMs: number

  constructor(config: ProviderManagerConfig) {
    if (config.groq) this.providers.set(config.groq.providerName, config.groq)
    if (config.gemini) this.providers.set(config.gemini.providerName, config.gemini)
    this.primaryProvider = config.primaryProvider
    this.fallbackProvider = config.fallbackProvider
    this.timeoutMs = config.timeoutMs
  }

  public getProviderNames(): AIProviderName[] {
    return [...this.providers.keys()]
  }

  public getPrimaryProvider(): AIProviderName {
    return this.primaryProvider
  }

  public getFallbackProvider(): AIProviderName {
    return this.fallbackProvider
  }

  public setPrimaryProvider(providerName: AIProviderName): void {
    this.primaryProvider = providerName
  }

  public async health(): Promise<Array<{ provider: AIProviderName; ok: boolean; model?: string; message?: string }>> {
    const checks: Array<{ provider: AIProviderName; ok: boolean; model?: string; message?: string }> = []
    for (const provider of this.providers.values()) {
      const result = await provider.health()
      checks.push(result)
    }
    return checks
  }

  public async generate(request: AIRequest, options?: GenerateOptions): Promise<AIResult> {
    const providerOrder = this.getProviderOrder()
    let lastError: unknown = null

    for (const providerName of providerOrder) {
      const provider = this.providers.get(providerName)
      if (!provider) continue

      try {
        const result = await this.executeWithRetry(provider, request, options)
        if (options?.validate) {
          options.validate(result.text)
        }

        if (providerName !== this.primaryProvider) {
          logAI("fallback-used", { primaryProvider: this.primaryProvider, fallbackProvider: providerName, model: result.model, latencyMs: result.latencyMs })
        }

        return result
      } catch (error) {
        lastError = error

        if (!isFallbackWorthyError(error)) {
          throw error
        }

        logAI("provider-failed", {
          provider: providerName,
          primaryProvider: this.primaryProvider,
          error: String((error as any)?.message || error),
          fallbackPlanned: providerName === this.primaryProvider && providerOrder.length > 1
        })

        if (providerName === this.primaryProvider) {
          continue
        }
      }
    }

    throw lastError instanceof Error ? lastError : new AIError("All AI providers failed", { retryable: false })
  }

  public async *stream(request: AIRequest, options?: GenerateOptions): AsyncGenerator<AIStreamChunk, AIResult, void> {
    const providerOrder = this.getProviderOrder()
    let lastError: unknown = null

    for (const providerName of providerOrder) {
      const provider = this.providers.get(providerName)
      if (!provider) continue

      try {
        const iterator = provider.stream(request, { timeoutMs: options?.timeoutMs || this.timeoutMs })
        let step = await iterator.next()
        while (!step.done) {
          const chunk = step.value
          if (chunk.text) {
            yield chunk
          }
          step = await iterator.next()
        }

        const finalResult = step.value
        if (!finalResult) {
          throw new AIError(`Provider ${providerName} did not return a final result`, {
            provider: providerName,
            code: "INVALID_RESPONSE",
            retryable: false
          })
        }

        return finalResult
      } catch (error) {
        lastError = error
        if (!isFallbackWorthyError(error)) {
          throw error
        }
        if (providerName === this.primaryProvider) {
          continue
        }
      }
    }

    throw lastError instanceof Error ? lastError : new AIError("All AI providers failed", { retryable: false })
  }

  private getProviderOrder(): AIProviderName[] {
    const order: AIProviderName[] = []
    if (this.primaryProvider) order.push(this.primaryProvider)
    if (this.fallbackProvider && this.fallbackProvider !== this.primaryProvider) order.push(this.fallbackProvider)
    return order
  }

  private async executeWithRetry(provider: AIProvider, request: AIRequest, options?: GenerateOptions): Promise<AIResult> {
    const timeoutMs = options?.timeoutMs || this.timeoutMs
    let lastError: unknown = null

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const result = await provider.generate(request, { timeoutMs })
        return result
      } catch (error) {
        lastError = error
        if (!isRetryableAIError(error) || attempt === 2) {
          break
        }
      }
    }

    throw lastError instanceof Error ? lastError : new AIError("AI provider request failed", { retryable: false })
  }
}