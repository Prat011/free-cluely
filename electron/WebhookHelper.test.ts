import { describe, it, expect, beforeEach, vi } from "vitest"
import { WebhookHelper } from "./WebhookHelper"
import type { MeetingRecord } from "./StorageHelper"

vi.mock("electron", () => ({
  app: {
    getPath: vi.fn(() => "/mock/userData"),
  },
}))

// Mock global fetch
const mockFetch = vi.fn()
vi.stubGlobal("fetch", mockFetch)

describe("WebhookHelper", () => {
  let helper: WebhookHelper

  const sampleMeeting: MeetingRecord = {
    id: "test-123",
    title: "Test Meeting",
    startedAt: 1000000,
    endedAt: 1800000,
    entries: [{ speaker: "you", text: "Hello", timestamp: 1000000 }],
    summary: "Test summary",
    actionItems: [{ id: "a1", text: "Task 1", owner: "Alice", deadline: null, completed: false }],
    chunkSummaries: [],
    metadata: { language: "en-US", providerId: "gemini", modelId: "gemini-2.5-flash" },
  }

  beforeEach(() => {
    helper = new WebhookHelper()
    mockFetch.mockReset()
  })

  describe("setWebhookUrl()", () => {
    it("URLを設定する", () => {
      helper.setWebhookUrl("https://example.com/hook")
      expect(helper.getWebhookUrl()).toBe("https://example.com/hook")
    })

    it("nullで無効化する", () => {
      helper.setWebhookUrl("https://example.com/hook")
      helper.setWebhookUrl(null)
      expect(helper.getWebhookUrl()).toBeNull()
    })
  })

  describe("sendMeetingEnded()", () => {
    it("URLが設定されている場合にPOSTリクエストを送信する", async () => {
      mockFetch.mockResolvedValueOnce({ ok: true })

      helper.setWebhookUrl("https://example.com/hook")
      const result = await helper.sendMeetingEnded(sampleMeeting)
      expect(result.success).toBe(true)
      expect(mockFetch).toHaveBeenCalledTimes(1)

      const [url, options] = mockFetch.mock.calls[0]
      expect(url).toBe("https://example.com/hook")
      expect(options.method).toBe("POST")
      expect(options.headers["Content-Type"]).toBe("application/json")

      const body = JSON.parse(options.body)
      expect(body.event).toBe("meeting.ended")
      expect(body.meeting.title).toBe("Test Meeting")
    })

    it("URLが未設定の場合はスキップする", async () => {
      const result = await helper.sendMeetingEnded(sampleMeeting)
      expect(result.success).toBe(true)
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it("fetchエラー時にsucess:falseを返す", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"))

      helper.setWebhookUrl("https://example.com/hook")
      const result = await helper.sendMeetingEnded(sampleMeeting)
      expect(result.success).toBe(false)
      expect(result.error).toContain("Network error")
    })

    it("非200レスポンスでsuccess:falseを返す", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 })

      helper.setWebhookUrl("https://example.com/hook")
      const result = await helper.sendMeetingEnded(sampleMeeting)
      expect(result.success).toBe(false)
    })
  })
})
