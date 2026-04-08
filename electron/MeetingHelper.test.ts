import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import fs from "fs"
import path from "path"
import os from "os"
import { MeetingHelper } from "./MeetingHelper"
import { StorageHelper } from "./StorageHelper"
import type { TranscriptionEntry } from "./StorageHelper"

// Mock electron
vi.mock("electron", () => ({
  app: {
    getPath: vi.fn(() => "/mock/userData"),
  },
}))

// Mock LLM provider
function createMockLLMChat(responses: Record<string, string> = {}) {
  const defaultResponse = "Summary of the meeting."
  return vi.fn(async (prompt: string) => {
    for (const [key, value] of Object.entries(responses)) {
      if (prompt.includes(key)) return value
    }
    return defaultResponse
  })
}

describe("MeetingHelper", () => {
  let tmpDir: string
  let storage: StorageHelper
  let mockChat: ReturnType<typeof createMockLLMChat>
  let helper: MeetingHelper

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "meeting-test-"))
    storage = new StorageHelper(tmpDir)
    mockChat = createMockLLMChat()
    helper = new MeetingHelper(storage, mockChat)
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  describe("startMeeting()", () => {
    it("新しいミーティングセッションを開始する", () => {
      const meeting = helper.startMeeting("Weekly Standup")
      expect(meeting.title).toBe("Weekly Standup")
      expect(meeting.endedAt).toBeNull()
      expect(helper.getCurrentMeeting()).not.toBeNull()
    })

    it("既にセッション中の場合はエラーを投げる", () => {
      helper.startMeeting("First")
      expect(() => helper.startMeeting("Second")).toThrow("already in progress")
    })

    it("StorageHelperに保存される", () => {
      const meeting = helper.startMeeting("Test")
      const stored = storage.getMeeting(meeting.id)
      expect(stored).not.toBeNull()
      expect(stored!.title).toBe("Test")
    })
  })

  describe("getCurrentMeeting()", () => {
    it("セッション開始前はnullを返す", () => {
      expect(helper.getCurrentMeeting()).toBeNull()
    })

    it("セッション中はMeetingRecordを返す", () => {
      const meeting = helper.startMeeting()
      expect(helper.getCurrentMeeting()?.id).toBe(meeting.id)
    })
  })

  describe("addEntry()", () => {
    it("現在のミーティングにエントリを追加する", () => {
      helper.startMeeting("Test")
      const entry: TranscriptionEntry = {
        speaker: "you",
        text: "Hello everyone",
        timestamp: Date.now(),
      }
      helper.addEntry(entry)

      const meeting = helper.getCurrentMeeting()!
      const stored = storage.getMeeting(meeting.id)!
      expect(stored.entries).toHaveLength(1)
      expect(stored.entries[0].text).toBe("Hello everyone")
    })

    it("セッション外ではエラーを投げる", () => {
      const entry: TranscriptionEntry = {
        speaker: "you",
        text: "Test",
        timestamp: Date.now(),
      }
      expect(() => helper.addEntry(entry)).toThrow("No active meeting")
    })
  })

  describe("endMeeting()", () => {
    it("セッションを終了してendedAtを設定する", async () => {
      helper.startMeeting("Test")
      const ended = await helper.endMeeting()
      expect(ended.endedAt).not.toBeNull()
      expect(ended.endedAt).toBeGreaterThan(0)
      expect(helper.getCurrentMeeting()).toBeNull()
    })

    it("セッション外ではエラーを投げる", async () => {
      await expect(helper.endMeeting()).rejects.toThrow("No active meeting")
    })

    it("最終要約を生成する", async () => {
      helper.startMeeting("Summary Test")
      helper.addEntry({ speaker: "you", text: "We discussed the roadmap", timestamp: 1000 })
      helper.addEntry({ speaker: "speaker", text: "I agree with the plan", timestamp: 2000 })

      const ended = await helper.endMeeting()
      expect(ended.summary).not.toBeNull()
      expect(mockChat).toHaveBeenCalled()
    })
  })

  describe("generateSummary()", () => {
    it("短いミーティングは単一パスで要約する", async () => {
      const meeting = helper.startMeeting("Short Meeting")
      helper.addEntry({ speaker: "you", text: "Let's discuss the bug fix", timestamp: 1000 })
      helper.addEntry({ speaker: "speaker", text: "I'll handle it today", timestamp: 2000 })

      const summary = await helper.generateSummary(meeting.id)
      expect(summary).toBeDefined()
      expect(mockChat).toHaveBeenCalledTimes(1)
    })

    it("エントリのないミーティングはnullを返す", async () => {
      const meeting = helper.startMeeting("Empty")
      const summary = await helper.generateSummary(meeting.id)
      expect(summary).toBeNull()
      expect(mockChat).not.toHaveBeenCalled()
    })

    it("長いミーティングはチャンク分割(Map-Reduce)で要約する", async () => {
      const meeting = helper.startMeeting("Long Meeting")
      // Add entries spanning 45 minutes (3 chunks of 15 min)
      const baseTime = Date.now()
      for (let i = 0; i < 45; i++) {
        helper.addEntry({
          speaker: i % 2 === 0 ? "you" : "speaker",
          text: `Discussion point ${i} about the project. This is a detailed statement about topic ${i}.`,
          timestamp: baseTime + i * 60_000, // 1 entry per minute
        })
      }

      mockChat
        .mockResolvedValueOnce("Chunk 1 summary: discussed topics 0-14")
        .mockResolvedValueOnce("Chunk 2 summary: discussed topics 15-29")
        .mockResolvedValueOnce("Chunk 3 summary: discussed topics 30-44")
        .mockResolvedValueOnce("Final combined summary of all chunks")

      const summary = await helper.generateSummary(meeting.id)
      expect(summary).toBe("Final combined summary of all chunks")
      // 3 chunk summaries + 1 final combine = 4 calls
      expect(mockChat).toHaveBeenCalledTimes(4)

      // chunkSummaries should be saved
      const stored = storage.getMeeting(meeting.id)!
      expect(stored.chunkSummaries).toHaveLength(3)
    })
  })

  describe("extractActionItems()", () => {
    it("アクションアイテムをJSON形式で抽出する", async () => {
      const meeting = helper.startMeeting("Action Items Test")
      helper.addEntry({ speaker: "you", text: "Alice will prepare the report by Friday", timestamp: 1000 })
      helper.addEntry({ speaker: "speaker", text: "I'll review the PR today", timestamp: 2000 })

      mockChat.mockResolvedValueOnce(JSON.stringify([
        { text: "Prepare the report", owner: "Alice", deadline: "Friday" },
        { text: "Review the PR", owner: "Speaker", deadline: "today" },
      ]))

      const items = await helper.extractActionItems(meeting.id)
      expect(items).toHaveLength(2)
      expect(items[0].text).toBe("Prepare the report")
      expect(items[0].owner).toBe("Alice")
      expect(items[0].completed).toBe(false)
      expect(items[0].id).toBeDefined()
    })

    it("エントリのないミーティングは空配列を返す", async () => {
      const meeting = helper.startMeeting("Empty")
      const items = await helper.extractActionItems(meeting.id)
      expect(items).toEqual([])
    })

    it("LLMがJSON以外を返した場合は空配列を返す", async () => {
      const meeting = helper.startMeeting("Bad Response")
      helper.addEntry({ speaker: "you", text: "Some text", timestamp: 1000 })
      mockChat.mockResolvedValueOnce("No action items found in this meeting.")

      const items = await helper.extractActionItems(meeting.id)
      expect(items).toEqual([])
    })
  })
})
