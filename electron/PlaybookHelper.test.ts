import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import fs from "fs"
import path from "path"
import os from "os"
import { PlaybookHelper, BUILT_IN_PLAYBOOKS } from "./PlaybookHelper"
import type { Playbook } from "./PlaybookHelper"

vi.mock("electron", () => ({
  app: {
    getPath: vi.fn(() => "/mock/userData"),
  },
}))

describe("PlaybookHelper", () => {
  let tmpDir: string
  let helper: PlaybookHelper

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "playbook-test-"))
    helper = new PlaybookHelper(tmpDir)
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  describe("BUILT_IN_PLAYBOOKS", () => {
    it("6種のビルトインPlaybookが定義されている", () => {
      expect(BUILT_IN_PLAYBOOKS).toHaveLength(6)
    })

    it("必須IDが含まれている", () => {
      const ids = BUILT_IN_PLAYBOOKS.map(p => p.id)
      expect(ids).toContain("technical-interview")
      expect(ids).toContain("sales-call")
      expect(ids).toContain("team-standup")
      expect(ids).toContain("vc-pitch")
      expect(ids).toContain("customer-success")
      expect(ids).toContain("general")
    })

    it("すべてisBuiltIn: trueである", () => {
      for (const pb of BUILT_IN_PLAYBOOKS) {
        expect(pb.isBuiltIn).toBe(true)
      }
    })
  })

  describe("listPlaybooks()", () => {
    it("ビルトイン6種が最初から取得できる", () => {
      const list = helper.listPlaybooks()
      expect(list.length).toBeGreaterThanOrEqual(6)
    })

    it("カスタムPlaybookも含まれる", () => {
      helper.createPlaybook({
        name: "My Custom",
        description: "Custom playbook",
        icon: "🎯",
        guidelines: "Be helpful",
        responseStyle: "concise",
        summaryFormat: "bullet points",
      })
      const list = helper.listPlaybooks()
      expect(list.length).toBe(7)
      expect(list.some(p => p.name === "My Custom")).toBe(true)
    })
  })

  describe("getPlaybook()", () => {
    it("ビルトインIDで取得できる", () => {
      const pb = helper.getPlaybook("general")
      expect(pb).not.toBeNull()
      expect(pb!.name).toBe("General")
      expect(pb!.isBuiltIn).toBe(true)
    })

    it("カスタムIDで取得できる", () => {
      const created = helper.createPlaybook({
        name: "Test",
        description: "desc",
        icon: "📝",
        guidelines: "guide",
        responseStyle: "style",
        summaryFormat: "format",
      })
      const pb = helper.getPlaybook(created.id)
      expect(pb).not.toBeNull()
      expect(pb!.name).toBe("Test")
    })

    it("存在しないIDでnullを返す", () => {
      expect(helper.getPlaybook("nonexistent")).toBeNull()
    })
  })

  describe("createPlaybook()", () => {
    it("カスタムPlaybookを作成して保存する", () => {
      const pb = helper.createPlaybook({
        name: "Sales Follow-up",
        description: "Post-call follow-up template",
        icon: "📞",
        guidelines: "Focus on next steps",
        responseStyle: "professional",
        summaryFormat: "email-style",
      })
      expect(pb.id).toBeDefined()
      expect(pb.isBuiltIn).toBe(false)
      expect(pb.name).toBe("Sales Follow-up")

      // Verify persisted
      const filePath = path.join(tmpDir, "playbooks", `${pb.id}.json`)
      expect(fs.existsSync(filePath)).toBe(true)
    })
  })

  describe("updatePlaybook()", () => {
    it("カスタムPlaybookを更新できる", () => {
      const pb = helper.createPlaybook({
        name: "Original",
        description: "desc",
        icon: "📝",
        guidelines: "guide",
        responseStyle: "style",
        summaryFormat: "format",
      })
      const updated = helper.updatePlaybook(pb.id, { name: "Updated Name" })
      expect(updated).not.toBeNull()
      expect(updated!.name).toBe("Updated Name")

      // Verify persisted
      const reloaded = helper.getPlaybook(pb.id)
      expect(reloaded!.name).toBe("Updated Name")
    })

    it("ビルトインPlaybookは更新できない", () => {
      const result = helper.updatePlaybook("general", { name: "Hacked" })
      expect(result).toBeNull()
    })

    it("存在しないIDでnullを返す", () => {
      expect(helper.updatePlaybook("bad-id", { name: "X" })).toBeNull()
    })
  })

  describe("deletePlaybook()", () => {
    it("カスタムPlaybookを削除できる", () => {
      const pb = helper.createPlaybook({
        name: "To Delete",
        description: "desc",
        icon: "🗑",
        guidelines: "guide",
        responseStyle: "style",
        summaryFormat: "format",
      })
      expect(helper.deletePlaybook(pb.id)).toBe(true)
      expect(helper.getPlaybook(pb.id)).toBeNull()
    })

    it("ビルトインPlaybookは削除できない", () => {
      expect(helper.deletePlaybook("general")).toBe(false)
    })

    it("存在しないIDでfalseを返す", () => {
      expect(helper.deletePlaybook("nonexistent")).toBe(false)
    })
  })
})
