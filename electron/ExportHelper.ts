import { clipboard } from "electron"
import { StorageHelper } from "./StorageHelper"
import type { MeetingRecord } from "./StorageHelper"

export class ExportHelper {
  private storage: StorageHelper

  constructor(storage: StorageHelper) {
    this.storage = storage
  }

  toMarkdown(meetingId: string): string | null {
    const record = this.storage.getMeeting(meetingId)
    if (!record) return null

    const lines: string[] = []

    // Title
    lines.push(`# ${record.title}`)
    lines.push("")

    // Metadata
    const startDate = new Date(record.startedAt).toLocaleString()
    lines.push(`**Date:** ${startDate}`)
    if (record.endedAt) {
      const durationMin = Math.round((record.endedAt - record.startedAt) / 60000)
      lines.push(`**Duration:** ${durationMin} minutes`)
    }
    lines.push("")

    // Summary
    if (record.summary) {
      lines.push("## Summary")
      lines.push("")
      lines.push(record.summary)
      lines.push("")
    }

    // Action Items
    if (record.actionItems.length > 0) {
      lines.push("## Action Items")
      lines.push("")
      for (const item of record.actionItems) {
        const check = item.completed ? "[x]" : "[ ]"
        let line = `- ${check} ${item.text}`
        if (item.owner) line += ` (@${item.owner})`
        if (item.deadline) line += ` — ${item.deadline}`
        lines.push(line)
      }
      lines.push("")
    }

    // Transcript
    if (record.entries.length > 0) {
      lines.push("## Transcript")
      lines.push("")
      for (const entry of record.entries) {
        lines.push(`**[${entry.speaker}]** ${entry.text}`)
      }
      lines.push("")
    }

    return lines.join("\n")
  }

  copyToClipboard(meetingId: string): boolean {
    const md = this.toMarkdown(meetingId)
    if (!md) return false
    clipboard.writeText(md)
    return true
  }

  toJSON(meetingId: string): string | null {
    const record = this.storage.getMeeting(meetingId)
    if (!record) return null
    return JSON.stringify(record, null, 2)
  }
}
