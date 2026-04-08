import fs from "fs"
import path from "path"
import { app } from "electron"
import { randomUUID } from "crypto"

export interface Playbook {
  id: string
  name: string
  description: string
  icon: string
  isBuiltIn: boolean
  guidelines: string
  responseStyle: string
  summaryFormat: string
}

export type PlaybookInput = Omit<Playbook, "id" | "isBuiltIn">

export const BUILT_IN_PLAYBOOKS: Playbook[] = [
  {
    id: "technical-interview",
    name: "Technical Interview",
    description: "Coaching for technical coding interviews",
    icon: "💻",
    isBuiltIn: true,
    guidelines: "Focus on problem-solving approach, time/space complexity analysis, and clear communication of thought process. Suggest clarifying questions before diving into code.",
    responseStyle: "structured, step-by-step",
    summaryFormat: "Problems discussed, approaches taken, areas for improvement",
  },
  {
    id: "sales-call",
    name: "Sales Call",
    description: "Real-time coaching for sales conversations",
    icon: "💰",
    isBuiltIn: true,
    guidelines: "Identify customer pain points, suggest value propositions, note objections and provide rebuttal suggestions. Focus on active listening cues and closing opportunities.",
    responseStyle: "persuasive, empathetic",
    summaryFormat: "Key pain points, objections raised, next steps, deal probability",
  },
  {
    id: "team-standup",
    name: "Team Standup",
    description: "Daily standup and team sync meetings",
    icon: "🤝",
    isBuiltIn: true,
    guidelines: "Track blockers, action items, and commitments. Flag when discussions go off-topic or exceed time limits. Note dependencies between team members.",
    responseStyle: "concise, action-oriented",
    summaryFormat: "Per-person updates, blockers, action items with owners",
  },
  {
    id: "vc-pitch",
    name: "VC Pitch",
    description: "Investor pitch and fundraising meetings",
    icon: "🚀",
    isBuiltIn: true,
    guidelines: "Track investor questions and concerns. Suggest data points to strengthen arguments. Note follow-up items and commitment signals. Flag unclear or weak responses.",
    responseStyle: "confident, data-driven",
    summaryFormat: "Key questions asked, concerns raised, follow-up commitments, investor sentiment",
  },
  {
    id: "customer-success",
    name: "Customer Success",
    description: "Customer onboarding and success calls",
    icon: "🎯",
    isBuiltIn: true,
    guidelines: "Track customer goals, feature adoption progress, and satisfaction signals. Identify upsell opportunities and churn risks. Note technical issues to escalate.",
    responseStyle: "supportive, solution-focused",
    summaryFormat: "Customer health score factors, feature requests, escalation items",
  },
  {
    id: "general",
    name: "General",
    description: "General-purpose meeting coaching",
    icon: "📋",
    isBuiltIn: true,
    guidelines: "Track key discussion points, decisions made, and action items. Flag when topics seem unresolved or need follow-up.",
    responseStyle: "neutral, balanced",
    summaryFormat: "Topics discussed, decisions made, action items, open questions",
  },
]

export class PlaybookHelper {
  private playbooksDir: string
  private customPlaybooks: Map<string, Playbook> = new Map()

  constructor(baseDir?: string) {
    const base = baseDir ?? app.getPath("userData")
    this.playbooksDir = path.join(base, "playbooks")
    if (!fs.existsSync(this.playbooksDir)) {
      fs.mkdirSync(this.playbooksDir, { recursive: true })
    }
    this.loadCustomPlaybooks()
  }

  private loadCustomPlaybooks(): void {
    try {
      const files = fs.readdirSync(this.playbooksDir).filter(f => f.endsWith(".json"))
      for (const file of files) {
        try {
          const raw = fs.readFileSync(path.join(this.playbooksDir, file), "utf-8")
          const pb = JSON.parse(raw) as Playbook
          this.customPlaybooks.set(pb.id, pb)
        } catch {
          // skip corrupt files
        }
      }
    } catch {
      // directory may not exist yet
    }
  }

  listPlaybooks(): Playbook[] {
    return [...BUILT_IN_PLAYBOOKS, ...this.customPlaybooks.values()]
  }

  getPlaybook(id: string): Playbook | null {
    const builtIn = BUILT_IN_PLAYBOOKS.find(p => p.id === id)
    if (builtIn) return builtIn
    return this.customPlaybooks.get(id) ?? null
  }

  createPlaybook(input: PlaybookInput): Playbook {
    const playbook: Playbook = {
      ...input,
      id: randomUUID(),
      isBuiltIn: false,
    }
    this.customPlaybooks.set(playbook.id, playbook)
    this.savePlaybook(playbook)
    return playbook
  }

  updatePlaybook(id: string, partial: Partial<PlaybookInput>): Playbook | null {
    const existing = this.customPlaybooks.get(id)
    if (!existing) return null // built-in or nonexistent

    const updated = { ...existing, ...partial }
    this.customPlaybooks.set(id, updated)
    this.savePlaybook(updated)
    return updated
  }

  deletePlaybook(id: string): boolean {
    if (!this.customPlaybooks.has(id)) return false

    this.customPlaybooks.delete(id)
    const filePath = path.join(this.playbooksDir, `${id}.json`)
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
    } catch {
      // ignore
    }
    return true
  }

  private savePlaybook(playbook: Playbook): void {
    const filePath = path.join(this.playbooksDir, `${playbook.id}.json`)
    fs.writeFileSync(filePath, JSON.stringify(playbook, null, 2))
  }
}
