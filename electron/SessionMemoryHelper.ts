import fs from "fs"
import path from "path"
import { app } from "electron"
import { buildFinalPrompt, MASTER_SYSTEM_PROMPT, PromptMode } from "./prompts"

export type SessionSource = "chat" | "audio" | "image" | "assistant" | "system"

export interface SessionEntry {
  id: string
  source: SessionSource
  text: string
  timestamp: number
  metadata?: Record<string, any>
}

interface SessionMemoryData {
  version: number
  createdAt: number
  updatedAt: number
  resumeContext: string
  resumeFileName: string | null
  entries: SessionEntry[]
}

const MAX_ENTRIES = 300
const MAX_PROMPT_ENTRIES = 60
const MAX_ENTRY_LENGTH = 4000

interface ResumeFileContent {
  fileName: string
  extension: string
  content: string
}

interface ResumeStructuredContext {
  total_files: number
  files: Array<{
    file_name: string
    extension: string
    content: {
      raw_text: string
      parsed_json?: any
      section_order: string[]
      sections: Record<string, string>
    }
  }>
}

export interface UnifiedPromptResult {
  prompt: string
  mode: PromptMode
  normalized: string
}

export class SessionMemoryHelper {
  private readonly memoryFilePath: string
  private data: SessionMemoryData

  constructor() {
    const memoryDir = path.join(app.getPath("userData"), "session")
    if (!fs.existsSync(memoryDir)) {
      fs.mkdirSync(memoryDir, { recursive: true })
    }

    this.memoryFilePath = path.join(memoryDir, "session-memory.json")
    this.data = this.loadData()

    if (this.shouldStartFreshSession()) {
      this.data = this.createEmptyData()
    }

    this.bootstrapResumeContext()
    this.ensureSystemEntry()
    this.persist()
  }

  private createEmptyData(): SessionMemoryData {
    const now = Date.now()
    return {
      version: 1,
      createdAt: now,
      updatedAt: now,
      resumeContext: "",
      resumeFileName: null,
      entries: []
    }
  }

  private shouldStartFreshSession(): boolean {
    const explicit = (process.env.STT_NEW_SESSION_ON_START || "").trim().toLowerCase()
    if (explicit === "true") {
      return true
    }
    if (explicit === "false") {
      return false
    }

    // npm start runs in development mode in this project; default to a fresh session there.
    return process.env.NODE_ENV === "development"
  }

  public getEntries(): SessionEntry[] {
    return [...this.data.entries]
  }

  public getResumeContext(): string {
    return this.data.resumeContext
  }

  public addEntry(source: SessionSource, text: string, metadata?: Record<string, any>): SessionEntry {
    const normalizedText = this.normalizeText(text)
    const entry: SessionEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      source,
      text: normalizedText,
      timestamp: Date.now(),
      metadata
    }

    this.data.entries.push(entry)
    if (this.data.entries.length > MAX_ENTRIES) {
      this.data.entries = this.data.entries.slice(-MAX_ENTRIES)
    }
    this.data.updatedAt = Date.now()
    this.persist()
    return entry
  }

  public buildUnifiedPrompt(source: SessionSource, inputText: string): UnifiedPromptResult {
    const normalized = this.normalizeText(inputText)
    const history = this.data.entries.slice(-MAX_PROMPT_ENTRIES)

    const historyBlock = history.length
      ? history
          .map((entry) => {
            const tag = entry.source.toUpperCase()
            const ts = new Date(entry.timestamp).toISOString()
            return `[${ts}] [${tag}] ${entry.text}`
          })
          .join("\n")
      : "No prior session history."

    const resumeBlock = this.data.resumeContext
      ? this.data.resumeContext
      : "No resume found in /resume folder. Tailor answers using only current session context."

    const { prompt, mode } = buildFinalPrompt({
      resumeBlock,
      historyBlock,
      source,
      normalized
    })

    return {
      prompt,
      mode,
      normalized
    }
  }

  private normalizeText(text: string): string {
    let normalized = (text || "").replace(/\r\n/g, "\n").replace(/\u0000/g, "")

    // Some providers return escaped newlines as literal "\\n" in plain text.
    if (!normalized.includes("\n") && normalized.includes("\\n")) {
      normalized = normalized.replace(/\\n/g, "\n")
    }

    normalized = normalized.trim()
    normalized = normalized.replace(/\n{4,}/g, "\n\n\n")

    return normalized.slice(0, MAX_ENTRY_LENGTH)
  }

  private loadData(): SessionMemoryData {
    if (!fs.existsSync(this.memoryFilePath)) {
      return this.createEmptyData()
    }

    try {
      const raw = fs.readFileSync(this.memoryFilePath, "utf-8")
      const parsed = JSON.parse(raw) as SessionMemoryData
      return {
        version: 1,
        createdAt: parsed.createdAt || Date.now(),
        updatedAt: parsed.updatedAt || Date.now(),
        resumeContext: parsed.resumeContext || "",
        resumeFileName: parsed.resumeFileName || null,
        entries: Array.isArray(parsed.entries) ? parsed.entries : []
      }
    } catch (error) {
      console.error("[SessionMemory] Failed to load existing memory. Starting fresh.", error)
      return this.createEmptyData()
    }
  }

  private ensureSystemEntry(): void {
    const exists = this.data.entries.some((entry) => entry.source === "system" && entry.metadata?.kind === "session-role")
    if (exists) {
      return
    }

    this.addEntry("system", `Session initialized with prompt role: ${MASTER_SYSTEM_PROMPT.split("\n")[0]}.`, {
      kind: "session-role"
    })
  }

  private bootstrapResumeContext(): void {
    const resumeInfos = this.findResumeTexts()
    if (resumeInfos.length === 0) {
      return
    }

    const structured = this.buildStructuredResumeContext(resumeInfos)
    const resumeContext = JSON.stringify(structured, null, 2)

    if (!resumeContext) {
      return
    }

    const fileNames = resumeInfos.map((info) => info.fileName)
    const fileNameKey = fileNames.join(", ")

    if (this.data.resumeFileName === fileNameKey && this.data.resumeContext === resumeContext) {
      return
    }

    this.data.resumeFileName = fileNameKey
    this.data.resumeContext = resumeContext

    const alreadyLogged = this.data.entries.some(
      (entry) => entry.source === "system" && entry.metadata?.kind === "resume-loaded" && entry.metadata?.fileName === fileNameKey
    )
    if (!alreadyLogged) {
      this.addEntry("system", `Resume context loaded from ${fileNames.length} file(s): ${fileNameKey}.`, {
        kind: "resume-loaded",
        fileName: fileNameKey,
        fileCount: fileNames.length
      })
    }
  }

  private buildStructuredResumeContext(resumeInfos: ResumeFileContent[]): ResumeStructuredContext {
    return {
      total_files: resumeInfos.length,
      files: resumeInfos.map((info) => {
        const normalizedContent = info.content.replace(/\r\n/g, "\n").replace(/\u0000/g, "")
        const sections = this.extractSectionsFromText(normalizedContent, info.extension)
        const parsedJson = this.tryParseJson(info.content, info.extension)

        return {
          file_name: info.fileName,
          extension: info.extension,
          content: {
            raw_text: info.content,
            ...(parsedJson !== undefined ? { parsed_json: parsedJson } : {}),
            section_order: Object.keys(sections),
            sections
          }
        }
      })
    }
  }

  private tryParseJson(content: string, extension: string): any | undefined {
    if (extension !== ".json") {
      return undefined
    }

    try {
      return JSON.parse(content)
    } catch {
      return undefined
    }
  }

  private extractSectionsFromText(content: string, extension: string): Record<string, string> {
    const lines = content.split("\n")
    const bucketMap = new Map<string, string[]>()
    let currentKey = "full_document"
    bucketMap.set(currentKey, [])

    for (const line of lines) {
      const heading = this.detectSectionHeading(line, extension)
      if (heading) {
        currentKey = this.createUniqueSectionKey(heading, bucketMap)
        if (!bucketMap.has(currentKey)) {
          bucketMap.set(currentKey, [])
        }
        continue
      }

      const bucket = bucketMap.get(currentKey)
      if (bucket) {
        bucket.push(line)
      }
    }

    const result: Record<string, string> = {
      full_document: content
    }
    for (const [key, sectionLines] of bucketMap.entries()) {
      if (key === "full_document") {
        continue
      }
      result[key] = sectionLines.join("\n")
    }

    return result
  }

  private detectSectionHeading(line: string, extension: string): string | null {
    const trimmed = line.trim()
    if (!trimmed) {
      return null
    }

    const markdownHeading = trimmed.match(/^#{1,6}\s+(.+)$/)
    if (markdownHeading) {
      return markdownHeading[1]
    }

    const colonHeading = trimmed.match(/^([A-Za-z][A-Za-z0-9 &/().,\-]{1,100}):\s*$/)
    if (colonHeading) {
      return colonHeading[1]
    }

    const uppercaseHeading = /^[A-Z][A-Z0-9 &/().,\-]{2,100}$/.test(trimmed)
    if (uppercaseHeading) {
      return trimmed
    }

    if (extension === ".json") {
      const jsonLikeHeading = trimmed.match(/^"([^"]+)"\s*:\s*[\[{]?$/)
      if (jsonLikeHeading) {
        return jsonLikeHeading[1]
      }
    }

    return null
  }

  private createUniqueSectionKey(heading: string, buckets: Map<string, string[]>): string {
    const base = this.toSectionKey(heading)
    if (!buckets.has(base)) {
      return base
    }

    let i = 2
    while (buckets.has(`${base}_${i}`)) {
      i += 1
    }
    return `${base}_${i}`
  }

  private toSectionKey(value: string): string {
    const slug = value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")

    return slug || "section"
  }

  private findResumeTexts(): ResumeFileContent[] {
    const candidateDirs = [
      path.join(process.cwd(), "resume"),
      path.join(process.cwd(), "Resume"),
      path.join(app.getAppPath(), "resume")
    ]

    const extensions = new Set([".txt", ".md", ".json", ".yaml", ".yml", ".pdf"])
    const results: ResumeFileContent[] = []

    for (const dir of candidateDirs) {
      if (!fs.existsSync(dir)) {
        continue
      }

      const files = fs
        .readdirSync(dir)
        .filter((name) => extensions.has(path.extname(name).toLowerCase()))
        .sort((a, b) => a.localeCompare(b))

      for (const file of files) {
        const selectedPath = path.join(dir, file)
        const ext = path.extname(file).toLowerCase()

        try {
          if (ext === ".pdf") {
            const parsed = this.extractPdfText(selectedPath)
            results.push({ fileName: file, extension: ext, content: parsed })
            continue
          }

          const raw = fs.readFileSync(selectedPath, "utf-8")
          results.push({
            fileName: file,
            extension: ext,
            content: raw
          })
        } catch (error) {
          console.error(`[SessionMemory] Failed to read resume file ${selectedPath}:`, error)
        }
      }
    }

    return results
  }

  private extractPdfText(filePath: string): string {
    try {
      const fileBuffer = fs.readFileSync(filePath)
      const binary = fileBuffer.toString("latin1")

      const directChunks: string[] = []
      const directRegex = /\(([^()]*)\)\s*Tj/g
      let match: RegExpExecArray | null
      while ((match = directRegex.exec(binary)) !== null) {
        const decoded = match[1]
          .replace(/\\\(/g, "(")
          .replace(/\\\)/g, ")")
          .replace(/\\n/g, "\n")
          .replace(/\\r/g, "")
          .replace(/\\t/g, "\t")
        if (decoded.trim()) {
          directChunks.push(decoded)
        }
      }

      const bracketChunks: string[] = []
      const bracketRegex = /\[(.*?)\]\s*TJ/gs
      while ((match = bracketRegex.exec(binary)) !== null) {
        const piece = match[1]
          .replace(/\([^)]*\)|-?\d+(?:\.\d+)?/g, " ")
          .replace(/\s+/g, " ")
          .trim()
        if (piece) {
          bracketChunks.push(piece)
        }
      }

      let extracted = [...directChunks, ...bracketChunks].join("\n").trim()

      if (!extracted) {
        const asciiRuns = binary.match(/[A-Za-z0-9][A-Za-z0-9,.;:@()\-_/+ ]{5,}/g) || []
        extracted = asciiRuns
          .map((run) => run.trim())
          .filter((run) => run.length > 8)
          .join("\n")
          .trim()
      }

      if (!extracted) {
        return `[PDF resume detected but text extraction was limited: ${path.basename(filePath)}]`
      }

      return extracted
    } catch {
      return `[PDF resume detected: ${path.basename(filePath)}]`
    }
  }

  private persist(): void {
    try {
      const toWrite: SessionMemoryData = {
        ...this.data,
        updatedAt: Date.now()
      }
      fs.writeFileSync(this.memoryFilePath, JSON.stringify(toWrite, null, 2), "utf-8")
      this.data = toWrite
    } catch (error) {
      console.error("[SessionMemory] Failed to persist memory:", error)
    }
  }
}
