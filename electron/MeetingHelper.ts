import { randomUUID } from "crypto"
import { StorageHelper } from "./StorageHelper"
import type { MeetingRecord, TranscriptionEntry, ActionItem } from "./StorageHelper"
import {
  buildSummaryPrompt,
  buildChunkSummaryPrompt,
  buildCombineSummaryPrompt,
  buildActionItemsPrompt,
} from "./prompts/meeting-prompts"

/** 15 minutes in milliseconds — chunk boundary for Map-Reduce summarization */
const CHUNK_DURATION_MS = 15 * 60 * 1000

export type ChatFn = (prompt: string) => Promise<string>

export class MeetingHelper {
  private storage: StorageHelper
  private chat: ChatFn
  private currentMeetingId: string | null = null

  constructor(storage: StorageHelper, chat: ChatFn) {
    this.storage = storage
    this.chat = chat
  }

  startMeeting(title?: string): MeetingRecord {
    if (this.currentMeetingId) {
      throw new Error("A meeting is already in progress")
    }
    const record = this.storage.createMeeting(title)
    this.currentMeetingId = record.id
    return record
  }

  getCurrentMeeting(): MeetingRecord | null {
    if (!this.currentMeetingId) return null
    return this.storage.getMeeting(this.currentMeetingId)
  }

  addEntry(entry: TranscriptionEntry): void {
    if (!this.currentMeetingId) {
      throw new Error("No active meeting")
    }
    this.storage.addTranscriptionEntry(this.currentMeetingId, entry)
  }

  async endMeeting(): Promise<MeetingRecord> {
    if (!this.currentMeetingId) {
      throw new Error("No active meeting")
    }
    const record = this.storage.getMeeting(this.currentMeetingId)!
    record.endedAt = Date.now()

    if (record.entries.length > 0) {
      record.summary = await this.generateSummary(record.id)
    }

    this.storage.saveMeeting(record)
    this.currentMeetingId = null
    return record
  }

  async generateSummary(meetingId: string): Promise<string | null> {
    const record = this.storage.getMeeting(meetingId)
    if (!record || record.entries.length === 0) return null

    const chunks = this.chunkEntries(record.entries)

    if (chunks.length <= 1) {
      const transcript = this.formatTranscript(record.entries)
      const summary = await this.chat(buildSummaryPrompt(transcript))
      record.summary = summary
      this.storage.saveMeeting(record)
      return summary
    }

    // Map phase: summarize each chunk
    const chunkSummaries: string[] = []
    for (let i = 0; i < chunks.length; i++) {
      const transcript = this.formatTranscript(chunks[i])
      const chunkSummary = await this.chat(
        buildChunkSummaryPrompt(transcript, i + 1, chunks.length)
      )
      chunkSummaries.push(chunkSummary)
    }

    record.chunkSummaries = chunkSummaries

    // Reduce phase: combine chunk summaries
    const finalSummary = await this.chat(buildCombineSummaryPrompt(chunkSummaries))
    record.summary = finalSummary
    this.storage.saveMeeting(record)
    return finalSummary
  }

  async extractActionItems(meetingId: string): Promise<ActionItem[]> {
    const record = this.storage.getMeeting(meetingId)
    if (!record || record.entries.length === 0) return []

    const transcript = this.formatTranscript(record.entries)
    const response = await this.chat(buildActionItemsPrompt(transcript))

    try {
      const parsed = JSON.parse(response)
      if (!Array.isArray(parsed)) return []

      const items: ActionItem[] = parsed.map((raw: any) => ({
        id: randomUUID(),
        text: String(raw.text || ""),
        owner: raw.owner ?? null,
        deadline: raw.deadline ?? null,
        completed: false,
      }))

      record.actionItems = items
      this.storage.saveMeeting(record)
      return items
    } catch {
      return []
    }
  }

  private formatTranscript(entries: TranscriptionEntry[]): string {
    return entries
      .map(e => `[${e.speaker}] ${e.text}`)
      .join("\n")
  }

  private chunkEntries(entries: TranscriptionEntry[]): TranscriptionEntry[][] {
    if (entries.length === 0) return []

    const chunks: TranscriptionEntry[][] = []
    let currentChunk: TranscriptionEntry[] = []
    let chunkStart = entries[0].timestamp

    for (const entry of entries) {
      if (entry.timestamp - chunkStart >= CHUNK_DURATION_MS && currentChunk.length > 0) {
        chunks.push(currentChunk)
        currentChunk = []
        chunkStart = entry.timestamp
      }
      currentChunk.push(entry)
    }

    if (currentChunk.length > 0) {
      chunks.push(currentChunk)
    }

    return chunks
  }
}
