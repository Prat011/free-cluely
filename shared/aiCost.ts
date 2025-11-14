/**
 * Horalix Halo - AI Cost Configuration
 *
 * Tracks AI usage costs and enforces profit-safety system.
 * Revenue per user must be at least 2x the AI cost spent on that user.
 */

// ============================================================================
// COST CONFIGURATION
// ============================================================================

/**
 * Minimum ratio of revenue to AI cost
 * Example: If user pays $9/month, max AI cost should be $4.50/month
 */
export const MIN_REVENUE_TO_COST_RATIO = 2

/**
 * AI provider cost per 1M tokens (USD)
 * TODO: Fill in actual costs from provider pricing pages
 */
export interface AiProviderCost {
  providerId: string
  inputCostPer1MTokens: number // USD
  outputCostPer1MTokens: number // USD
  label: string
  tier: "fast" | "balanced" | "premium"
}

export const AI_COSTS: Record<string, AiProviderCost> = {
  // Fast tier - Cheapest options
  "deepseek-chat": {
    providerId: "deepseek-chat",
    inputCostPer1MTokens: 0.14, // $0.14 per 1M input tokens
    outputCostPer1MTokens: 0.28, // $0.28 per 1M output tokens
    label: "DeepSeek Chat (Fast)",
    tier: "fast",
  },

  "deepseek-reasoner": {
    providerId: "deepseek-reasoner",
    inputCostPer1MTokens: 0.55, // $0.55 per 1M input tokens
    outputCostPer1MTokens: 2.19, // $2.19 per 1M output tokens
    label: "DeepSeek Reasoner (Balanced)",
    tier: "balanced",
  },

  // Balanced tier
  "gpt-4o-mini": {
    providerId: "gpt-4o-mini",
    inputCostPer1MTokens: 0.15, // TODO: Verify current OpenAI pricing
    outputCostPer1MTokens: 0.60,
    label: "GPT-4o Mini (Balanced)",
    tier: "balanced",
  },

  "gemini-2.0-flash": {
    providerId: "gemini-2.0-flash",
    inputCostPer1MTokens: 0.075, // TODO: Verify current Google pricing
    outputCostPer1MTokens: 0.30,
    label: "Gemini 2.0 Flash (Fast)",
    tier: "fast",
  },

  // Premium tier
  "gpt-4o": {
    providerId: "gpt-4o",
    inputCostPer1MTokens: 2.50, // TODO: Verify current OpenAI pricing
    outputCostPer1MTokens: 10.0,
    label: "GPT-4o (Premium)",
    tier: "premium",
  },

  "claude-sonnet-4": {
    providerId: "claude-sonnet-4",
    inputCostPer1MTokens: 3.0, // TODO: Verify current Anthropic pricing
    outputCostPer1MTokens: 15.0,
    label: "Claude Sonnet 4 (Premium)",
    tier: "premium",
  },

  // Local models (free but slower)
  ollama: {
    providerId: "ollama",
    inputCostPer1MTokens: 0,
    outputCostPer1MTokens: 0,
    label: "Ollama (Local/Free)",
    tier: "fast",
  },
}

// ============================================================================
// COST CALCULATION HELPERS
// ============================================================================

/**
 * Calculate cost for a single AI request
 */
export function calculateRequestCost(
  providerId: string,
  inputTokens: number,
  outputTokens: number
): number {
  const cost = AI_COSTS[providerId]
  if (!cost) {
    console.warn(`Unknown AI provider: ${providerId}, assuming zero cost`)
    return 0
  }

  const inputCost = (inputTokens / 1_000_000) * cost.inputCostPer1MTokens
  const outputCost = (outputTokens / 1_000_000) * cost.outputCostPer1MTokens

  return inputCost + outputCost
}

/**
 * Estimate cost for a request before making it
 * Uses rough token estimates based on content length
 */
export function estimateRequestCost(
  providerId: string,
  estimatedInputTokens: number,
  estimatedOutputTokens: number = 500 // Default assumption
): number {
  return calculateRequestCost(providerId, estimatedInputTokens, estimatedOutputTokens)
}

/**
 * Calculate maximum allowed AI spend for a user
 * Based on their monthly revenue and the safety ratio
 */
export function calculateMaxAiSpend(monthlyRevenue: number): number {
  return monthlyRevenue / MIN_REVENUE_TO_COST_RATIO
}

/**
 * Check if user can afford a new request
 */
export function canAffordRequest(
  currentSpend: number,
  maxAllowedSpend: number,
  estimatedRequestCost: number
): boolean {
  return currentSpend + estimatedRequestCost <= maxAllowedSpend
}

/**
 * Get remaining AI budget for user
 */
export function getRemainingBudget(
  currentSpend: number,
  maxAllowedSpend: number
): number {
  return Math.max(0, maxAllowedSpend - currentSpend)
}

/**
 * Get percentage of budget used
 */
export function getBudgetUsagePercent(
  currentSpend: number,
  maxAllowedSpend: number
): number {
  if (maxAllowedSpend === 0) return 100
  return Math.min(100, (currentSpend / maxAllowedSpend) * 100)
}

// ============================================================================
// FALLBACK LOGIC
// ============================================================================

/**
 * Get cheaper alternative provider when budget is tight
 */
export function getCheaperAlternative(currentProviderId: string): string | null {
  const currentCost = AI_COSTS[currentProviderId]
  if (!currentCost) return null

  // Find cheaper options
  const alternatives = Object.values(AI_COSTS).filter((cost) => {
    const avgCurrentCost =
      (currentCost.inputCostPer1MTokens + currentCost.outputCostPer1MTokens) / 2
    const avgAltCost = (cost.inputCostPer1MTokens + cost.outputCostPer1MTokens) / 2
    return avgAltCost < avgCurrentCost
  })

  if (alternatives.length === 0) return null

  // Return the cheapest option
  return alternatives.reduce((cheapest, current) => {
    const cheapestAvg =
      (cheapest.inputCostPer1MTokens + cheapest.outputCostPer1MTokens) / 2
    const currentAvg =
      (current.inputCostPer1MTokens + current.outputCostPer1MTokens) / 2
    return currentAvg < cheapestAvg ? current : cheapest
  }).providerId
}

/**
 * Get recommended provider for a plan tier
 */
export function getRecommendedProvider(planId: "free" | "plus" | "ultra"): string {
  switch (planId) {
    case "free":
      return "deepseek-chat" // Cheapest option for trials
    case "plus":
      return "deepseek-reasoner" // Balanced for regular users
    case "ultra":
      return "claude-sonnet-4" // Premium for power users
    default:
      return "deepseek-chat"
  }
}

/**
 * Get all providers for a tier
 */
export function getProvidersForTier(tier: "fast" | "balanced" | "premium"): string[] {
  return Object.values(AI_COSTS)
    .filter((cost) => cost.tier === tier)
    .map((cost) => cost.providerId)
}

// ============================================================================
// USAGE TRACKING
// ============================================================================

/**
 * AI usage record structure
 */
export interface AiUsageRecord {
  id: string
  userId: string
  providerId: string
  inputTokens: number
  outputTokens: number
  costUSD: number
  context: "transcription" | "suggestion" | "recap" | "fact-check" | "custom"
  createdAt: number
}

/**
 * Create a usage record
 */
export function createUsageRecord(
  userId: string,
  providerId: string,
  inputTokens: number,
  outputTokens: number,
  context: AiUsageRecord["context"]
): AiUsageRecord {
  return {
    id: `usage_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    userId,
    providerId,
    inputTokens,
    outputTokens,
    costUSD: calculateRequestCost(providerId, inputTokens, outputTokens),
    context,
    createdAt: Date.now(),
  }
}
