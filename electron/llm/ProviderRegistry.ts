import type { LLMProvider, ChatOptions } from "./types"

export class ProviderRegistry {
  private providers = new Map<string, LLMProvider>()
  private activeProviderId: string | null = null
  private fallbackOrder: string[] = []

  register(provider: LLMProvider): void {
    this.providers.set(provider.config.id, provider)
    if (!this.activeProviderId) {
      this.activeProviderId = provider.config.id
    }
  }

  getProvider(id: string): LLMProvider | undefined {
    return this.providers.get(id)
  }

  getProviderIds(): string[] {
    return [...this.providers.keys()]
  }

  getActiveProvider(): LLMProvider | null {
    if (!this.activeProviderId) return null
    return this.providers.get(this.activeProviderId) ?? null
  }

  setActiveProvider(id: string): void {
    if (!this.providers.has(id)) {
      throw new Error(`Provider "${id}" is not registered`)
    }
    this.activeProviderId = id
  }

  setFallbackOrder(order: string[]): void {
    this.fallbackOrder = order
  }

  getFallbackOrder(): string[] {
    return [...this.fallbackOrder]
  }

  async chat(message: string, options?: ChatOptions): Promise<string> {
    const provider = this.getActiveProvider()
    if (!provider) throw new Error("No active provider")
    return provider.chat(message, options)
  }

  async chatWithFallback(
    message: string,
    options?: ChatOptions
  ): Promise<string> {
    const order =
      this.fallbackOrder.length > 0
        ? this.fallbackOrder
        : this.getProviderIds()

    const errors: string[] = []
    for (const id of order) {
      const provider = this.providers.get(id)
      if (!provider) continue
      try {
        return await provider.chat(message, options)
      } catch (err) {
        errors.push(`${id}: ${(err as Error).message}`)
      }
    }
    throw new Error(`All providers failed: ${errors.join("; ")}`)
  }

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    const provider = this.getActiveProvider()
    if (!provider) return { success: false, error: "No active provider" }
    return provider.testConnection()
  }
}
