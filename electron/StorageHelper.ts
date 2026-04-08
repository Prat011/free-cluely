import fs from "fs"
import path from "path"
import { app } from "electron"
import { randomUUID } from "crypto"

export interface TranscriptionEntry {
  speaker: "you" | "speaker"
  text: string
  timestamp: number
}

export interface ActionItem {
  id: string
  text: string
  owner: string | null
  deadline: string | null
  completed: boolean
}

export interface MeetingRecord {
  id: string
  title: string
  startedAt: number
  endedAt: number | null
  entries: TranscriptionEntry[]
  summary: string | null
  actionItems: ActionItem[]
  chunkSummaries: string[]
  metadata: {
    language: string
    providerId: string
    modelId: string
    playbook?: string
  }
}

export class StorageHelper {
  private meetingsDir: string

  constructor(baseDir?: string) {
    const base = baseDir ?? app.getPath("userData")
    this.meetingsDir = path.join(base, "meetings")
    if (!fs.existsSync(this.meetingsDir)) {
      fs.mkdirSync(this.meetingsDir, { recursive: true })
    }
  }

  createMeeting(title?: string): MeetingRecord {
    const record: MeetingRecord = {
      id: randomUUID(),
      title: title ?? "Untitled Meeting",
      startedAt: Date.now(),
      endedAt: null,
      entries: [],
      summary: null,
      actionItems: [],
      chunkSummaries: [],
      metadata: {
        language: "en-US",
        providerId: "gemini",
        modelId: "gemini-2.5-flash",
      },
    }
    this.saveMeeting(record)
    return record
  }

  getMeeting(id: string): MeetingRecord | null {
    const filePath = path.join(this.meetingsDir, `${id}.json`)
    try {
      if (!fs.existsSync(filePath)) return null
      const raw = fs.readFileSync(filePath, "utf-8")
      return JSON.parse(raw) as MeetingRecord
    } catch {
      return null
    }
  }

  saveMeeting(record: MeetingRecord): void {
    const filePath = path.join(this.meetingsDir, `${record.id}.json`)
    fs.writeFileSync(filePath, JSON.stringify(record, null, 2))
  }

  listMeetings(): MeetingRecord[] {
    try {
      const files = fs.readdirSync(this.meetingsDir).filter(f => f.endsWith(".json"))
      const records = files
        .map(f => {
          try {
            const raw = fs.readFileSync(path.join(this.meetingsDir, f), "utf-8")
            return JSON.parse(raw) as MeetingRecord
          } catch {
            return null
          }
        })
        .filter((r): r is MeetingRecord => r !== null)
      return records.sort((a, b) => b.startedAt - a.startedAt)
    } catch {
      return []
    }
  }

  deleteMeeting(id: string): boolean {
    const filePath = path.join(this.meetingsDir, `${id}.json`)
    try {
      if (!fs.existsSync(filePath)) return false
      fs.unlinkSync(filePath)
      return true
    } catch {
      return false
    }
  }

  addTranscriptionEntry(meetingId: string, entry: TranscriptionEntry): void {
    const record = this.getMeeting(meetingId)
    if (!record) throw new Error(`Meeting not found: ${meetingId}`)
    record.entries.push(entry)
    this.saveMeeting(record)
  }

  searchMeetings(query: string): MeetingRecord[] {
    const q = query.toLowerCase()
    return this.listMeetings().filter(record => {
      if (record.title.toLowerCase().includes(q)) return true
      if (record.summary?.toLowerCase().includes(q)) return true
      if (record.entries.some(e => e.text.toLowerCase().includes(q))) return true
      return false
    })
  }
}
