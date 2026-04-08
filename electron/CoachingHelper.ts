import type { Playbook } from "./PlaybookHelper"
import type { ChatFn } from "./MeetingHelper"
import {
  buildCoachingPrompt,
  buildQuickResponsePrompt,
} from "./prompts/meeting-prompts"

const DEFAULT_COOLDOWN_MS = 10_000 // 10 seconds

export class CoachingHelper {
  private chat: ChatFn
  private cooldownMs = DEFAULT_COOLDOWN_MS
  private lastEvalTime = 0

  constructor(chat: ChatFn) {
    this.chat = chat
  }

  setCooldownMs(ms: number): void {
    this.cooldownMs = ms
  }

  async evaluateStatement(statement: string, playbook: Playbook): Promise<string | null> {
    const now = Date.now()
    if (now - this.lastEvalTime < this.cooldownMs) {
      return null
    }
    this.lastEvalTime = now

    try {
      const prompt = buildCoachingPrompt(statement, playbook.id)
      const response = await this.chat(prompt)
      return response.trim() || null
    } catch {
      return null
    }
  }

  async generateQuickResponses(question: string, recentContext: string): Promise<string[]> {
    try {
      const prompt = buildQuickResponsePrompt(question, recentContext)
      const response = await this.chat(prompt)

      if (!response.trim()) return []

      // Parse "- " prefixed lines
      const lines = response
        .split("\n")
        .map(l => l.replace(/^[-•*]\s*/, "").trim())
        .filter(l => l.length > 0)

      return lines.slice(0, 3)
    } catch {
      return []
    }
  }
}
