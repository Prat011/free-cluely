import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import fs from "fs"
import path from "path"
import os from "os"
import { ExportHelper } from "./ExportHelper"
import { StorageHelper } from "./StorageHelper"
import type { MeetingRecord } from "./StorageHelper"

vi.mock("electron", () => ({
  app: {
    getPath: vi.fn(() => "/mock/userData"),
  },
  clipboard: {
    writeText: vi.fn(),
  },
}))

describe("ExportHelper", () => {
  let tmpDir: string
  let storage: StorageHelper
  let helper: ExportHelper
  let sampleMeeting: MeetingRecord

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "export-test-"))
    storage = new StorageHelper(tmpDir)
    helper = new ExportHelper(storage)

    // Create a sample meeting
    sampleMeeting = storage.createMeeting("Weekly Standup")

    // Add entries first (these write to disk)
    storage.addTranscriptionEntry(sampleMeeting.id, {
      speaker: "you",
      text: "Let's start with sprint updates",
      timestamp: sampleMeeting.startedAt,
    })
    storage.addTranscriptionEntry(sampleMeeting.id, {
      speaker: "speaker",
      text: "I finished the API refactor",
      timestamp: sampleMeeting.startedAt + 60000,
    })

    // Re-read from disk to get entries, then update other fields
    sampleMeeting = storage.getMeeting(sampleMeeting.id)!
    sampleMeeting.endedAt = sampleMeeting.startedAt + 1800000 // 30 min
    sampleMeeting.summary = "Discussed sprint progress and blockers."
    sampleMeeting.actionItems = [
      { id: "a1", text: "Fix login bug", owner: "Alice", deadline: "Friday", completed: false },
      { id: "a2", text: "Update docs", owner: "Bob", deadline: null, completed: true },
    ]
    storage.saveMeeting(sampleMeeting)
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  describe("toMarkdown()", () => {
    it("ミーティングをMarkdown形式に変換する", () => {
      const md = helper.toMarkdown(sampleMeeting.id)
      expect(md).not.toBeNull()
      expect(md).toContain("# Weekly Standup")
      expect(md).toContain("## Summary")
      expect(md).toContain("Discussed sprint progress")
      expect(md).toContain("## Action Items")
      expect(md).toContain("Fix login bug")
      expect(md).toContain("@Alice")
      expect(md).toContain("## Transcript")
      expect(md).toContain("[you]")
      expect(md).toContain("[speaker]")
    })

    it("存在しないIDでnullを返す", () => {
      expect(helper.toMarkdown("bad-id")).toBeNull()
    })

    it("完了済みアクションに取り消し線を含む", () => {
      const md = helper.toMarkdown(sampleMeeting.id)!
      expect(md).toContain("[x]")
      expect(md).toContain("[ ]")
    })
  })

  describe("copyToClipboard()", () => {
    it("Markdown をクリップボードにコピーする", async () => {
      const { clipboard } = await import("electron")
      const result = helper.copyToClipboard(sampleMeeting.id)
      expect(result).toBe(true)
      expect(clipboard.writeText).toHaveBeenCalled()
    })

    it("存在しないIDでfalseを返す", () => {
      expect(helper.copyToClipboard("bad-id")).toBe(false)
    })
  })

  describe("toJSON()", () => {
    it("ミーティングをJSON文字列で返す", () => {
      const json = helper.toJSON(sampleMeeting.id)
      expect(json).not.toBeNull()
      const parsed = JSON.parse(json!)
      expect(parsed.title).toBe("Weekly Standup")
      expect(parsed.entries).toHaveLength(2)
    })
  })
})
