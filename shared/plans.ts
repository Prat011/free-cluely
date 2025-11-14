/**
 * Horalix Halo - Subscription Plans Configuration
 *
 * Shared configuration for all subscription tiers.
 * Used by both backend and frontend for consistency.
 */

// ============================================================================
// PLAN TYPES
// ============================================================================

export type PlanId = "free" | "plus" | "ultra"

export type BillingInterval = "monthly" | "yearly"

// ============================================================================
// PLAN FEATURES
// ============================================================================

export interface PlanFeatures {
  // Core features
  realtimeTranscription: boolean
  inMeetingButtons: boolean
  basicRecap: boolean

  // Advanced features
  factCheckButton: boolean
  advancedRecaps: boolean
  customTemplates: boolean
  exportRecaps: boolean

  // Ultra features
  multiAiEngine: boolean
  customKnowledge: boolean
  unlimitedTemplates: boolean
  priorityProcessing: boolean

  // Limits
  maxMeetingsPerWeek?: number // Only for free tier
  maxMinutesPerMeeting: number
  maxMinutesPerMonth?: number // Only for paid tiers
}

// ============================================================================
// PLAN MARKETING
// ============================================================================

export interface PlanMarketing {
  name: string
  tagline: string
  label?: string // e.g., "Most Popular", "Best for Power Users"
  microCopy?: string // e.g., "≈ $0.30/day"
  bullets: string[]
  targetUsers: string[]
}

// ============================================================================
// PLAN PRICING
// ============================================================================

export interface PlanPricing {
  monthly: number // USD
  yearly: number // USD
  yearlyMonthlyEquivalent: number // For display
  yearlySavings: string // e.g., "Save 2 months"
}

// ============================================================================
// PLAN CONFIGURATION
// ============================================================================

export interface PlanConfig {
  id: PlanId
  marketing: PlanMarketing
  pricing: PlanPricing
  features: PlanFeatures

  // Lemon Squeezy variant IDs (to be filled)
  lemonsqueezyVariantIds?: {
    monthly?: string
    yearly?: string
  }
}

// ============================================================================
// ALL PLANS
// ============================================================================

export const PLANS: Record<PlanId, PlanConfig> = {
  // ==========================================================================
  // FREE TRIAL - HALO STARTER
  // ==========================================================================
  free: {
    id: "free",
    marketing: {
      name: "Halo Starter",
      tagline: "Try your AI meeting copilot and feel the difference in one call.",
      bullets: [
        "Real-time transcription",
        "In-meeting suggestions",
        "Basic recap after each call",
        "1 trial meeting per week",
        "20 minutes maximum per meeting",
      ],
      targetUsers: ["First-time users", "Curious explorers"],
    },
    pricing: {
      monthly: 0,
      yearly: 0,
      yearlyMonthlyEquivalent: 0,
      yearlySavings: "",
    },
    features: {
      realtimeTranscription: true,
      inMeetingButtons: true,
      basicRecap: true,
      factCheckButton: false,
      advancedRecaps: false,
      customTemplates: false,
      exportRecaps: false,
      multiAiEngine: false,
      customKnowledge: false,
      unlimitedTemplates: false,
      priorityProcessing: false,
      maxMeetingsPerWeek: 1,
      maxMinutesPerMeeting: 20,
    },
  },

  // ==========================================================================
  // HALO PLUS - MOST POPULAR
  // ==========================================================================
  plus: {
    id: "plus",
    marketing: {
      name: "Halo Plus",
      tagline: "Your private AI wingman for every important call.",
      label: "Most Popular",
      microCopy: "≈ $0.30/day • Less than two coffees a month",
      bullets: [
        "Never freeze when someone asks a hard question",
        "Walk into interviews, exams and sales calls with quiet confidence",
        "Fact-check button for verifying claims",
        "Personal templates (Interview, Lecture, Sales, Consult)",
        "Smarter recaps with key points, decisions & action items",
        "Export recaps to PDF/Markdown",
        "If you have a few serious meetings per month, Halo Plus pays for itself",
      ],
      targetUsers: [
        "Students",
        "Solo founders",
        "Doctors",
        "Solo sales reps",
        "Job seekers",
      ],
    },
    pricing: {
      monthly: 9,
      yearly: 90,
      yearlyMonthlyEquivalent: 7.5,
      yearlySavings: "Save 2 months free",
    },
    features: {
      realtimeTranscription: true,
      inMeetingButtons: true,
      basicRecap: true,
      factCheckButton: true,
      advancedRecaps: true,
      customTemplates: true,
      exportRecaps: true,
      multiAiEngine: false,
      customKnowledge: false,
      unlimitedTemplates: false,
      priorityProcessing: false,
      maxMinutesPerMeeting: 90,
      maxMinutesPerMonth: 1000,
    },
    lemonsqueezyVariantIds: {
      // TODO: Fill these in after creating products in Lemon Squeezy
      monthly: "LEMON_SQUEEZY_PLUS_MONTHLY_VARIANT_ID",
      yearly: "LEMON_SQUEEZY_PLUS_YEARLY_VARIANT_ID",
    },
  },

  // ==========================================================================
  // HALO ULTRA - POWER USERS
  // ==========================================================================
  ultra: {
    id: "ultra",
    marketing: {
      name: "Halo Ultra",
      tagline: "For people who basically live in meetings and want an unfair advantage.",
      label: "Best for Power Users",
      microCopy: "Still less than one good lunch per week",
      bullets: [
        "Turn every call into a reusable playbook",
        "Never lose details from dense technical or clinical meetings",
        "Multi-AI engine (DeepSeek, OpenAI, Claude, Gemini)",
        "Custom context/knowledge uploads (docs, PDFs, scripts, CVs, protocols)",
        "Unlimited personal templates",
        "Advanced recaps with risks/objections analysis",
        "Priority processing for faster responses",
        "If calls are your job, Halo Ultra becomes your secret weapon",
      ],
      targetUsers: [
        "Founders",
        "Closers",
        "Recruiters",
        "Team leads",
        "Heavy meeting users",
        "Consultants",
      ],
    },
    pricing: {
      monthly: 19,
      yearly: 190,
      yearlyMonthlyEquivalent: 15.83,
      yearlySavings: "Save 2 months free",
    },
    features: {
      realtimeTranscription: true,
      inMeetingButtons: true,
      basicRecap: true,
      factCheckButton: true,
      advancedRecaps: true,
      customTemplates: true,
      exportRecaps: true,
      multiAiEngine: true,
      customKnowledge: true,
      unlimitedTemplates: true,
      priorityProcessing: true,
      maxMinutesPerMeeting: 120,
      maxMinutesPerMonth: 3000,
    },
    lemonsqueezyVariantIds: {
      // TODO: Fill these in after creating products in Lemon Squeezy
      monthly: "LEMON_SQUEEZY_ULTRA_MONTHLY_VARIANT_ID",
      yearly: "LEMON_SQUEEZY_ULTRA_YEARLY_VARIANT_ID",
    },
  },
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get plan configuration by ID
 */
export function getPlanConfig(planId: PlanId): PlanConfig {
  return PLANS[planId]
}

/**
 * Check if a feature is available for a plan
 */
export function hasFeature(planId: PlanId, feature: keyof PlanFeatures): boolean {
  return PLANS[planId].features[feature] === true
}

/**
 * Get all available plans as array
 */
export function getAllPlans(): PlanConfig[] {
  return Object.values(PLANS)
}

/**
 * Get paid plans only
 */
export function getPaidPlans(): PlanConfig[] {
  return getAllPlans().filter((plan) => plan.id !== "free")
}

/**
 * Check if plan is paid
 */
export function isPaidPlan(planId: PlanId): boolean {
  return planId !== "free"
}

/**
 * Get monthly price for display
 */
export function getMonthlyPrice(planId: PlanId, interval: BillingInterval): number {
  const plan = PLANS[planId]
  return interval === "monthly"
    ? plan.pricing.monthly
    : plan.pricing.yearlyMonthlyEquivalent
}

/**
 * Get total yearly price
 */
export function getYearlyPrice(planId: PlanId): number {
  return PLANS[planId].pricing.yearly
}
