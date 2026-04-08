import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import fs from "fs"
import path from "path"
import os from "os"

// safeStorageをモック（Electron APIはテスト環境で使えない）
vi.mock("electron", () => ({
  safeStorage: {
    isEncryptionAvailable: vi.fn().mockReturnValue(true),
    encryptString: vi.fn((s: string) => Buffer.from(`enc:${s}`)),
    decryptString: vi.fn((b: Buffer) => b.toString().replace("enc:", "")),
  },
  app: {
    getPath: vi.fn().mockReturnValue(os.tmpdir()),
  },
}))

import { SettingsHelper } from "./SettingsHelper"

describe("SettingsHelper", () => {
  let helper: SettingsHelper
  let settingsPath: string
  let counter = 0

  beforeEach(() => {
    counter++
    settingsPath = path.join(
      os.tmpdir(),
      `test-settings-${Date.now()}-${counter}-${Math.random().toString(36).slice(2)}.json`
    )
    helper = new SettingsHelper(settingsPath)
  })

  afterEach(() => {
    try {
      fs.unlinkSync(settingsPath)
    } catch {}
  })

  describe("デフォルト設定", () => {
    it("初期状態でデフォルト設定を返す", () => {
      const settings = helper.getAll()
      expect(settings.activeProvider).toBe("gemini")
      expect(settings.fallbackOrder).toEqual([])
      expect(settings.providers).toEqual({})
      expect(settings.speechRecognitionLang).toBe("en-US")
    })
  })

  describe("設定の読み書き", () => {
    it("activeProviderを変更できる", () => {
      helper.set("activeProvider", "openai")
      expect(helper.get("activeProvider")).toBe("openai")
    })

    it("fallbackOrderを設定できる", () => {
      helper.set("fallbackOrder", ["gemini", "openai", "claude"])
      expect(helper.get("fallbackOrder")).toEqual(["gemini", "openai", "claude"])
    })

    it("speechRecognitionLangを変更できる", () => {
      helper.set("speechRecognitionLang", "ja-JP")
      expect(helper.get("speechRecognitionLang")).toBe("ja-JP")
    })
  })

  describe("設定の永続化", () => {
    it("設定がファイルに保存される", () => {
      helper.set("activeProvider", "claude")
      expect(fs.existsSync(settingsPath)).toBe(true)
    })

    it("設定がファイルから復元される", () => {
      helper.set("activeProvider", "claude")
      helper.set("speechRecognitionLang", "ja-JP")

      const helper2 = new SettingsHelper(settingsPath)
      expect(helper2.get("activeProvider")).toBe("claude")
      expect(helper2.get("speechRecognitionLang")).toBe("ja-JP")
    })
  })

  describe("APIキー管理（暗号化）", () => {
    it("APIキーを暗号化して保存できる", () => {
      helper.setApiKey("gemini", "my-secret-key")
      const key = helper.getApiKey("gemini")
      expect(key).toBe("my-secret-key")
    })

    it("複数プロバイダーのAPIキーを管理できる", () => {
      helper.setApiKey("gemini", "gemini-key")
      helper.setApiKey("openai", "openai-key")
      helper.setApiKey("claude", "claude-key")

      expect(helper.getApiKey("gemini")).toBe("gemini-key")
      expect(helper.getApiKey("openai")).toBe("openai-key")
      expect(helper.getApiKey("claude")).toBe("claude-key")
    })

    it("未設定のAPIキーはundefinedを返す", () => {
      expect(helper.getApiKey("openai")).toBeUndefined()
    })

    it("APIキーが暗号化されてファイルに保存される", () => {
      helper.setApiKey("gemini", "secret")
      const raw = JSON.parse(fs.readFileSync(settingsPath, "utf-8"))
      // 暗号化されたキーは平文ではない
      expect(raw.providers?.gemini?.encryptedApiKey).toBeDefined()
      expect(raw.providers?.gemini?.encryptedApiKey).not.toBe("secret")
    })

    it("APIキーがファイルから復元される", () => {
      helper.setApiKey("openai", "restored-key")

      const helper2 = new SettingsHelper(settingsPath)
      expect(helper2.getApiKey("openai")).toBe("restored-key")
    })
  })

  describe("Ollama設定", () => {
    it("OllamaのURLとモデルを保存できる", () => {
      helper.setOllamaConfig("http://192.168.1.100:11434", "llama3.2")
      const settings = helper.getAll()
      expect(settings.providers.ollama).toEqual({
        url: "http://192.168.1.100:11434",
        defaultModel: "llama3.2",
      })
    })
  })

  describe("updateAll()", () => {
    it("複数設定を一括更新できる", () => {
      helper.updateAll({
        activeProvider: "ollama",
        speechRecognitionLang: "ko-KR",
      })
      expect(helper.get("activeProvider")).toBe("ollama")
      expect(helper.get("speechRecognitionLang")).toBe("ko-KR")
    })
  })
})
