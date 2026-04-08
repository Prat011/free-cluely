import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import fs from "fs"
import path from "path"
import os from "os"
import { StorageHelper } from "./StorageHelper"
import type { MeetingRecord, TranscriptionEntry } from "./StorageHelper"

// Mock electron
vi.mock("electron", () => ({
  app: {
    getPath: vi.fn(() => "/mock/userData"),
  },
}))

describe("StorageHelper", () => {
  let tmpDir: string
  let helper: StorageHelper

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "storage-test-"))
    helper = new StorageHelper(tmpDir)
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  describe("コンストラクタ", () => {
    it("meetingsディレクトリを作成する", () => {
      const meetingsDir = path.join(tmpDir, "meetings")
      expect(fs.existsSync(meetingsDir)).toBe(true)
    })
  })

  describe("createMeeting()", () => {
    it("デフォルトタイトルで新規MeetingRecordを作成する", () => {
      const record = helper.createMeeting()
      expect(record.id).toBeDefined()
      expect(record.title).toBe("Untitled Meeting")
      expect(record.startedAt).toBeGreaterThan(0)
      expect(record.endedAt).toBeNull()
      expect(record.entries).toEqual([])
      expect(record.summary).toBeNull()
      expect(record.actionItems).toEqual([])
      expect(record.chunkSummaries).toEqual([])
      expect(record.metadata).toBeDefined()
    })

    it("指定タイトルで作成する", () => {
      const record = helper.createMeeting("Weekly Standup")
      expect(record.title).toBe("Weekly Standup")
    })

    it("作成したレコードがファイルに保存される", () => {
      const record = helper.createMeeting("Test")
      const filePath = path.join(tmpDir, "meetings", `${record.id}.json`)
      expect(fs.existsSync(filePath)).toBe(true)
    })
  })

  describe("getMeeting()", () => {
    it("存在するIDでMeetingRecordを返す", () => {
      const created = helper.createMeeting("Test Meeting")
      const retrieved = helper.getMeeting(created.id)
      expect(retrieved).not.toBeNull()
      expect(retrieved!.id).toBe(created.id)
      expect(retrieved!.title).toBe("Test Meeting")
    })

    it("存在しないIDでnullを返す", () => {
      expect(helper.getMeeting("nonexistent-id")).toBeNull()
    })
  })

  describe("saveMeeting()", () => {
    it("既存レコードを上書き保存する", () => {
      const record = helper.createMeeting("Original")
      record.title = "Updated Title"
      record.endedAt = Date.now()
      helper.saveMeeting(record)

      const retrieved = helper.getMeeting(record.id)
      expect(retrieved!.title).toBe("Updated Title")
      expect(retrieved!.endedAt).not.toBeNull()
    })
  })

  describe("listMeetings()", () => {
    it("空の場合は空配列を返す", () => {
      expect(helper.listMeetings()).toEqual([])
    })

    it("startedAt降順でソートされる", () => {
      const m1 = helper.createMeeting("First")
      const m2 = helper.createMeeting("Second")
      const m3 = helper.createMeeting("Third")

      // Manually set different timestamps
      m1.startedAt = 1000
      m2.startedAt = 3000
      m3.startedAt = 2000
      helper.saveMeeting(m1)
      helper.saveMeeting(m2)
      helper.saveMeeting(m3)

      const list = helper.listMeetings()
      expect(list).toHaveLength(3)
      expect(list[0].title).toBe("Second")  // newest first
      expect(list[1].title).toBe("Third")
      expect(list[2].title).toBe("First")
    })
  })

  describe("deleteMeeting()", () => {
    it("存在するIDを削除してtrueを返す", () => {
      const record = helper.createMeeting("To Delete")
      expect(helper.deleteMeeting(record.id)).toBe(true)
      expect(helper.getMeeting(record.id)).toBeNull()
    })

    it("存在しないIDでfalseを返す", () => {
      expect(helper.deleteMeeting("nonexistent")).toBe(false)
    })

    it("ファイルも削除される", () => {
      const record = helper.createMeeting("To Delete")
      const filePath = path.join(tmpDir, "meetings", `${record.id}.json`)
      expect(fs.existsSync(filePath)).toBe(true)
      helper.deleteMeeting(record.id)
      expect(fs.existsSync(filePath)).toBe(false)
    })
  })

  describe("addTranscriptionEntry()", () => {
    it("エントリを追加して保存する", () => {
      const record = helper.createMeeting("With Entries")
      const entry: TranscriptionEntry = {
        speaker: "you",
        text: "Hello, how are you?",
        timestamp: Date.now(),
      }
      helper.addTranscriptionEntry(record.id, entry)

      const retrieved = helper.getMeeting(record.id)
      expect(retrieved!.entries).toHaveLength(1)
      expect(retrieved!.entries[0].text).toBe("Hello, how are you?")
    })

    it("存在しないIDでエラーを投げる", () => {
      const entry: TranscriptionEntry = {
        speaker: "speaker",
        text: "Test",
        timestamp: Date.now(),
      }
      expect(() => helper.addTranscriptionEntry("bad-id", entry)).toThrow()
    })

    it("複数エントリを順番に追加できる", () => {
      const record = helper.createMeeting("Multi Entry")
      helper.addTranscriptionEntry(record.id, {
        speaker: "you",
        text: "First",
        timestamp: 1000,
      })
      helper.addTranscriptionEntry(record.id, {
        speaker: "speaker",
        text: "Second",
        timestamp: 2000,
      })

      const retrieved = helper.getMeeting(record.id)
      expect(retrieved!.entries).toHaveLength(2)
      expect(retrieved!.entries[0].text).toBe("First")
      expect(retrieved!.entries[1].text).toBe("Second")
    })
  })

  describe("searchMeetings()", () => {
    it("タイトルで検索できる", () => {
      helper.createMeeting("Weekly Standup")
      helper.createMeeting("1on1 with Alice")
      helper.createMeeting("Weekly Planning")

      const results = helper.searchMeetings("Weekly")
      expect(results).toHaveLength(2)
    })

    it("サマリーで検索できる", () => {
      const record = helper.createMeeting("Meeting A")
      record.summary = "Discussed the new feature rollout"
      helper.saveMeeting(record)
      helper.createMeeting("Meeting B")

      const results = helper.searchMeetings("feature rollout")
      expect(results).toHaveLength(1)
      expect(results[0].id).toBe(record.id)
    })

    it("文字起こしテキストで検索できる", () => {
      const record = helper.createMeeting("Meeting C")
      helper.addTranscriptionEntry(record.id, {
        speaker: "you",
        text: "We need to migrate to PostgreSQL",
        timestamp: Date.now(),
      })
      helper.createMeeting("Meeting D")

      const results = helper.searchMeetings("PostgreSQL")
      expect(results).toHaveLength(1)
    })

    it("大文字小文字を区別しない", () => {
      helper.createMeeting("IMPORTANT meeting")
      const results = helper.searchMeetings("important")
      expect(results).toHaveLength(1)
    })

    it("該当なしで空配列を返す", () => {
      helper.createMeeting("Some Meeting")
      expect(helper.searchMeetings("nonexistent")).toEqual([])
    })
  })
})
