export interface CalendarEvent {
  id: string
  title: string
  startTime: number
  endTime: number
  description?: string
  location?: string
}

export class CalendarHelper {
  private events: CalendarEvent[] = []
  private playbookMappings: Map<string, string> = new Map()
  private pollInterval: ReturnType<typeof setInterval> | null = null

  addEvent(event: CalendarEvent): void {
    // Replace if same id exists
    this.events = this.events.filter((e) => e.id !== event.id)
    this.events.push(event)
  }

  clearEvents(): void {
    this.events = []
  }

  getUpcomingEvents(): CalendarEvent[] {
    const now = Date.now()
    return this.events
      .filter((e) => e.startTime > now)
      .sort((a, b) => a.startTime - b.startTime)
  }

  getNextEvent(): CalendarEvent | null {
    const upcoming = this.getUpcomingEvents()
    return upcoming.length > 0 ? upcoming[0] : null
  }

  /**
   * Get events starting within the next `minutes` minutes.
   */
  getImminentEvents(minutes: number): CalendarEvent[] {
    const now = Date.now()
    const threshold = now + minutes * 60_000
    return this.events
      .filter((e) => e.startTime > now && e.startTime <= threshold)
      .sort((a, b) => a.startTime - b.startTime)
  }

  // --- Playbook mapping ---

  setPlaybookMapping(keyword: string, playbookId: string): void {
    this.playbookMappings.set(keyword.toLowerCase(), playbookId)
  }

  getPlaybookMapping(keyword: string): string | undefined {
    return this.playbookMappings.get(keyword.toLowerCase())
  }

  /**
   * Suggest a playbook ID based on event title keyword matching.
   */
  suggestPlaybook(eventTitle: string): string | undefined {
    const titleLower = eventTitle.toLowerCase()
    for (const [keyword, playbookId] of this.playbookMappings) {
      if (titleLower.includes(keyword)) {
        return playbookId
      }
    }
    return undefined
  }

  // --- ICS parsing ---

  static parseICS(icsText: string): CalendarEvent[] {
    const events: CalendarEvent[] = []
    const eventBlocks = icsText.split("BEGIN:VEVENT")

    for (let i = 1; i < eventBlocks.length; i++) {
      const block = eventBlocks[i].split("END:VEVENT")[0]

      const uid = extractField(block, "UID")
      const summary = extractField(block, "SUMMARY")
      const dtstart = extractField(block, "DTSTART")
      const dtend = extractField(block, "DTEND")
      const description = extractField(block, "DESCRIPTION")
      const location = extractField(block, "LOCATION")

      if (uid && summary && dtstart && dtend) {
        events.push({
          id: uid,
          title: summary,
          startTime: parseICSDate(dtstart),
          endTime: parseICSDate(dtend),
          description: description || undefined,
          location: location || undefined,
        })
      }
    }

    return events
  }

  // --- Polling (for future ICS feed integration) ---

  startPolling(
    fetchFn: () => Promise<CalendarEvent[]>,
    intervalMs: number = 5 * 60_000
  ): void {
    this.stopPolling()
    const poll = async () => {
      try {
        const events = await fetchFn()
        this.events = events
      } catch (error) {
        console.error("Calendar poll failed:", error)
      }
    }
    poll() // Initial fetch
    this.pollInterval = setInterval(poll, intervalMs)
  }

  stopPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval)
      this.pollInterval = null
    }
  }
}

function extractField(block: string, fieldName: string): string | null {
  const regex = new RegExp(`^${fieldName}[^:]*:(.+)$`, "m")
  const match = block.match(regex)
  return match ? match[1].trim() : null
}

function parseICSDate(dateStr: string): number {
  // Basic ICS date format: 20260224T113000Z
  const match = dateStr.match(
    /(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?/
  )
  if (!match) return 0
  const [, year, month, day, hour, minute, second] = match
  return new Date(
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second)
    )
  ).getTime()
}
