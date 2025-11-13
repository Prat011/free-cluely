/**
 * Horalix Halo - Answer Type System
 *
 * Provides user control over response style and format.
 * This is a premium feature that makes responses more useful.
 */

import { AnswerType, AnswerTypeConfig } from "../../../state/StateTypes"

// ============================================================================
// ANSWER TYPE PROMPT SUFFIXES
// ============================================================================

export const ANSWER_TYPE_PROMPTS: Record<AnswerType, string> = {
  auto: `Respond in whatever format best suits the question. Use your judgment.`,

  short: `**Response Format: SHORT**

Provide a concise, direct answer in 2-4 sentences maximum.
- Get straight to the point
- No unnecessary elaboration
- Focus on the most important information
- If code is needed, show only the essential part`,

  detailed: `**Response Format: DETAILED**

Provide a comprehensive, thorough answer that covers all relevant aspects.
- Explain the reasoning and context
- Include examples and edge cases
- Cover potential gotchas and best practices
- Provide additional resources or next steps when relevant`,

  "step-by-step": `**Response Format: STEP-BY-STEP**

Break down your answer into clear, numbered steps:
1. Start with the first action to take
2. Continue with each subsequent step
3. Make each step actionable and specific
4. End with verification or next steps

Use this format:
**Step 1: [Action]**
[Explanation]

**Step 2: [Action]**
[Explanation]

etc.`,

  checklist: `**Response Format: CHECKLIST**

Present your answer as an actionable checklist with checkboxes:

- [ ] First action item with clear description
- [ ] Second action item
  - [ ] Sub-item if needed for complex tasks
- [ ] Third action item

Each item should be:
- Specific and actionable
- Completable in one sitting
- Ordered logically`,

  "code-only": `**Response Format: CODE-ONLY**

Provide only code with minimal commentary:
- No lengthy explanations
- Just essential inline comments
- Working, production-ready code
- Brief setup notes only if absolutely necessary

Example format:
\`\`\`typescript
// Brief comment if needed
code here
\`\`\`

Brief usage note (1 line max) if necessary.`,

  "explain-simple": `**Response Format: EXPLAIN LIKE I'M 12**

Explain the concept in very simple, accessible language:
- Use everyday analogies and examples
- Avoid jargon and technical terms (or explain them simply)
- Use relatable comparisons
- Make it engaging and easy to understand
- Assume no prior technical knowledge`,

  "bullet-points": `**Response Format: BULLET POINTS**

Present your answer as concise bullet points:
- One main idea per bullet
- Keep each bullet to 1-2 sentences
- Use sub-bullets for supporting details
  - Like this for additional context
- Prioritize the most important points first`,

  "pros-cons": `**Response Format: PROS & CONS**

Present your answer in a balanced pros and cons format:

**Pros:**
- ✅ First advantage
- ✅ Second advantage
- ✅ Third advantage

**Cons:**
- ❌ First disadvantage
- ❌ Second disadvantage
- ❌ Third disadvantage

**Recommendation:**
[Your balanced recommendation based on the analysis]`,
}

// ============================================================================
// ANSWER TYPE CONFIGURATIONS
// ============================================================================

export const ANSWER_TYPE_CONFIGS: Record<AnswerType, AnswerTypeConfig> = {
  auto: {
    id: "auto",
    label: "Auto",
    description: "Let AI choose the best format",
    icon: "✨",
    systemPromptSuffix: ANSWER_TYPE_PROMPTS.auto,
  },
  short: {
    id: "short",
    label: "Short",
    description: "Concise 2-4 sentence answer",
    icon: "⚡",
    systemPromptSuffix: ANSWER_TYPE_PROMPTS.short,
  },
  detailed: {
    id: "detailed",
    label: "Detailed",
    description: "Comprehensive explanation",
    icon: "📚",
    systemPromptSuffix: ANSWER_TYPE_PROMPTS.detailed,
  },
  "step-by-step": {
    id: "step-by-step",
    label: "Step-by-Step",
    description: "Numbered action steps",
    icon: "🪜",
    systemPromptSuffix: ANSWER_TYPE_PROMPTS["step-by-step"],
    defaultMode: ["coding", "research"],
  },
  checklist: {
    id: "checklist",
    label: "Checklist",
    description: "Actionable checkbox list",
    icon: "☑️",
    systemPromptSuffix: ANSWER_TYPE_PROMPTS.checklist,
    defaultMode: ["coding"],
  },
  "code-only": {
    id: "code-only",
    label: "Code Only",
    description: "Just the code, minimal explanation",
    icon: "💻",
    systemPromptSuffix: ANSWER_TYPE_PROMPTS["code-only"],
    defaultMode: ["coding"],
  },
  "explain-simple": {
    id: "explain-simple",
    label: "Simple",
    description: "Explain like I'm 12",
    icon: "🎯",
    systemPromptSuffix: ANSWER_TYPE_PROMPTS["explain-simple"],
  },
  "bullet-points": {
    id: "bullet-points",
    label: "Bullets",
    description: "Concise bullet point list",
    icon: "•",
    systemPromptSuffix: ANSWER_TYPE_PROMPTS["bullet-points"],
  },
  "pros-cons": {
    id: "pros-cons",
    label: "Pros & Cons",
    description: "Balanced analysis",
    icon: "⚖️",
    systemPromptSuffix: ANSWER_TYPE_PROMPTS["pros-cons"],
  },
}

// ============================================================================
// ANSWER TYPE UTILITIES
// ============================================================================

/**
 * Get the system prompt suffix for a given answer type
 */
export function getAnswerTypePrompt(answerType: AnswerType): string {
  return ANSWER_TYPE_PROMPTS[answerType] || ANSWER_TYPE_PROMPTS.auto
}

/**
 * Get the full configuration for an answer type
 */
export function getAnswerTypeConfig(answerType: AnswerType): AnswerTypeConfig {
  return ANSWER_TYPE_CONFIGS[answerType] || ANSWER_TYPE_CONFIGS.auto
}

/**
 * Get recommended answer types for a given mode
 */
export function getRecommendedAnswerTypes(mode: string): AnswerType[] {
  const recommendations: Record<string, AnswerType[]> = {
    coding: ["code-only", "step-by-step", "checklist", "short"],
    meeting: ["short", "bullet-points", "pros-cons"],
    research: ["detailed", "bullet-points", "step-by-step"],
    auto: ["auto", "short", "detailed"],
  }

  return recommendations[mode] || ["auto", "short", "detailed"]
}

/**
 * Suggest optimal max tokens based on answer type
 */
export function getSuggestedMaxTokens(answerType: AnswerType): number {
  const tokenLimits: Record<AnswerType, number> = {
    auto: 2048,
    short: 512,
    detailed: 4096,
    "step-by-step": 3072,
    checklist: 2048,
    "code-only": 3072,
    "explain-simple": 2048,
    "bullet-points": 1536,
    "pros-cons": 2048,
  }

  return tokenLimits[answerType] || 2048
}

/**
 * Suggest optimal temperature based on answer type
 */
export function getSuggestedTemperature(answerType: AnswerType): number {
  const temperatures: Record<AnswerType, number> = {
    auto: 0.7,
    short: 0.5,           // Lower for concise accuracy
    detailed: 0.7,
    "step-by-step": 0.4,  // Lower for structured output
    checklist: 0.4,       // Lower for structured output
    "code-only": 0.2,     // Very low for code
    "explain-simple": 0.8, // Higher for creative analogies
    "bullet-points": 0.5,
    "pros-cons": 0.6,
  }

  return temperatures[answerType] || 0.7
}

/**
 * Get all answer type options for UI display
 */
export function getAllAnswerTypes(): AnswerTypeConfig[] {
  return Object.values(ANSWER_TYPE_CONFIGS)
}

// ============================================================================
// ANSWER TYPE VALIDATION
// ============================================================================

/**
 * Validate that a response matches the expected answer type format
 * (Optional quality control feature)
 */
export function validateAnswerType(
  response: string,
  answerType: AnswerType
): { valid: boolean; issues?: string[] } {
  const issues: string[] = []

  switch (answerType) {
    case "short":
      // Check if response is roughly 2-4 sentences
      const sentences = response.split(/[.!?]+/).filter((s) => s.trim().length > 0)
      if (sentences.length > 6) {
        issues.push("Response is longer than expected for 'short' format")
      }
      break

    case "step-by-step":
      // Check for numbered steps
      if (!response.match(/\*\*Step \d+:/i) && !response.match(/^\d+\./m)) {
        issues.push("Response doesn't contain numbered steps")
      }
      break

    case "checklist":
      // Check for checkbox format
      if (!response.includes("- [ ]") && !response.includes("- [x]")) {
        issues.push("Response doesn't contain checklist items")
      }
      break

    case "code-only":
      // Check that most of response is code blocks
      const codeBlocks = response.match(/```[\s\S]*?```/g) || []
      const codeLength = codeBlocks.join("").length
      const totalLength = response.length
      if (codeLength < totalLength * 0.5) {
        issues.push("Response should be mostly code with minimal explanation")
      }
      break

    case "pros-cons":
      // Check for pros and cons sections
      if (!response.match(/\*\*Pros/i) || !response.match(/\*\*Cons/i)) {
        issues.push("Response should have clear Pros and Cons sections")
      }
      break

    case "bullet-points":
      // Check for bullet points
      if (!response.match(/^[-*•]/m)) {
        issues.push("Response should use bullet point format")
      }
      break
  }

  return {
    valid: issues.length === 0,
    issues: issues.length > 0 ? issues : undefined,
  }
}
