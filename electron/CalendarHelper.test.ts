import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
  CalendarHelper,
  type CalendarEvent,
} from "./CalendarHelper"

describe("CalendarHelper", () => {
  let helper: CalendarHelper

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-02-24T10:00:00Z"))
    helper = new CalendarHelper()
  })

  afterEach(() => {
    helper.stopPolling()
    vi.useRealTimers()
  })

  it("イベントを手動で追加・取得できる", () => {
    const event: CalendarEvent = {
      id: "e1",
      title: "Standup",
      startTime: Date.now() + 30 * 60_000, // 30min later
      endTime: Date.now() + 60 * 60_000,
      description: "Daily standup",
    }

    helper.addEvent(event)
    const events = helper.getUpcomingEvents()

    expect(events).toHaveLength(1)
    expect(events[0].title).toBe("Standup")
  })

  it("過去のイベントはupcomingに含まれない", () => {
    helper.addEvent({
      id: "past",
      title: "Past Meeting",
      startTime: Date.now() - 60 * 60_000, // 1 hour ago
      endTime: Date.now() - 30 * 60_000,
    })
    helper.addEvent({
      id: "future",
      title: "Future Meeting",
      startTime: Date.now() + 30 * 60_000,
      endTime: Date.now() + 60 * 60_000,
    })

    const events = helper.getUpcomingEvents()
    expect(events).toHaveLength(1)
    expect(events[0].id).toBe("future")
  })

  it("イベントは開始時刻順にソートされる", () => {
    helper.addEvent({
      id: "later",
      title: "Later",
      startTime: Date.now() + 120 * 60_000,
      endTime: Date.now() + 150 * 60_000,
    })
    helper.addEvent({
      id: "sooner",
      title: "Sooner",
      startTime: Date.now() + 30 * 60_000,
      endTime: Date.now() + 60 * 60_000,
    })

    const events = helper.getUpcomingEvents()
    expect(events[0].id).toBe("sooner")
    expect(events[1].id).toBe("later")
  })

  it("次のイベントを取得できる", () => {
    helper.addEvent({
      id: "next",
      title: "Next Meeting",
      startTime: Date.now() + 10 * 60_000,
      endTime: Date.now() + 40 * 60_000,
    })

    const next = helper.getNextEvent()
    expect(next?.title).toBe("Next Meeting")
  })

  it("イベントがない場合はnullを返す", () => {
    expect(helper.getNextEvent()).toBeNull()
  })

  it("5分以内のイベントを通知候補として検出できる", () => {
    helper.addEvent({
      id: "soon",
      title: "Soon",
      startTime: Date.now() + 3 * 60_000, // 3 min away
      endTime: Date.now() + 30 * 60_000,
    })
    helper.addEvent({
      id: "far",
      title: "Far",
      startTime: Date.now() + 60 * 60_000, // 1 hour
      endTime: Date.now() + 90 * 60_000,
    })

    const imminent = helper.getImminentEvents(5)
    expect(imminent).toHaveLength(1)
    expect(imminent[0].id).toBe("soon")
  })

  it("Playbookの自動選択マッピングを設定・取得できる", () => {
    helper.setPlaybookMapping("standup", "team-standup")
    helper.setPlaybookMapping("interview", "technical-interview")

    expect(helper.getPlaybookMapping("standup")).toBe("team-standup")
    expect(helper.getPlaybookMapping("interview")).toBe("technical-interview")
    expect(helper.getPlaybookMapping("unknown")).toBeUndefined()
  })

  it("イベントタイトルからPlaybook IDを推測できる", () => {
    helper.setPlaybookMapping("standup", "team-standup")
    helper.setPlaybookMapping("interview", "technical-interview")
    helper.setPlaybookMapping("sales", "sales-call")

    expect(helper.suggestPlaybook("Daily Standup Call")).toBe("team-standup")
    expect(helper.suggestPlaybook("Technical Interview - Round 2")).toBe("technical-interview")
    expect(helper.suggestPlaybook("Sales Demo with Acme Corp")).toBe("sales-call")
    expect(helper.suggestPlaybook("Random Meeting")).toBeUndefined()
  })

  it("イベントをクリアできる", () => {
    helper.addEvent({
      id: "e1",
      title: "Test",
      startTime: Date.now() + 30 * 60_000,
      endTime: Date.now() + 60 * 60_000,
    })

    expect(helper.getUpcomingEvents()).toHaveLength(1)
    helper.clearEvents()
    expect(helper.getUpcomingEvents()).toHaveLength(0)
  })

  it("ICSテキストからイベントをパースできる", () => {
    const icsText = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:uid-123@example.com
SUMMARY:Team Sync
DTSTART:20260224T113000Z
DTEND:20260224T120000Z
DESCRIPTION:Weekly team sync meeting
END:VEVENT
BEGIN:VEVENT
UID:uid-456@example.com
SUMMARY:1:1 with Alice
DTSTART:20260224T140000Z
DTEND:20260224T143000Z
END:VEVENT
END:VCALENDAR`

    const events = CalendarHelper.parseICS(icsText)
    expect(events).toHaveLength(2)
    expect(events[0].title).toBe("Team Sync")
    expect(events[0].description).toBe("Weekly team sync meeting")
    expect(events[1].title).toBe("1:1 with Alice")
  })
})
