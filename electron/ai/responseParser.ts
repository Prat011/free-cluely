import { AIValidationError } from "./errors"

export function stripCodeFences(text: string): string {
  return text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim()
}

export function parseJsonResponse<T = unknown>(text: string, provider: string): T {
  const cleaned = stripCodeFences(text)

  try {
    return JSON.parse(cleaned) as T
  } catch (error) {
    throw new AIValidationError(`Invalid JSON response from ${provider}`, provider)
  }
}

export function safeText(value: unknown): string {
  if (typeof value === "string") return value
  if (value == null) return ""
  return String(value)
}