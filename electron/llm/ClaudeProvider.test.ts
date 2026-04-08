import { describe, it, expect, vi, beforeEach } from "vitest"

const { mockMessagesCreate } = vi.hoisted(() => ({
  mockMessagesCreate: vi.fn(),
}))

vi.mock("@anthropic-ai/sdk", () => {
  class MockAnthropic {
    messages = { create: mockMessagesCreate }
    constructor(_opts: any) {}
  }
  return { default: MockAnthropic }
})

import { ClaudeProvider } from "./ClaudeProvider"

describe("ClaudeProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockMessagesCreate.mockResolvedValue({
      content: [{ type: "text", text: "claude response" }],
    })
  })

  it("config.idが'claude'である", () => {
    const provider = new ClaudeProvider("test-key")
    expect(provider.config.id).toBe("claude")
  })

  it("デフォルトモデルがclaude-sonnet-4-6である", () => {
    const provider = new ClaudeProvider("test-key")
    expect(provider.config.model).toBe("claude-sonnet-4-6")
  })

  describe("chat()", () => {
    it("Anthropic APIを呼んでレスポンスを返す", async () => {
      const provider = new ClaudeProvider("test-key")
      const result = await provider.chat("Hello")
      expect(result).toBe("claude response")
      expect(mockMessagesCreate).toHaveBeenCalledWith({
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        messages: [{ role: "user", content: "Hello" }],
      })
    })

    it("空レスポンスの場合は空文字を返す", async () => {
      mockMessagesCreate.mockResolvedValue({ content: [] })
      const provider = new ClaudeProvider("test-key")
      const result = await provider.chat("Hello")
      expect(result).toBe("")
    })
  })

  describe("analyzeImage()", () => {
    it("画像データをBase64で送信する", async () => {
      const provider = new ClaudeProvider("test-key")
      const imageData = Buffer.from("fake-image")
      await provider.analyzeImage(imageData, "image/png", "Describe this")

      expect(mockMessagesCreate).toHaveBeenCalledWith({
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: "image/png",
                  data: imageData.toString("base64"),
                },
              },
              { type: "text", text: "Describe this" },
            ],
          },
        ],
      })
    })
  })

  describe("testConnection()", () => {
    it("接続成功を返す", async () => {
      const provider = new ClaudeProvider("test-key")
      const result = await provider.testConnection()
      expect(result).toEqual({ success: true })
    })

    it("API失敗時にエラーを返す", async () => {
      mockMessagesCreate.mockRejectedValue(new Error("auth error"))
      const provider = new ClaudeProvider("test-key")
      const result = await provider.testConnection()
      expect(result.success).toBe(false)
    })
  })
})
