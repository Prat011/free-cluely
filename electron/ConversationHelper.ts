import fs from "fs"
import path from "path"
import { app } from "electron"

const MAX_MESSAGES = 50

export interface ConversationMessage {
  role: "user" | "assistant"
  content: string
  timestamp: number
}

export class ConversationHelper {
  private filePath: string
  private messages: ConversationMessage[] = []

  constructor(baseDir?: string) {
    const base = baseDir ?? app.getPath("userData")
    this.filePath = path.join(base, "conversation-history.json")
    this.load()
  }

  private load(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, "utf-8")
        this.messages = JSON.parse(raw)
      }
    } catch {
      this.messages = []
    }
  }

  private save(): void {
    try {
      const dir = path.dirname(this.filePath)
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(this.filePath, JSON.stringify(this.messages, null, 2))
    } catch (err) {
      console.error("[ConversationHelper] Failed to save:", err)
    }
  }

  addMessage(role: "user" | "assistant", content: string): void {
    this.messages.push({ role, content, timestamp: Date.now() })

    // Trim to max
    if (this.messages.length > MAX_MESSAGES) {
      this.messages = this.messages.slice(-MAX_MESSAGES)
    }

    this.save()
  }

  getMessages(limit?: number): ConversationMessage[] {
    if (limit === undefined) return [...this.messages]
    return this.messages.slice(-limit)
  }

  getContextString(limit: number = MAX_MESSAGES): string {
    const msgs = this.getMessages(limit)
    if (msgs.length === 0) return ""
    return msgs.map(m => `[${m.role}] ${m.content}`).join("\n")
  }

  clear(): void {
    this.messages = []
    this.save()
  }
}
