import type { MeetingRecord } from "./StorageHelper"

export class WebhookHelper {
  private webhookUrl: string | null = null

  setWebhookUrl(url: string | null): void {
    this.webhookUrl = url
  }

  getWebhookUrl(): string | null {
    return this.webhookUrl
  }

  async sendMeetingEnded(meeting: MeetingRecord): Promise<{ success: boolean; error?: string }> {
    if (!this.webhookUrl) return { success: true }

    const payload = {
      event: "meeting.ended",
      timestamp: Date.now(),
      meeting: {
        id: meeting.id,
        title: meeting.title,
        startedAt: meeting.startedAt,
        endedAt: meeting.endedAt,
        summary: meeting.summary,
        actionItems: meeting.actionItems,
        entryCount: meeting.entries.length,
        metadata: meeting.metadata,
      },
    }

    try {
      const response = await fetch(this.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        return { success: false, error: `HTTP ${response.status}` }
      }

      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }
}
