import { AIProviderName } from "./types"

const isDevelopment = process.env.NODE_ENV === "development"

export function logAI(event: string, details: Record<string, unknown>): void {
  if (!isDevelopment) return
  console.log(`[AI] ${event}`, JSON.stringify(details))
}

export function logProviderEvent(provider: AIProviderName, event: string, details: Record<string, unknown>): void {
  logAI(`${provider}:${event}`, details)
}