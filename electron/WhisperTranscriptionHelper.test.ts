import { describe, it, expect, vi, beforeEach } from "vitest"
import { WhisperTranscriptionHelper } from "./WhisperTranscriptionHelper"

// Mock the openai module
const mockCreate = vi.fn()

vi.mock("openai", () => {
  class MockOpenAI {
    audio = {
      transcriptions: {
        create: mockCreate,
      },
    }
  }
  return { default: MockOpenAI }
})

// Mock fs
vi.mock("node:fs", () => ({
  default: {
    createReadStream: vi.fn().mockReturnValue("mock-stream"),
    existsSync: vi.fn().mockReturnValue(true),
  },
  createReadStream: vi.fn().mockReturnValue("mock-stream"),
  existsSync: vi.fn().mockReturnValue(true),
}))

describe("WhisperTranscriptionHelper", () => {
  let helper: WhisperTranscriptionHelper

  beforeEach(() => {
    vi.clearAllMocks()
    helper = new WhisperTranscriptionHelper("test-api-key")
  })

  it("音声ファイルをテキストに文字起こしできる", async () => {
    mockCreate.mockResolvedValue({ text: "Hello world" })

    const result = await helper.transcribe("/path/to/audio.mp3")

    expect(result.text).toBe("Hello world")
    expect(result.timestamp).toBeGreaterThan(0)
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "whisper-1",
        file: "mock-stream",
      })
    )
  })

  it("言語を指定して文字起こしできる", async () => {
    mockCreate.mockResolvedValue({ text: "こんにちは" })

    const result = await helper.transcribe("/path/to/audio.mp3", { language: "ja" })

    expect(result.text).toBe("こんにちは")
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        language: "ja",
      })
    )
  })

  it("言語未指定時はauto-detect（languageパラメータなし）", async () => {
    mockCreate.mockResolvedValue({ text: "Bonjour" })

    await helper.transcribe("/path/to/audio.mp3")

    const callArgs = mockCreate.mock.calls[0][0]
    expect(callArgs.language).toBeUndefined()
  })

  it("verbose_json形式でレスポンスを取得できる", async () => {
    mockCreate.mockResolvedValue({
      text: "Hello",
      language: "english",
      duration: 5.2,
    })

    const result = await helper.transcribeVerbose("/path/to/audio.mp3")

    expect(result.text).toBe("Hello")
    expect(result.detectedLanguage).toBe("english")
    expect(result.duration).toBe(5.2)
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        response_format: "verbose_json",
      })
    )
  })

  it("プロンプトを指定できる", async () => {
    mockCreate.mockResolvedValue({ text: "technical term" })

    await helper.transcribe("/path/to/audio.mp3", {
      prompt: "This is a technical discussion about TypeScript",
    })

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: "This is a technical discussion about TypeScript",
      })
    )
  })

  it("API呼び出し失敗時はエラーを投げる", async () => {
    mockCreate.mockRejectedValue(new Error("API rate limit exceeded"))

    await expect(helper.transcribe("/path/to/audio.mp3")).rejects.toThrow(
      "Whisper transcription failed: API rate limit exceeded"
    )
  })

  it("存在しないファイルはエラーになる", async () => {
    const fs = await import("node:fs")
    vi.mocked(fs.default.existsSync).mockReturnValueOnce(false)

    await expect(helper.transcribe("/nonexistent/file.mp3")).rejects.toThrow(
      "Audio file not found"
    )
  })

  it("サポートされる言語一覧を返せる", () => {
    const languages = WhisperTranscriptionHelper.getSupportedLanguages()

    expect(languages).toContain("ja")
    expect(languages).toContain("en")
    expect(languages).toContain("zh")
    expect(languages).toContain("ko")
    expect(languages).toContain("fr")
    expect(languages.length).toBeGreaterThan(50)
  })
})
