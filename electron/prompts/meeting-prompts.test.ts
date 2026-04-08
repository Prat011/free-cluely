import { describe, it, expect } from "vitest"
import {
  buildSummaryPrompt,
  buildChunkSummaryPrompt,
  buildCombineSummaryPrompt,
  buildActionItemsPrompt,
  buildQuickResponsePrompt,
  buildCoachingPrompt,
} from "./meeting-prompts"

describe("meeting-prompts", () => {
  const sampleTranscript = "[you] Hello everyone\n[speaker] Hi there"

  describe("buildSummaryPrompt()", () => {
    it("トランスクリプトを含む要約プロンプトを返す", () => {
      const prompt = buildSummaryPrompt(sampleTranscript)
      expect(prompt).toContain(sampleTranscript)
      expect(prompt.toLowerCase()).toContain("summar")
    })

    it("言語指定がある場合はプロンプトに含める", () => {
      const prompt = buildSummaryPrompt(sampleTranscript, "ja-JP")
      expect(prompt).toContain("ja-JP")
    })
  })

  describe("buildChunkSummaryPrompt()", () => {
    it("チャンク番号とトランスクリプトを含む", () => {
      const prompt = buildChunkSummaryPrompt(sampleTranscript, 2, 5)
      expect(prompt).toContain(sampleTranscript)
      expect(prompt).toContain("2")
      expect(prompt).toContain("5")
    })
  })

  describe("buildCombineSummaryPrompt()", () => {
    it("チャンク要約のリストを含む", () => {
      const chunks = ["Summary A", "Summary B", "Summary C"]
      const prompt = buildCombineSummaryPrompt(chunks)
      expect(prompt).toContain("Summary A")
      expect(prompt).toContain("Summary B")
      expect(prompt).toContain("Summary C")
    })
  })

  describe("buildActionItemsPrompt()", () => {
    it("JSON配列フォーマットを指定する", () => {
      const prompt = buildActionItemsPrompt(sampleTranscript)
      expect(prompt).toContain("JSON")
      expect(prompt).toContain(sampleTranscript)
    })
  })

  describe("buildQuickResponsePrompt()", () => {
    it("質問と直近コンテキストを含む", () => {
      const prompt = buildQuickResponsePrompt(
        "What's the deadline?",
        "We discussed the Q2 roadmap"
      )
      expect(prompt).toContain("What's the deadline?")
      expect(prompt).toContain("Q2 roadmap")
    })

    it("2-3個の提案を要求する", () => {
      const prompt = buildQuickResponsePrompt("Question?", "Context")
      expect(prompt).toMatch(/2|3|two|three/i)
    })
  })

  describe("buildCoachingPrompt()", () => {
    it("直近の発言とPlaybookを含む", () => {
      const prompt = buildCoachingPrompt(
        "I think we should postpone the launch",
        "technical-interview"
      )
      expect(prompt).toContain("postpone the launch")
      expect(prompt).toContain("technical-interview")
    })
  })
})
