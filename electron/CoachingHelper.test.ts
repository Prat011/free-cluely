import { describe, it, expect, beforeEach, vi } from "vitest"
import { CoachingHelper } from "./CoachingHelper"
import type { Playbook } from "./PlaybookHelper"

vi.mock("electron", () => ({
  app: {
    getPath: vi.fn(() => "/mock/userData"),
  },
}))

const generalPlaybook: Playbook = {
  id: "general",
  name: "General",
  description: "General meeting coaching",
  icon: "📋",
  isBuiltIn: true,
  guidelines: "Track key discussion points and action items.",
  responseStyle: "neutral, balanced",
  summaryFormat: "Topics discussed, decisions made, action items",
}

const interviewPlaybook: Playbook = {
  id: "technical-interview",
  name: "Technical Interview",
  description: "Coding interview coaching",
  icon: "💻",
  isBuiltIn: true,
  guidelines: "Focus on problem-solving approach and complexity analysis.",
  responseStyle: "structured, step-by-step",
  summaryFormat: "Problems discussed, approaches taken",
}

describe("CoachingHelper", () => {
  let mockChat: ReturnType<typeof vi.fn>
  let helper: CoachingHelper

  beforeEach(() => {
    mockChat = vi.fn()
    helper = new CoachingHelper(mockChat)
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe("evaluateStatement()", () => {
    it("Playbookに基づいてコーチング提案を返す", async () => {
      mockChat.mockResolvedValueOnce("Consider discussing time complexity here.")

      const result = await helper.evaluateStatement(
        "I think we should use a nested loop here",
        interviewPlaybook
      )
      expect(result).toBe("Consider discussing time complexity here.")
      expect(mockChat).toHaveBeenCalledTimes(1)
    })

    it("LLMが空文字列を返した場合はnullを返す", async () => {
      mockChat.mockResolvedValueOnce("")

      const result = await helper.evaluateStatement(
        "Hello everyone",
        generalPlaybook
      )
      expect(result).toBeNull()
    })

    it("最小間隔(10秒)内の連続呼び出しはスキップされる", async () => {
      mockChat.mockResolvedValue("Advice")

      const result1 = await helper.evaluateStatement("Statement 1", generalPlaybook)
      expect(result1).toBe("Advice")

      // Within 10 second cooldown
      vi.advanceTimersByTime(5000)
      const result2 = await helper.evaluateStatement("Statement 2", generalPlaybook)
      expect(result2).toBeNull()
      expect(mockChat).toHaveBeenCalledTimes(1)

      // After cooldown
      vi.advanceTimersByTime(6000)
      const result3 = await helper.evaluateStatement("Statement 3", generalPlaybook)
      expect(result3).toBe("Advice")
      expect(mockChat).toHaveBeenCalledTimes(2)
    })

    it("LLMエラー時はnullを返す", async () => {
      mockChat.mockRejectedValueOnce(new Error("LLM failed"))

      const result = await helper.evaluateStatement("Test statement", generalPlaybook)
      expect(result).toBeNull()
    })
  })

  describe("generateQuickResponses()", () => {
    it("2-3個の回答候補を返す", async () => {
      mockChat.mockResolvedValueOnce(
        "- I think the deadline is next Friday.\n- We should check the project timeline.\n- Let me confirm with the PM."
      )

      const responses = await helper.generateQuickResponses(
        "What's the deadline for this feature?",
        "We've been discussing the Q2 roadmap and feature prioritization."
      )
      expect(responses.length).toBeGreaterThanOrEqual(2)
      expect(responses.length).toBeLessThanOrEqual(3)
      expect(responses[0]).toContain("deadline")
    })

    it("LLMが空を返した場合は空配列", async () => {
      mockChat.mockResolvedValueOnce("")

      const responses = await helper.generateQuickResponses("Question?", "Context")
      expect(responses).toEqual([])
    })

    it("LLMエラー時は空配列", async () => {
      mockChat.mockRejectedValueOnce(new Error("fail"))

      const responses = await helper.generateQuickResponses("Q?", "C")
      expect(responses).toEqual([])
    })
  })

  describe("setCooldownMs()", () => {
    it("クールダウン間隔をカスタマイズできる", async () => {
      helper.setCooldownMs(3000) // 3 seconds
      mockChat.mockResolvedValue("Advice")

      await helper.evaluateStatement("S1", generalPlaybook)
      vi.advanceTimersByTime(3500)
      const result = await helper.evaluateStatement("S2", generalPlaybook)
      expect(result).toBe("Advice")
      expect(mockChat).toHaveBeenCalledTimes(2)
    })
  })
})
