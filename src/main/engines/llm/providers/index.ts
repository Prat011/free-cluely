/**
 * Horalix Halo - Provider Registry
 *
 * Centralized exports for all LLM providers.
 * Makes it easy to initialize and manage providers.
 */

// Provider exports
export { DeepSeekProvider, createDeepSeekProvider } from "./DeepSeekProvider"
export { OpenAIProvider, createOpenAIProvider } from "./OpenAIProvider"
export { AnthropicProvider, createAnthropicProvider } from "./AnthropicProvider"
export { GoogleProvider, createGoogleProvider } from "./GoogleProvider"
export { OllamaProvider, createOllamaProvider } from "./OllamaProvider"

// Re-export types
export type { LlmProvider, ProviderConfig } from "../types"

// Provider factory registry
import { createDeepSeekProvider } from "./DeepSeekProvider"
import { createOpenAIProvider } from "./OpenAIProvider"
import { createAnthropicProvider } from "./AnthropicProvider"
import { createGoogleProvider } from "./GoogleProvider"
import { createOllamaProvider } from "./OllamaProvider"
import type { LlmProvider, ProviderConfig } from "../types"
import type { LlmProviderId } from "../../../state/StateTypes"

/**
 * Factory function to create any provider by ID
 */
export function createProvider(
  providerId: LlmProviderId,
  config: ProviderConfig = {}
): LlmProvider {
  switch (providerId) {
    case "deepseek":
      return createDeepSeekProvider(config)
    case "openai":
      return createOpenAIProvider(config)
    case "anthropic":
      return createAnthropicProvider(config)
    case "google":
      return createGoogleProvider(config)
    case "ollama":
      return createOllamaProvider(config as any)
    default:
      throw new Error(`Unknown provider: ${providerId}`)
  }
}

/**
 * Get all available provider IDs
 */
export function getAllProviderIds(): LlmProviderId[] {
  return ["deepseek", "openai", "anthropic", "google", "ollama"]
}

/**
 * Create all providers at once
 */
export async function createAllProviders(
  configs: Partial<Record<LlmProviderId, ProviderConfig>>
): Promise<Map<LlmProviderId, LlmProvider>> {
  const providers = new Map<LlmProviderId, LlmProvider>()

  for (const providerId of getAllProviderIds()) {
    const config = configs[providerId]
    if (config) {
      try {
        const provider = createProvider(providerId, config)
        await provider.initialize(config)
        providers.set(providerId, provider)
      } catch (error) {
        console.warn(`Failed to initialize ${providerId}:`, error)
      }
    }
  }

  return providers
}
