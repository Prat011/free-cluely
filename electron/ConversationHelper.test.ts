import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import fs from "fs"
import path from "path"
import os from "os"
import { ConversationHelper } from "./ConversationHelper"
import type { ConversationMessage } from "./ConversationHelper"

vi.mock("electron", () => ({
  app: {
    getPath: vi.fn(() => "/mock/userData"),
  },
}))

describe("ConversationHelper", () => {
  let tmpDir: string
  let helper: ConversationHelper

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "conversation-test-"))
    helper = new ConversationHelper(tmpDir)
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  describe("addMessage()", () => {
    it("メッセージを追加する", () => {
      helper.addMessage("user", "Hello")
      const messages = helper.getMessages()
      expect(messages).toHaveLength(1)
      expect(messages[0].role).toBe("user")
      expect(messages[0].content).toBe("Hello")
      expect(messages[0].timestamp).toBeGreaterThan(0)
    })

    it("複数メッセージを順番に追加できる", () => {
      helper.addMessage("user", "Hi")
      helper.addMessage("assistant", "Hello! How can I help?")
      helper.addMessage("user", "Tell me about React")
      const messages = helper.getMessages()
      expect(messages).toHaveLength(3)
      expect(messages[0].content).toBe("Hi")
      expect(messages[2].content).toBe("Tell me about React")
    })
  })

  describe("getMessages()", () => {
    it("空の場合は空配列を返す", () => {
      expect(helper.getMessages()).toEqual([])
    })

    it("上限数のメッセージを返す", () => {
      expect(helper.getMessages(2)).toHaveLength(0)

      for (let i = 0; i < 5; i++) {
        helper.addMessage("user", `Message ${i}`)
      }
      const last3 = helper.getMessages(3)
      expect(last3).toHaveLength(3)
      expect(last3[0].content).toBe("Message 2")
      expect(last3[2].content).toBe("Message 4")
    })
  })

  describe("getContextString()", () => {
    it("直近メッセージをフォーマットした文字列を返す", () => {
      helper.addMessage("user", "What is TypeScript?")
      helper.addMessage("assistant", "TypeScript is a typed superset of JavaScript.")
      const ctx = helper.getContextString(2)
      expect(ctx).toContain("[user] What is TypeScript?")
      expect(ctx).toContain("[assistant] TypeScript is a typed superset of JavaScript.")
    })

    it("空の場合は空文字列", () => {
      expect(helper.getContextString()).toBe("")
    })
  })

  describe("永続化", () => {
    it("ファイルに保存される", () => {
      helper.addMessage("user", "Test persistence")
      const filePath = path.join(tmpDir, "conversation-history.json")
      expect(fs.existsSync(filePath)).toBe(true)
    })

    it("再読み込みで復元される", () => {
      helper.addMessage("user", "Before reload")
      helper.addMessage("assistant", "Response")

      const helper2 = new ConversationHelper(tmpDir)
      const messages = helper2.getMessages()
      expect(messages).toHaveLength(2)
      expect(messages[0].content).toBe("Before reload")
    })
  })

  describe("上限管理", () => {
    it("50メッセージを超えると古いものが削除される", () => {
      for (let i = 0; i < 60; i++) {
        helper.addMessage("user", `Msg ${i}`)
      }
      const messages = helper.getMessages()
      expect(messages).toHaveLength(50)
      expect(messages[0].content).toBe("Msg 10") // oldest kept
      expect(messages[49].content).toBe("Msg 59") // newest
    })
  })

  describe("clear()", () => {
    it("全メッセージを削除する", () => {
      helper.addMessage("user", "To clear")
      helper.clear()
      expect(helper.getMessages()).toEqual([])
    })

    it("ファイルも削除される", () => {
      helper.addMessage("user", "Test")
      helper.clear()
      const filePath = path.join(tmpDir, "conversation-history.json")
      // File should be empty or contain []
      const raw = fs.readFileSync(filePath, "utf-8")
      expect(JSON.parse(raw)).toEqual([])
    })
  })
})
