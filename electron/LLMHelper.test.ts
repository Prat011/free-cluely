import { describe, it, expect, vi, beforeEach, type Mock } from "vitest"

// vi.hoistedでモック関数を先に定義（vi.mockはホイストされるため）
const { mockGenerateContent } = vi.hoisted(() => ({
  mockGenerateContent: vi.fn(),
}))

// Mock @google/genai (新SDK)
vi.mock("@google/genai", () => {
  class MockGoogleGenAI {
    models = { generateContent: mockGenerateContent }
    constructor(_opts: any) {}
  }
  return { GoogleGenAI: MockGoogleGenAI }
})

// Mock fs
vi.mock("fs", () => ({
  default: {
    promises: {
      readFile: vi.fn().mockResolvedValue(Buffer.from("fake-image-data")),
    },
  },
}))

import { LLMHelper } from "./LLMHelper"

describe("LLMHelper", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGenerateContent.mockResolvedValue({ text: "mocked response" })
  })

  describe("Geminiモードの初期化", () => {
    it("APIキーを渡すとGeminiモードで初期化される", () => {
      const helper = new LLMHelper("test-api-key")
      expect(helper.getCurrentProvider()).toBe("gemini")
      expect(helper.isUsingOllama()).toBe(false)
    })

    it("モデル名がgemini-2.5-flashである", () => {
      const helper = new LLMHelper("test-api-key")
      expect(helper.getCurrentModel()).toBe("gemini-2.5-flash")
    })

    it("APIキーもOllamaもない場合はエラーになる", () => {
      expect(() => new LLMHelper()).toThrow(
        "Either provide Gemini API key or enable Ollama mode"
      )
    })
  })

  describe("Ollamaモードの初期化", () => {
    beforeEach(() => {
      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes("/api/tags")) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                models: [{ name: "llama3.2" }, { name: "gemma:latest" }],
              }),
          })
        }
        if (url.includes("/api/generate")) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({ response: "hello from ollama", done: true }),
          })
        }
        return Promise.resolve({ ok: false })
      }) as Mock
    })

    it("Ollamaモードで初期化される", () => {
      const helper = new LLMHelper(undefined, true, "llama3.2")
      expect(helper.getCurrentProvider()).toBe("ollama")
      expect(helper.isUsingOllama()).toBe(true)
    })

    it("指定したモデル名が返る", () => {
      const helper = new LLMHelper(undefined, true, "llama3.2")
      expect(helper.getCurrentModel()).toBe("llama3.2")
    })
  })

  describe("chat()", () => {
    it("Geminiモードでレスポンステキストを返す", async () => {
      const helper = new LLMHelper("test-api-key")
      const result = await helper.chat("Hello")
      expect(result).toBe("mocked response")
      expect(mockGenerateContent).toHaveBeenCalledWith({
        model: "gemini-2.5-flash",
        contents: "Hello",
      })
    })

    it("Ollamaモードでレスポンステキストを返す", async () => {
      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes("/api/tags")) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({ models: [{ name: "llama3.2" }] }),
          })
        }
        if (url.includes("/api/generate")) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({ response: "ollama says hi", done: true }),
          })
        }
        return Promise.resolve({ ok: false })
      }) as Mock

      const helper = new LLMHelper(undefined, true, "llama3.2")
      const result = await helper.chat("Hello")
      expect(result).toBe("ollama says hi")
    })
  })

  describe("extractProblemFromImages()", () => {
    it("画像パスを受け取りJSON結果を返す", async () => {
      const jsonResponse = JSON.stringify({
        problem_statement: "test problem",
        context: "test context",
        suggested_responses: ["option 1"],
        reasoning: "test reason",
      })
      mockGenerateContent.mockResolvedValue({ text: jsonResponse })

      const helper = new LLMHelper("test-api-key")
      const result = await helper.extractProblemFromImages([
        "/path/to/image.png",
      ])

      expect(result).toEqual({
        problem_statement: "test problem",
        context: "test context",
        suggested_responses: ["option 1"],
        reasoning: "test reason",
      })
    })

    it("markdownコードブロック付きレスポンスも正しくパースする", async () => {
      const jsonResponse =
        '```json\n{"problem_statement":"test","context":"ctx","suggested_responses":[],"reasoning":"r"}\n```'
      mockGenerateContent.mockResolvedValue({ text: jsonResponse })

      const helper = new LLMHelper("test-api-key")
      const result = await helper.extractProblemFromImages([
        "/path/to/image.png",
      ])
      expect(result.problem_statement).toBe("test")
    })
  })

  describe("generateSolution()", () => {
    it("問題情報を受け取りソリューションJSONを返す", async () => {
      const solution = {
        solution: {
          code: "console.log('hello')",
          problem_statement: "test",
          context: "ctx",
          suggested_responses: [],
          reasoning: "r",
        },
      }
      mockGenerateContent.mockResolvedValue({
        text: JSON.stringify(solution),
      })

      const helper = new LLMHelper("test-api-key")
      const result = await helper.generateSolution({ problem: "test" })
      expect(result.solution.code).toBe("console.log('hello')")
    })
  })

  describe("testConnection()", () => {
    it("Geminiモードで接続成功を返す", async () => {
      mockGenerateContent.mockResolvedValue({ text: "Hello" })

      const helper = new LLMHelper("test-api-key")
      const result = await helper.testConnection()
      expect(result).toEqual({ success: true })
    })

    it("Geminiモードで空レスポンスの場合エラーを返す", async () => {
      mockGenerateContent.mockResolvedValue({ text: "" })

      const helper = new LLMHelper("test-api-key")
      const result = await helper.testConnection()
      expect(result).toEqual({
        success: false,
        error: "Empty response from Gemini",
      })
    })
  })

  describe("switchToGemini()", () => {
    it("Geminiモードに切り替わる", async () => {
      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes("/api/tags")) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({ models: [{ name: "llama3.2" }] }),
          })
        }
        if (url.includes("/api/generate")) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({ response: "ok", done: true }),
          })
        }
        return Promise.resolve({ ok: false })
      }) as Mock

      const helper = new LLMHelper(undefined, true, "llama3.2")
      expect(helper.getCurrentProvider()).toBe("ollama")

      await helper.switchToGemini("new-api-key")
      expect(helper.getCurrentProvider()).toBe("gemini")
      expect(helper.getCurrentModel()).toBe("gemini-2.5-flash")
    })
  })
})
