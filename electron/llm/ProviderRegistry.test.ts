import { describe, it, expect, vi, beforeEach } from "vitest"
import { ProviderRegistry } from "./ProviderRegistry"
import type { LLMProvider, LLMProviderConfig } from "./types"

function createMockProvider(
  id: string,
  overrides?: Partial<LLMProvider>
): LLMProvider {
  return {
    config: {
      id,
      name: id,
      model: `${id}-model`,
      supportsChat: true,
      supportsVision: false,
      supportsAudio: false,
      supportsStreaming: false,
    },
    chat: vi.fn().mockResolvedValue(`${id} response`),
    testConnection: vi.fn().mockResolvedValue({ success: true }),
    getAvailableModels: vi
      .fn()
      .mockResolvedValue([{ id: `${id}-model`, name: `${id}-model`, supportsVision: false, supportsAudio: false }]),
    ...overrides,
  }
}

describe("ProviderRegistry", () => {
  let registry: ProviderRegistry

  beforeEach(() => {
    registry = new ProviderRegistry()
  })

  describe("プロバイダー登録", () => {
    it("プロバイダーを登録できる", () => {
      const provider = createMockProvider("gemini")
      registry.register(provider)
      expect(registry.getProvider("gemini")).toBe(provider)
    })

    it("未登録のプロバイダーはundefinedを返す", () => {
      expect(registry.getProvider("nonexistent")).toBeUndefined()
    })

    it("登録済みプロバイダー一覧を取得できる", () => {
      registry.register(createMockProvider("gemini"))
      registry.register(createMockProvider("ollama"))
      expect(registry.getProviderIds()).toEqual(["gemini", "ollama"])
    })
  })

  describe("アクティブプロバイダー", () => {
    it("最初に登録したプロバイダーがアクティブになる", () => {
      registry.register(createMockProvider("gemini"))
      registry.register(createMockProvider("ollama"))
      expect(registry.getActiveProvider()?.config.id).toBe("gemini")
    })

    it("アクティブプロバイダーを切り替えできる", () => {
      registry.register(createMockProvider("gemini"))
      registry.register(createMockProvider("ollama"))
      registry.setActiveProvider("ollama")
      expect(registry.getActiveProvider()?.config.id).toBe("ollama")
    })

    it("未登録のプロバイダーに切り替えるとエラー", () => {
      registry.register(createMockProvider("gemini"))
      expect(() => registry.setActiveProvider("unknown")).toThrow()
    })

    it("プロバイダー未登録時はnullを返す", () => {
      expect(registry.getActiveProvider()).toBeNull()
    })
  })

  describe("chat()", () => {
    it("アクティブプロバイダーのchatを呼ぶ", async () => {
      const gemini = createMockProvider("gemini")
      registry.register(gemini)
      const result = await registry.chat("Hello")
      expect(result).toBe("gemini response")
      expect(gemini.chat).toHaveBeenCalledWith("Hello", undefined)
    })

    it("プロバイダー未登録時はエラー", async () => {
      await expect(registry.chat("Hello")).rejects.toThrow()
    })
  })

  describe("自動フォールバック", () => {
    it("アクティブプロバイダーが失敗したら次のプロバイダーに切り替わる", async () => {
      const gemini = createMockProvider("gemini", {
        chat: vi.fn().mockRejectedValue(new Error("API error")),
      })
      const ollama = createMockProvider("ollama")

      registry.register(gemini)
      registry.register(ollama)
      registry.setFallbackOrder(["gemini", "ollama"])

      const result = await registry.chatWithFallback("Hello")
      expect(result).toBe("ollama response")
    })

    it("全プロバイダーが失敗したらエラー", async () => {
      const gemini = createMockProvider("gemini", {
        chat: vi.fn().mockRejectedValue(new Error("Gemini error")),
      })
      const ollama = createMockProvider("ollama", {
        chat: vi.fn().mockRejectedValue(new Error("Ollama error")),
      })

      registry.register(gemini)
      registry.register(ollama)
      registry.setFallbackOrder(["gemini", "ollama"])

      await expect(registry.chatWithFallback("Hello")).rejects.toThrow(
        "All providers failed"
      )
    })

    it("フォールバック順序を設定できる", () => {
      registry.register(createMockProvider("gemini"))
      registry.register(createMockProvider("ollama"))
      registry.setFallbackOrder(["ollama", "gemini"])
      expect(registry.getFallbackOrder()).toEqual(["ollama", "gemini"])
    })
  })

  describe("testConnection()", () => {
    it("アクティブプロバイダーの接続テストを実行する", async () => {
      const gemini = createMockProvider("gemini")
      registry.register(gemini)
      const result = await registry.testConnection()
      expect(result).toEqual({ success: true })
    })
  })
})
