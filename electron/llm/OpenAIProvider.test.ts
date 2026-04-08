import { describe, it, expect, vi, beforeEach } from "vitest"

const { mockCreate } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
}))

vi.mock("openai", () => {
  class MockOpenAI {
    chat = { completions: { create: mockCreate } }
    constructor(_opts: any) {}
  }
  return { default: MockOpenAI }
})

import { OpenAIProvider } from "./OpenAIProvider"

describe("OpenAIProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: "openai response" } }],
    })
  })

  it("config.idが'openai'である", () => {
    const provider = new OpenAIProvider("test-key")
    expect(provider.config.id).toBe("openai")
  })

  it("デフォルトモデルがgpt-4oである", () => {
    const provider = new OpenAIProvider("test-key")
    expect(provider.config.model).toBe("gpt-4o")
  })

  it("カスタムモデルを指定できる", () => {
    const provider = new OpenAIProvider("test-key", "gpt-5-mini")
    expect(provider.config.model).toBe("gpt-5-mini")
  })

  describe("chat()", () => {
    it("OpenAI APIを呼んでレスポンスを返す", async () => {
      const provider = new OpenAIProvider("test-key")
      const result = await provider.chat("Hello")
      expect(result).toBe("openai response")
      expect(mockCreate).toHaveBeenCalledWith({
        model: "gpt-4o",
        messages: [{ role: "user", content: "Hello" }],
      })
    })

    it("空レスポンスの場合は空文字を返す", async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: null } }],
      })
      const provider = new OpenAIProvider("test-key")
      const result = await provider.chat("Hello")
      expect(result).toBe("")
    })
  })

  describe("analyzeImage()", () => {
    it("画像データをBase64で送信する", async () => {
      const provider = new OpenAIProvider("test-key")
      const imageData = Buffer.from("fake-image")
      await provider.analyzeImage(imageData, "image/png", "Describe this")

      expect(mockCreate).toHaveBeenCalledWith({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "Describe this" },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/png;base64,${imageData.toString("base64")}`,
                },
              },
            ],
          },
        ],
      })
    })
  })

  describe("testConnection()", () => {
    it("接続成功を返す", async () => {
      const provider = new OpenAIProvider("test-key")
      const result = await provider.testConnection()
      expect(result).toEqual({ success: true })
    })

    it("API失敗時にエラーを返す", async () => {
      mockCreate.mockRejectedValue(new Error("auth error"))
      const provider = new OpenAIProvider("test-key")
      const result = await provider.testConnection()
      expect(result.success).toBe(false)
      expect(result.error).toContain("auth error")
    })
  })
})
