/**
 * Horalix Halo - Meeting Prompt Builder
 *
 * Specialized prompt engineering for meeting scenarios.
 * This is what makes Horalix Halo exceptional for live meetings.
 */

import {
  MeetingActionType,
  MeetingContext,
  SessionMode,
} from "../../../state/StateTypes"
import {
  MeetingPromptOptions,
  MeetingPromptResult,
  TimeWindow,
} from "../types"
import { BASE_SYSTEM_PROMPT } from "./modes"

// ============================================================================
// MEETING ACTION BASE PROMPT
// ============================================================================

const MEETING_BASE_PROMPT = `${BASE_SYSTEM_PROMPT}

**Current Context: MEETING ASSISTANCE**

You are helping the user during a live meeting or conversation. You have access to:
- A real-time transcript of what's being said
- Context about who's in the meeting and what the goals are
- The user's role and constraints

**Critical Ethics:**
- Help the user communicate THEIR OWN thoughts more effectively
- NEVER suggest the user misrepresent their knowledge or capabilities
- NEVER encourage deception or cheating
- Respect all meeting participants
- The user should only say things they genuinely believe or can authentically deliver

Your role is to be an intelligent assistant that helps the user think clearly and communicate effectively in the moment.`

// ============================================================================
// ACTION-SPECIFIC PROMPTS
// ============================================================================

const MEETING_ACTION_PROMPTS: Record<MeetingActionType, string> = {
  say: `${MEETING_BASE_PROMPT}

**Action: What Should I Say?**

The user needs a suggestion for what to say RIGHT NOW in the conversation.

Provide 2-3 SHORT options (1-3 sentences each) that the user could say next. Each option should:
- Be natural and conversational (match the meeting tone)
- Align with the user's role and the meeting goals
- Move the conversation forward productively
- Feel authentic to what the user would actually say
- Consider what was just said in the transcript

Format your response as:

**Option 1:** [First suggestion - direct and simple]

**Option 2:** [Second suggestion - alternative approach]

**Option 3 (optional):** [Third suggestion if valuable]

Keep it brief and actionable. The user needs to respond soon.`,

  followups: `${MEETING_BASE_PROMPT}

**Action: Generate Follow-Up Questions**

The user wants intelligent follow-up questions to ask in the meeting.

Provide 3-7 insightful follow-up questions that:
- Build on what's been discussed
- Fill gaps in understanding
- Move toward the meeting goals
- Are specific and concrete (not vague)
- Haven't already been answered in the transcript

Prioritize questions that:
1. Clarify critical unknowns
2. Uncover potential issues or risks
3. Explore alternatives or options
4. Drive toward actionable next steps

Format:
**Follow-Up Questions:**

1. [Most important question - specific and concrete]
2. [Second question]
3. [Third question]
...

Avoid generic questions. Make them specific to this conversation.`,

  factcheck: `${MEETING_BASE_PROMPT}

**Action: Fact Check**

The user wants to verify claims made in the meeting.

Review the transcript and identify statements that:
- Can be fact-checked against known information
- May need verification
- Contain specific claims about data, timelines, capabilities, etc.

For each claim, provide:
- The claim being made
- Your assessment (Verified / Likely True / Uncertain / Likely False / Cannot Verify)
- Brief explanation and any relevant caveats
- Suggested verification steps if uncertain

Format:
**Fact Check Results:**

**Claim:** "[Quote from transcript]"
**Assessment:** [Your assessment]
**Details:** [Brief explanation]
**Verification:** [How to verify if needed]

---

**Important:**
- Only fact-check verifiable claims (not opinions)
- Express appropriate uncertainty
- Don't make up facts
- Suggest verification for high-stakes claims`,

  recap: `${MEETING_BASE_PROMPT}

**Action: Recap Meeting**

The user wants a summary of the conversation so far.

Provide a clear, organized recap that covers:

**Key Points Discussed:**
- Main topics covered (bullet points)
- Important context or background shared

**Decisions Made:**
- Concrete decisions or agreements (if any)
- Who's responsible for what

**Action Items:**
- Clear next steps identified
- Owners and deadlines (if mentioned)

**Open Questions:**
- Unresolved issues or questions
- Areas needing follow-up

**Important Context:**
- Key constraints or considerations
- Stakeholder concerns or priorities

Be concise but complete. Focus on what's actionable and what the user needs to remember.`,

  decisions: `${MEETING_BASE_PROMPT}

**Action: Extract Decisions**

The user wants a clear list of decisions made in the meeting.

Extract ONLY the concrete decisions and commitments from the transcript.

For each decision:
- What was decided
- Who's responsible (if mentioned)
- Deadline or timeline (if mentioned)
- Any conditions or caveats

Format:
**Decisions Made:**

1. **[Decision]**
   - Responsible: [Person/team]
   - Deadline: [Date/timeframe]
   - Notes: [Any important caveats]

2. **[Next decision]**
   ...

If no clear decisions were made, say so clearly.
Don't invent or infer decisions that weren't explicitly made.`,

  email: `${MEETING_BASE_PROMPT}

**Action: Draft Follow-Up Email**

The user wants a draft follow-up email to send after the meeting.

Create a professional, concise follow-up email that:
- Thanks participants
- Summarizes key points
- Lists decisions and action items
- Notes next steps and timeline
- Maintains appropriate tone for the context

Format:
**Subject:** [Clear, specific subject line]

**Email:**

Hi [recipients],

[Opening - thank you and brief context]

[Key points or decisions from the meeting]

[Action items with owners and deadlines]

[Next steps or meeting scheduling]

[Closing]

Best,
[User's name]

---

Keep it professional but not overly formal. Match the tone of the meeting.`,

  "action-items": `${MEETING_BASE_PROMPT}

**Action: Extract Action Items**

The user wants a clear list of action items from the meeting.

Extract all action items mentioned in the transcript.

For each action item:
- Clear description of what needs to be done
- Who's responsible (if mentioned)
- Deadline (if mentioned)
- Dependencies or blockers (if any)

Format:
**Action Items:**

- [ ] **[Action description]**
  - Owner: [Person/team]
  - Deadline: [Date/timeframe]
  - Status: [Not started / Depends on X]

- [ ] **[Next action]**
  ...

Present in priority order. Use checkboxes for easy tracking.`,

  "key-points": `${MEETING_BASE_PROMPT}

**Action: Extract Key Points**

The user wants the most important takeaways from the conversation.

Identify 3-7 key points that are:
- Most important to remember
- Critical for decision-making
- Essential context for next steps
- Likely to be referenced later

Format:
**Key Points:**

1. **[First key point]** - [Why it matters]
2. **[Second key point]** - [Why it matters]
3. **[Third key point]** - [Why it matters]
...

Focus on substance over process. What actually matters?`,

  clarify: `${MEETING_BASE_PROMPT}

**Action: Ask Clarifying Question**

The user wants to ask a clarifying question about something that's unclear.

Review the transcript and identify:
- Ambiguous statements
- Unclear commitments or expectations
- Missing details or context
- Potential misunderstandings

Suggest 2-3 clarifying questions the user could ask, such as:

**Suggested Clarifying Questions:**

1. **"[Question]"** - To clarify [what this addresses]
2. **"[Question]"** - To ensure alignment on [topic]
3. **"[Question]"** - To understand [specific detail]

Make questions specific and diplomatic. Help ensure everyone's on the same page.`,
}

// ============================================================================
// MEETING CONTEXT FORMATTER
// ============================================================================

/**
 * Format meeting context into a clear prompt section
 */
function formatMeetingContext(context?: MeetingContext): string {
  if (!context) {
    return "**Meeting Context:** (No additional context provided)"
  }

  const parts: string[] = []

  if (context.title) {
    parts.push(`**Meeting:** ${context.title}`)
  }

  if (context.participants && context.participants.length > 0) {
    parts.push(`**Participants:** ${context.participants.join(", ")}`)
  }

  if (context.userRole) {
    parts.push(`**Your Role:** ${context.userRole}`)
  }

  if (context.userCompany) {
    parts.push(`**Your Organization:** ${context.userCompany}`)
  }

  if (context.goals) {
    parts.push(`**Meeting Goals:** ${context.goals}`)
  }

  if (context.constraints) {
    parts.push(`**Constraints:** ${context.constraints}`)
  }

  if (context.languageTone) {
    parts.push(`**Communication Style:** ${context.languageTone}`)
  }

  if (context.customContext) {
    parts.push(`**Additional Context:** ${context.customContext}`)
  }

  return parts.length > 0
    ? parts.join("\n")
    : "**Meeting Context:** (No additional context provided)"
}

/**
 * Format time window for the prompt
 */
function formatTimeWindow(window?: TimeWindow): string {
  if (!window) return ""

  return `**Time Window:** Last ${window.durationMinutes} minutes of conversation`
}

/**
 * Format session memory (summary of earlier context)
 */
function formatSessionMemory(memory?: string): string {
  if (!memory) return ""

  return `**Session Context (Earlier Discussion):**
${memory}

---`
}

// ============================================================================
// MAIN MEETING PROMPT BUILDER
// ============================================================================

/**
 * Build a complete meeting prompt for a specific action
 */
export function buildMeetingPrompt(
  options: MeetingPromptOptions
): MeetingPromptResult {
  const {
    action,
    transcriptText,
    transcriptTimeWindow,
    meetingContext,
    sessionMemory,
    answerType = "auto",
  } = options

  // Get the action-specific prompt
  const actionPrompt = MEETING_ACTION_PROMPTS[action]

  // Build the complete system prompt
  const systemPrompt = actionPrompt

  // Build the user prompt with all context
  const userPromptParts: string[] = []

  // Add session memory if available
  if (sessionMemory) {
    userPromptParts.push(formatSessionMemory(sessionMemory))
  }

  // Add meeting context
  userPromptParts.push(formatMeetingContext(meetingContext))

  // Add time window
  if (transcriptTimeWindow) {
    userPromptParts.push(formatTimeWindow(transcriptTimeWindow))
  }

  // Add the transcript
  userPromptParts.push(`**Transcript:**\n\`\`\`\n${transcriptText}\n\`\`\``)

  // Add instructions based on action
  userPromptParts.push(getActionInstructions(action))

  const userPrompt = userPromptParts.join("\n\n")

  // Suggest optimal parameters for this action
  const suggestedTemperature = getActionTemperature(action)
  const suggestedMaxTokens = getActionMaxTokens(action)

  // Calculate token estimate (rough)
  const totalTokensEstimate = Math.ceil(
    (systemPrompt.length + userPrompt.length) / 4
  )

  return {
    systemPrompt,
    userPrompt,
    formattedMessages: [
      { role: "system", content: systemPrompt } as any,
      { role: "user", content: userPrompt } as any,
    ],
    metadata: {
      mode: "meeting" as SessionMode,
      answerType,
      totalTokensEstimate,
      contextItemsIncluded: 0,
    },
    action,
    suggestedTemperature,
    suggestedMaxTokens,
  }
}

// ============================================================================
// ACTION-SPECIFIC HELPERS
// ============================================================================

/**
 * Get additional instructions for each action type
 */
function getActionInstructions(action: MeetingActionType): string {
  const instructions: Record<MeetingActionType, string> = {
    say: "Based on the above context and transcript, suggest 2-3 options for what I could say next.",
    followups:
      "Based on the conversation, generate 3-7 insightful follow-up questions.",
    factcheck:
      "Review the transcript and fact-check any verifiable claims made.",
    recap:
      "Provide a comprehensive but concise recap of the meeting so far.",
    decisions: "Extract all concrete decisions made in the conversation.",
    email: "Draft a professional follow-up email summarizing the meeting.",
    "action-items": "Extract all action items mentioned in the discussion.",
    "key-points": "Identify the 3-7 most important takeaways.",
    clarify:
      "Suggest 2-3 clarifying questions I could ask to resolve ambiguities.",
  }

  return instructions[action] || ""
}

/**
 * Get optimal temperature for each action
 */
function getActionTemperature(action: MeetingActionType): number {
  const temperatures: Record<MeetingActionType, number> = {
    say: 0.8, // Creative but coherent
    followups: 0.7,
    factcheck: 0.3, // Low for accuracy
    recap: 0.4, // Low for accuracy
    decisions: 0.3, // Very low for precision
    email: 0.6, // Moderate for professional tone
    "action-items": 0.3, // Low for precision
    "key-points": 0.5,
    clarify: 0.6,
  }

  return temperatures[action] || 0.7
}

/**
 * Get optimal max tokens for each action
 */
function getActionMaxTokens(action: MeetingActionType): number {
  const maxTokens: Record<MeetingActionType, number> = {
    say: 512, // Short suggestions
    followups: 768,
    factcheck: 1024,
    recap: 1536,
    decisions: 768,
    email: 1024,
    "action-items": 768,
    "key-points": 768,
    clarify: 512,
  }

  return maxTokens[action] || 1024
}

// ============================================================================
// MEETING ACTION METADATA
// ============================================================================

export interface MeetingActionConfig {
  id: MeetingActionType
  label: string
  description: string
  icon: string
  hotkey?: string
  requiresTimeWindow: boolean
  defaultTimeWindowMinutes?: number
  category: "realtime" | "analysis" | "followup"
}

export const MEETING_ACTIONS: MeetingActionConfig[] = [
  {
    id: "say",
    label: "What should I say?",
    description: "Get suggestions for what to say right now",
    icon: "💬",
    hotkey: "cmd+1",
    requiresTimeWindow: true,
    defaultTimeWindowMinutes: 2,
    category: "realtime",
  },
  {
    id: "followups",
    label: "Follow-up questions",
    description: "Generate insightful questions to ask",
    icon: "❓",
    hotkey: "cmd+2",
    requiresTimeWindow: false,
    category: "realtime",
  },
  {
    id: "factcheck",
    label: "Fact check",
    description: "Verify claims made in the meeting",
    icon: "✓",
    requiresTimeWindow: false,
    category: "analysis",
  },
  {
    id: "recap",
    label: "Recap",
    description: "Summarize the conversation",
    icon: "📝",
    requiresTimeWindow: false,
    category: "analysis",
  },
  {
    id: "decisions",
    label: "Decisions",
    description: "Extract decisions made",
    icon: "✅",
    requiresTimeWindow: false,
    category: "analysis",
  },
  {
    id: "action-items",
    label: "Action items",
    description: "Extract action items and owners",
    icon: "☑️",
    requiresTimeWindow: false,
    category: "analysis",
  },
  {
    id: "key-points",
    label: "Key points",
    description: "Highlight most important takeaways",
    icon: "⭐",
    requiresTimeWindow: false,
    category: "analysis",
  },
  {
    id: "email",
    label: "Draft email",
    description: "Create follow-up email",
    icon: "📧",
    requiresTimeWindow: false,
    category: "followup",
  },
  {
    id: "clarify",
    label: "Clarify",
    description: "Ask clarifying questions",
    icon: "🔍",
    requiresTimeWindow: true,
    defaultTimeWindowMinutes: 5,
    category: "realtime",
  },
]

/**
 * Get meeting actions by category
 */
export function getMeetingActionsByCategory(
  category: "realtime" | "analysis" | "followup"
): MeetingActionConfig[] {
  return MEETING_ACTIONS.filter((action) => action.category === category)
}

/**
 * Get meeting action config by ID
 */
export function getMeetingActionConfig(
  id: MeetingActionType
): MeetingActionConfig | undefined {
  return MEETING_ACTIONS.find((action) => action.id === id)
}
