export class AIError extends Error {
  public readonly provider?: string
  public readonly status?: number
  public readonly code?: string
  public readonly retryable: boolean

  constructor(message: string, options: { provider?: string; status?: number; code?: string; retryable?: boolean } = {}) {
    super(message)
    this.name = "AIError"
    this.provider = options.provider
    this.status = options.status
    this.code = options.code
    this.retryable = options.retryable ?? false
  }
}

export class AIValidationError extends AIError {
  constructor(message: string, provider?: string) {
    super(message, { provider, code: "INVALID_RESPONSE", retryable: false })
    this.name = "AIValidationError"
  }
}

export function isRetryableAIError(error: unknown): boolean {
  if (error instanceof AIError) {
    if (error.code === "INVALID_RESPONSE") return false
    return error.retryable || isTransientHttpStatus(error.status) || isTimeoutError(error)
  }

  if (isTimeoutError(error)) return true

  const status = getStatusFromError(error)
  if (typeof status === "number") {
    return isTransientHttpStatus(status)
  }

  const message = String((error as any)?.message || error || "").toLowerCase()
  return (
    message.includes("429") ||
    message.includes("too many requests") ||
    message.includes("quota") ||
    message.includes("rate limit") ||
    message.includes("503") ||
    message.includes("service unavailable") ||
    message.includes("500") ||
    message.includes("network") ||
    message.includes("fetch") ||
    message.includes("abort")
  )
}

export function isValidationError(error: unknown): boolean {
  return error instanceof AIValidationError || (error instanceof AIError && error.code === "INVALID_RESPONSE")
}

export function isTimeoutError(error: unknown): boolean {
  const message = String((error as any)?.message || error || "").toLowerCase()
  return message.includes("timeout") || message.includes("timed out") || message.includes("abort")
}

export function isFallbackWorthyError(error: unknown): boolean {
  if (isValidationError(error)) return true
  if (isTimeoutError(error)) return true

  if (error instanceof AIError && error.code === "UNSUPPORTED_CONTENT") {
    return true
  }

  const status = getStatusFromError(error)
  if (typeof status === "number") {
    return status === 429 || status >= 500
  }

  const message = String((error as any)?.message || error || "").toLowerCase()
  return (
    message.includes("quota") ||
    message.includes("rate limit") ||
    message.includes("service unavailable") ||
    message.includes("not found") ||
    message.includes("no longer available") ||
    message.includes("network") ||
    message.includes("fetch")
  )
}

export function getStatusFromError(error: unknown): number | undefined {
  const status = (error as any)?.status ?? (error as any)?.response?.status
  return typeof status === "number" ? status : undefined
}

function isTransientHttpStatus(status?: number): boolean {
  if (!status) return false
  return status === 408 || status === 425 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504
}