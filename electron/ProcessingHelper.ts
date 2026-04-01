// ProcessingHelper.ts

import { AppState } from "./main"
import { LLMHelper } from "./LLMHelper.js"
import { SessionMemoryHelper, SessionSource } from "./SessionMemoryHelper"
import { ChildProcessWithoutNullStreams, spawn } from "child_process"
import path from "path"
import fs from "fs"
import { recognize } from "tesseract.js"
import dotenv from "dotenv"

dotenv.config()

const isDev = process.env.NODE_ENV === "development"
const isDevTest = process.env.IS_DEV_TEST === "true"
const MOCK_API_WAIT_TIME = Number(process.env.MOCK_API_WAIT_TIME) || 500

type RealtimeAudioSource = "mic" | "system"
type RealtimeAudioSourceMode = RealtimeAudioSource | "both"

interface RealtimeTranscriptChunk {
  source: RealtimeAudioSource
  text: string
}

type ScreenshotUnderstandingMode = "ocr" | "ocr-llm-filter" | "multimodal"

interface GithubRepositorySignal {
  fullName: string
  url: string
  description: string
  stars: number
  language: string
  topics: string[]
  relevanceScore: number
}

interface WebSearchSignal {
  title: string
  url: string
  snippet: string
  domain: string
  sourceType: "official-docs" | "geeksforgeeks" | "github" | "other"
  sourcePriority: number
  relevanceScore: number
  originalRank: number
}

export class ProcessingHelper {
  private appState: AppState
  private llmHelper: LLMHelper
  private sessionMemory: SessionMemoryHelper
  private currentProcessingAbortController: AbortController | null = null
  private currentExtraProcessingAbortController: AbortController | null = null
  private realtimeSttProcess: ChildProcessWithoutNullStreams | null = null
  private realtimeSttActive: boolean = false
  private realtimeTranscriptFinalChunks: RealtimeTranscriptChunk[] = []
  private realtimeTranscriptSourceMode: RealtimeAudioSourceMode = "both"
  private realtimeTranscriptPartialBySource: Record<RealtimeAudioSource, string> = {
    mic: "",
    system: ""
  }
  private realtimeTranscriptPartial: string = ""
  private realtimeStopPromise: Promise<string> | null = null
  private realtimeStopResolve: ((value: string) => void) | null = null
  private realtimeTogglePromise: Promise<any> | null = null
  private realtimeSttStartedAt: number = 0
  private screenshotUnderstandingModeOverride: ScreenshotUnderstandingMode | null = null
  private attemptedVoskQualityUpgrade: boolean = false

  private logFilledPrompt(prompt: string, source: SessionSource, mode: string): void {
    const timestamp = new Date().toISOString()
    const header = [
      "",
      "================ LLM FILLED PROMPT START ================",
      `[timestamp] ${timestamp}`,
      `[source] ${source}`,
      `[mode] ${mode}`,
      "========================================================"
    ].join("\n")

    const footer = "================= LLM FILLED PROMPT END ================="
    console.log(`${header}\n${prompt}\n${footer}`)

    try {
      const debugDir = path.join(process.cwd(), ".debug")
      if (!fs.existsSync(debugDir)) {
        fs.mkdirSync(debugDir, { recursive: true })
      }

      const debugPath = path.join(debugDir, "last-llm-filled-prompt.txt")
      const payload = `${header}\n${prompt}\n${footer}\n`
      fs.writeFileSync(debugPath, payload, "utf-8")
    } catch (error) {
      console.warn("[ProcessingHelper] Failed to write filled prompt debug file:", error)
    }
  }

  constructor(appState: AppState) {
    this.appState = appState
    this.sessionMemory = new SessionMemoryHelper()

    const providerPreference = (process.env.LLM_PROVIDER || "").trim().toLowerCase()
    const useNvidiaEnv = process.env.USE_NVIDIA
    const nvidiaRequested = useNvidiaEnv === "true" || (useNvidiaEnv !== "false" && Boolean(process.env.NVIDIA_API_KEY))
    const nvidiaApiKey = process.env.NVIDIA_API_KEY
    const nvidiaModel = process.env.NVIDIA_MODEL || "mistralai/mistral-small-3.1-24b-instruct-2503"
    const nvidiaFallbackModel = process.env.NVIDIA_FALLBACK_MODEL
    const nvidiaUrl = process.env.NVIDIA_URL || "https://integrate.api.nvidia.com/v1/chat/completions"

    // Check if user wants to use Ollama
    const ollamaRequested = process.env.USE_OLLAMA === "true"
    const ollamaModel = process.env.OLLAMA_MODEL // Don't set default here, let LLMHelper auto-detect
    const ollamaUrl = process.env.OLLAMA_URL || "http://localhost:11434"

    const useNvidia = providerPreference === "nvidia" || (providerPreference === "" && nvidiaRequested)
    const useOllama = providerPreference === "ollama" || (providerPreference === "" && ollamaRequested)
    const useGemini = providerPreference === "gemini" || (!useNvidia && !useOllama)

    if (providerPreference && !["gemini", "ollama", "nvidia"].includes(providerPreference)) {
      throw new Error(`Invalid LLM_PROVIDER value: ${providerPreference}. Use gemini, ollama, or nvidia.`)
    }

    if (useNvidia) {
      if (!nvidiaApiKey) {
        throw new Error("NVIDIA_API_KEY not found in environment variables. Set NVIDIA_API_KEY or disable USE_NVIDIA")
      }

      console.log(`[ProcessingHelper] Initializing with NVIDIA model: ${nvidiaModel}`)
      this.llmHelper = new LLMHelper({
        useNvidia: true,
        nvidiaApiKey,
        nvidiaModel,
        nvidiaFallbackModel,
        nvidiaUrl
      })
    } else if (useOllama) {
      console.log("[ProcessingHelper] Initializing with Ollama")
      this.llmHelper = new LLMHelper({
        useOllama: true,
        ollamaModel,
        ollamaUrl
      })
    } else if (useGemini) {
      const apiKey = process.env.GEMINI_API_KEY
      if (!apiKey) {
        throw new Error("GEMINI_API_KEY not found in environment variables. Set GEMINI_API_KEY, enable USE_OLLAMA=true, or enable USE_NVIDIA=true")
      }
      console.log("[ProcessingHelper] Initializing with Gemini")
      this.llmHelper = new LLMHelper({ geminiApiKey: apiKey })
    } else {
      throw new Error("No valid provider selected. Configure LLM_PROVIDER=gemini|ollama|nvidia")
    }
  }

  private getMainWindow() {
    return this.appState.getMainWindow()
  }

  private emitSessionEntry(entry: any): void {
    const mainWindow = this.getMainWindow()
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("session-entry-added", entry)
    }
  }

  private emitAudioTranscriptEvent(payload: {
    type: "partial" | "final" | "status" | "error" | "warn"
    text: string
    active: boolean
    source?: RealtimeAudioSource
  }): void {
    const mainWindow = this.getMainWindow()
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("audio-transcript-stream", payload)
    }
  }

  private emitAudioTranscriptionState(active: boolean): void {
    const mainWindow = this.getMainWindow()
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("audio-transcription-state", { active })
    }
  }

  public getSessionEntries() {
    return this.sessionMemory.getEntries()
  }

  public getRealtimeAudioTranscriptionState() {
    return {
      active: this.realtimeSttActive,
      partial: this.realtimeTranscriptPartial,
      partialBySource: { ...this.realtimeTranscriptPartialBySource },
      sourceMode: this.realtimeTranscriptSourceMode,
      finalTranscript: this.buildRealtimeTranscriptText()
    }
  }

  private getRealtimeAudioSourceMode(): RealtimeAudioSourceMode {
    const raw = (process.env.STT_AUDIO_SOURCE || "both").trim().toLowerCase()
    if (raw === "mic" || raw === "system" || raw === "both") {
      return raw
    }
    return "both"
  }

  private getRealtimeSourceLabel(source: RealtimeAudioSource): string {
    return source === "system" ? "INTERVIEWER" : "YOU"
  }

  private formatRealtimeSourceText(source: RealtimeAudioSource, text: string): string {
    if (this.realtimeTranscriptSourceMode === "both") {
      return `[${this.getRealtimeSourceLabel(source)}] ${text}`
    }
    return text
  }

  private buildRealtimePartialText(): string {
    const parts: string[] = []
    if (this.realtimeTranscriptPartialBySource.system) {
      parts.push(this.formatRealtimeSourceText("system", this.realtimeTranscriptPartialBySource.system))
    }
    if (this.realtimeTranscriptPartialBySource.mic) {
      parts.push(this.formatRealtimeSourceText("mic", this.realtimeTranscriptPartialBySource.mic))
    }
    return parts.join("\n").trim()
  }

  private buildRealtimeTranscriptText(): string {
    return this.realtimeTranscriptFinalChunks
      .map((chunk) => this.formatRealtimeSourceText(chunk.source, chunk.text))
      .join("\n")
      .trim()
  }

  public async submitTaggedInput(source: SessionSource, text: string, metadata?: Record<string, any>) {
    const { prompt: unifiedPrompt, mode, normalized } = this.sessionMemory.buildUnifiedPrompt(source, text)
    const [repoAssist, webAssist] = await Promise.all([
      this.buildDsaRepoAssistContext(mode, source, normalized),
      this.buildQuickWebSearchContext(source, normalized)
    ])

    const contextBlocks = [repoAssist.contextBlock, webAssist.contextBlock].filter(Boolean)
    const prompt = contextBlocks.length > 0 ? `${unifiedPrompt}\n\n${contextBlocks.join("\n\n")}` : unifiedPrompt

    this.logFilledPrompt(prompt, source, mode)

    const userEntry = this.sessionMemory.addEntry(source, normalized, {
      ...metadata,
      mode,
      ...(webAssist.urls.length > 0
        ? {
            quickWebSearchApplied: true,
            quickWebSearchUrls: webAssist.urls
          }
        : {}),
      ...(repoAssist.repoNames.length > 0
        ? {
            dsaRepoAssistApplied: true,
            dsaRepoCandidates: repoAssist.repoNames
          }
        : {})
    })
    this.emitSessionEntry(userEntry)
    const reply = await this.llmHelper.chat(prompt)

    const assistantEntry = this.sessionMemory.addEntry("assistant", reply, {
      replyTo: userEntry.id,
      source,
      mode
    })
    this.emitSessionEntry(assistantEntry)

    return {
      reply,
      userEntry,
      assistantEntry
    }
  }

  private parseBooleanEnv(value: string | undefined, defaultValue: boolean): boolean {
    if (!value) return defaultValue
    const normalized = value.trim().toLowerCase()
    if (["1", "true", "yes", "on"].includes(normalized)) return true
    if (["0", "false", "no", "off"].includes(normalized)) return false
    return defaultValue
  }

  private shouldUseQuickWebSearch(source: SessionSource, input: string): boolean {
    if (!this.parseBooleanEnv(process.env.QUICK_WEB_SEARCH_ENABLED, true)) {
      return false
    }

    if (source === "assistant" || source === "system") {
      return false
    }

    const compact = input.replace(/\s+/g, " ").trim()
    if (!compact || compact.length < 16) {
      return false
    }

    const tokenCount = (compact.match(/[a-z0-9]+/gi) || []).length
    return tokenCount >= 4
  }

  private buildQuickWebSearchQuery(input: string): string {
    const normalized = input
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/\s+/g, " ")
      .trim()

    const questionSegments = normalized
      .split(/[\n\r]+/)
      .map((segment) => segment.trim())
      .filter(Boolean)
      .slice(0, 8)

    const preferredSegment =
      questionSegments.find((segment) => segment.includes("?")) ||
      questionSegments.find((segment) => segment.length >= 20 && segment.length <= 180) ||
      ""

    if (preferredSegment) {
      return preferredSegment.slice(0, 220)
    }

    const tokens = this.tokenizeSearchInput(normalized)
    return tokens.slice(0, 10).join(" ")
  }

  private decodeHtmlEntities(text: string): string {
    return text
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&#x27;/g, "'")
      .replace(/&#x2F;/g, "/")
      .replace(/&#96;/g, "`")
  }

  private cleanHtmlText(text: string): string {
    const withoutTags = text.replace(/<[^>]*>/g, " ")
    const decoded = this.decodeHtmlEntities(withoutTags)
    return decoded.replace(/\s+/g, " ").trim()
  }

  private unwrapDuckDuckGoUrl(rawHref: string): string {
    try {
      const href = rawHref.startsWith("//") ? `https:${rawHref}` : rawHref
      const parsed = new URL(href, "https://duckduckgo.com")

      if (parsed.hostname.includes("duckduckgo.com")) {
        const redirected = parsed.searchParams.get("uddg")
        if (redirected) {
          return decodeURIComponent(redirected)
        }
      }

      return parsed.toString()
    } catch {
      return ""
    }
  }

  private getWebSourceType(domain: string, url: string): WebSearchSignal["sourceType"] {
    const normalizedDomain = domain.toLowerCase()
    const normalizedUrl = url.toLowerCase()

    const officialHosts = [
      "learn.microsoft.com",
      "docs.microsoft.com",
      "developer.mozilla.org",
      "docs.python.org",
      "nodejs.org",
      "react.dev",
      "vite.dev",
      "angular.dev",
      "kubernetes.io",
      "docs.docker.com",
      "developer.apple.com",
      "cloud.google.com",
      "aws.amazon.com",
      "docs.github.com",
      "numpy.org",
      "pandas.pydata.org",
      "pytorch.org"
    ]

    if (
      officialHosts.some((host) => normalizedDomain === host || normalizedDomain.endsWith(`.${host}`)) ||
      normalizedDomain.startsWith("docs.") ||
      normalizedUrl.includes("/docs/") ||
      normalizedUrl.includes("/documentation")
    ) {
      return "official-docs"
    }

    if (normalizedDomain.includes("geeksforgeeks.org")) {
      return "geeksforgeeks"
    }

    if (normalizedDomain === "github.com" || normalizedDomain.endsWith(".github.com")) {
      return "github"
    }

    return "other"
  }

  private getWebSourcePriority(sourceType: WebSearchSignal["sourceType"]): number {
    if (sourceType === "official-docs") return 3
    if (sourceType === "geeksforgeeks") return 2
    if (sourceType === "github") return 1
    return 0
  }

  private scoreWebSearchSignal(title: string, snippet: string, domain: string, queryTokens: string[]): number {
    const haystack = `${title} ${snippet} ${domain}`.toLowerCase()
    return queryTokens.reduce((sum, token) => sum + (haystack.includes(token) ? 1 : 0), 0)
  }

  private extractWebSearchSignalsFromDuckDuckGoHtml(html: string, query: string): WebSearchSignal[] {
    const anchorRegex = /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi
    const queryTokens = this.tokenizeSearchInput(query)
    const seen = new Set<string>()
    const signals: WebSearchSignal[] = []

    let match: RegExpExecArray | null = null
    let rank = 0

    while ((match = anchorRegex.exec(html)) !== null) {
      const url = this.unwrapDuckDuckGoUrl(match[1] || "")
      if (!url || seen.has(url)) {
        continue
      }

      let parsedUrl: URL
      try {
        parsedUrl = new URL(url)
      } catch {
        continue
      }

      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        continue
      }

      const domain = parsedUrl.hostname.replace(/^www\./i, "")
      const title = this.cleanHtmlText(match[2] || "")
      if (!title) {
        continue
      }

      const searchWindow = html.slice(anchorRegex.lastIndex, Math.min(anchorRegex.lastIndex + 1800, html.length))
      const snippetMatch = searchWindow.match(/<(?:a|div)[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/(?:a|div)>/i)
      const snippet = this.cleanHtmlText(snippetMatch?.[1] || "")

      const sourceType = this.getWebSourceType(domain, url)
      const sourcePriority = this.getWebSourcePriority(sourceType)
      const relevanceScore = this.scoreWebSearchSignal(title, snippet, domain, queryTokens)

      signals.push({
        title,
        url,
        snippet,
        domain,
        sourceType,
        sourcePriority,
        relevanceScore,
        originalRank: rank
      })

      seen.add(url)
      rank += 1
    }

    return signals
  }

  private async fetchQuickWebSearchSignals(input: string, limit: number): Promise<WebSearchSignal[]> {
    const query = this.buildQuickWebSearchQuery(input)
    if (!query) {
      return []
    }

    const timeoutMs = Math.max(1000, Number(process.env.QUICK_WEB_SEARCH_TIMEOUT_MS || 2800))
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const response = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
        method: "GET",
        headers: {
          Accept: "text/html",
          "User-Agent": "interview-coder"
        },
        signal: controller.signal
      })

      if (!response.ok) {
        console.warn(`[ProcessingHelper] Quick web search failed: ${response.status} ${response.statusText}`)
        return []
      }

      const html = await response.text()
      const parsed = this.extractWebSearchSignalsFromDuckDuckGoHtml(html, query)

      return parsed
        .sort((a, b) => {
          if (b.sourcePriority !== a.sourcePriority) return b.sourcePriority - a.sourcePriority
          if (b.relevanceScore !== a.relevanceScore) return b.relevanceScore - a.relevanceScore
          return a.originalRank - b.originalRank
        })
        .slice(0, limit)
    } catch (error) {
      console.warn("[ProcessingHelper] Quick web search unavailable:", error)
      return []
    } finally {
      clearTimeout(timer)
    }
  }

  private formatQuickWebSearchContext(signals: WebSearchSignal[]): string {
    const items = signals
      .map((signal, index) => {
        const snippet = signal.snippet ? `\n   ${signal.snippet}` : ""
        return `${index + 1}. [${signal.sourceType}] ${signal.title} | ${signal.url}${snippet}`
      })
      .join("\n")

    return [
      "QUICK WEB SEARCH SIGNALS (INTERNAL CONTEXT):",
      items,
      "",
      "Use these signals to improve factual correctness and practical details.",
      "Prioritize: official docs > GeeksforGeeks-like pages > GitHub repositories.",
      "Do not copy text verbatim and do not mention search sources unless explicitly asked."
    ].join("\n")
  }

  private async buildQuickWebSearchContext(source: SessionSource, input: string): Promise<{ contextBlock: string; urls: string[] }> {
    if (!this.shouldUseQuickWebSearch(source, input)) {
      return { contextBlock: "", urls: [] }
    }

    const maxResults = Math.min(5, Math.max(2, Number(process.env.QUICK_WEB_SEARCH_TOP_K || 3)))
    const signals = await this.fetchQuickWebSearchSignals(input, maxResults)
    if (signals.length === 0) {
      return { contextBlock: "", urls: [] }
    }

    return {
      contextBlock: this.formatQuickWebSearchContext(signals),
      urls: signals.map((signal) => signal.url)
    }
  }

  private isDsaRepositoryAssistEnabled(): boolean {
    return this.parseBooleanEnv(process.env.DSA_GITHUB_REPO_ASSIST, true)
  }

  private isLikelyDsaInput(mode: string, source: SessionSource, input: string): boolean {
    if (mode !== "CODING") return false
    if (source === "assistant" || source === "system") return false

    const signalRegex = /leetcode|constraint|time complexity|space complexity|array|string|graph|tree|linked list|heap|stack|queue|binary search|dynamic programming|sliding window|two pointers|dsa/i
    return signalRegex.test(input)
  }

  private tokenizeSearchInput(input: string): string[] {
    const stopwords = new Set([
      "a",
      "an",
      "the",
      "is",
      "are",
      "was",
      "were",
      "to",
      "for",
      "from",
      "with",
      "and",
      "or",
      "of",
      "on",
      "in",
      "at",
      "by",
      "you",
      "your",
      "we",
      "our",
      "can",
      "this",
      "that",
      "these",
      "those",
      "into",
      "given",
      "return",
      "find",
      "solve"
    ])

    return (input.toLowerCase().match(/[a-z0-9]+/g) || [])
      .filter((token) => token.length >= 3)
      .filter((token) => !stopwords.has(token))
      .slice(0, 24)
  }

  private buildGithubSearchQuery(input: string): string {
    const normalized = input
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/\s+/g, " ")
      .trim()

    const lines = normalized
      .split(/\n|\.|\?|!/) 
      .map((line) => line.trim())
      .filter((line) => line.length >= 8 && line.length <= 120)

    const titleCandidate = lines[0] || ""
    const tokens = this.tokenizeSearchInput(normalized)
    const fallback = tokens.slice(0, 8).join(" ")
    const base = titleCandidate || fallback || "leetcode problem"

    return `${base} leetcode dsa solution`
  }

  private scoreRepositorySignal(repo: Omit<GithubRepositorySignal, "relevanceScore">, queryTokens: string[]): number {
    const haystack = [repo.fullName, repo.description, repo.language, repo.topics.join(" ")]
      .join(" ")
      .toLowerCase()

    const overlap = queryTokens.reduce((sum, token) => sum + (haystack.includes(token) ? 1 : 0), 0)
    const starWeight = Math.min(4, Math.log10(Math.max(repo.stars, 1)))
    return overlap * 2 + starWeight
  }

  private async fetchGithubRepositorySignals(problemText: string, limit: number): Promise<GithubRepositorySignal[]> {
    const query = this.buildGithubSearchQuery(problemText)
    const perPage = Math.max(10, limit * 3)
    const requestUrl = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=${perPage}`
    const token = (process.env.GITHUB_TOKEN || "").trim()
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "User-Agent": "interview-coder"
    }

    if (token) {
      headers.Authorization = `Bearer ${token}`
    }

    const timeoutMs = Number(process.env.GITHUB_SEARCH_TIMEOUT_MS || 5000)
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const response = await fetch(requestUrl, {
        method: "GET",
        headers,
        signal: controller.signal
      })

      if (!response.ok) {
        console.warn(`[ProcessingHelper] GitHub search failed: ${response.status} ${response.statusText}`)
        return []
      }

      const payload = await response.json() as { items?: any[] }
      const queryTokens = this.tokenizeSearchInput(problemText)
      const seen = new Set<string>()
      const mapped: GithubRepositorySignal[] = []

      for (const item of payload.items || []) {
        const fullName = typeof item?.full_name === "string" ? item.full_name : ""
        if (!fullName || seen.has(fullName)) {
          continue
        }

        seen.add(fullName)

        const repoSignalBase = {
          fullName,
          url: typeof item?.html_url === "string" ? item.html_url : "",
          description: typeof item?.description === "string" ? item.description : "No description",
          stars: typeof item?.stargazers_count === "number" ? item.stargazers_count : 0,
          language: typeof item?.language === "string" ? item.language : "unknown",
          topics: Array.isArray(item?.topics) ? item.topics.filter((topic: unknown) => typeof topic === "string") : []
        }

        mapped.push({
          ...repoSignalBase,
          relevanceScore: this.scoreRepositorySignal(repoSignalBase, queryTokens)
        })
      }

      return mapped
        .sort((a, b) => {
          if (b.relevanceScore !== a.relevanceScore) return b.relevanceScore - a.relevanceScore
          return b.stars - a.stars
        })
        .slice(0, limit)
    } catch (error) {
      console.warn("[ProcessingHelper] GitHub repository assist unavailable:", error)
      return []
    } finally {
      clearTimeout(timer)
    }
  }

  private formatRepositoryAssistContext(repos: GithubRepositorySignal[]): string {
    const items = repos
      .map((repo, index) => {
        const topics = repo.topics.length ? ` | topics: ${repo.topics.slice(0, 4).join(", ")}` : ""
        return `${index + 1}. ${repo.fullName} | stars: ${repo.stars} | lang: ${repo.language}${topics}\n   ${repo.description}`
      })
      .join("\n")

    return [
      "PUBLIC DSA REPOSITORY SIGNALS (INTERNAL CONTEXT):",
      items,
      "",
      "Use the repository signals to infer canonical patterns and edge cases for this DSA problem.",
      "Return one final, optimized solution.",
      "Generate original code and explanation; do not copy repository code verbatim.",
      "Do not mention repositories, links, or evidence unless explicitly asked."
    ].join("\n")
  }

  private async buildDsaRepoAssistContext(mode: string, source: SessionSource, input: string): Promise<{ contextBlock: string; repoNames: string[] }> {
    if (!this.isDsaRepositoryAssistEnabled()) {
      return { contextBlock: "", repoNames: [] }
    }

    if (!this.isLikelyDsaInput(mode, source, input)) {
      return { contextBlock: "", repoNames: [] }
    }

    const topN = Number(process.env.DSA_GITHUB_TOP_REPOS || 5)
    const boundedTopN = Math.min(5, Math.max(4, Number.isFinite(topN) ? topN : 5))
    const repos = await this.fetchGithubRepositorySignals(input, boundedTopN)
    if (repos.length === 0) {
      return { contextBlock: "", repoNames: [] }
    }

    return {
      contextBlock: this.formatRepositoryAssistContext(repos),
      repoNames: repos.map((repo) => repo.fullName)
    }
  }

  private async extractScreenshotText(screenshotPath: string): Promise<string> {
    try {
      const result = await recognize(screenshotPath, "eng")
      const text = (result?.data?.text || "").trim()
      return text
    } catch (error) {
      console.warn(`[ProcessingHelper] OCR failed for ${screenshotPath}:`, error)
      return ""
    }
  }

  private normalizeScreenshotUnderstandingMode(raw: string): ScreenshotUnderstandingMode {
    if (raw === "ocr" || raw === "ocr-llm-filter" || raw === "multimodal") {
      return raw
    }
    return "ocr"
  }

  private getScreenshotUnderstandingMode(): ScreenshotUnderstandingMode {
    if (this.screenshotUnderstandingModeOverride) {
      return this.screenshotUnderstandingModeOverride
    }
    const raw = (process.env.SCREENSHOT_UNDERSTANDING_MODE || "ocr").trim().toLowerCase()
    return this.normalizeScreenshotUnderstandingMode(raw)
  }

  public getCurrentScreenshotUnderstandingMode(): ScreenshotUnderstandingMode {
    return this.getScreenshotUnderstandingMode()
  }

  public setScreenshotUnderstandingMode(mode: string): ScreenshotUnderstandingMode {
    const normalized = this.normalizeScreenshotUnderstandingMode((mode || "").trim().toLowerCase())
    this.screenshotUnderstandingModeOverride = normalized
    return normalized
  }

  private stripLikelyUiNoise(raw: string): string {
    const uiNoisePatterns = [
      /^run$/i,
      /^submit$/i,
      /^reset$/i,
      /^editorial$/i,
      /^discuss$/i,
      /^login$/i,
      /^sign in$/i,
      /^search$/i,
      /^settings$/i,
      /^home$/i,
      /^profile$/i,
      /^accepted$/i,
      /^wrong answer$/i,
      /^time limit exceeded$/i
    ]

    return raw
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => {
        if (!line) return false
        if (line.length <= 1) return false
        if (uiNoisePatterns.some((pattern) => pattern.test(line))) return false
        return true
      })
      .join("\n")
      .trim()
  }

  private async filterOcrWithLlm(raw: string): Promise<string> {
    const cleaningPrompt = [
      "You are an OCR cleaning assistant for coding interview screenshots.",
      "Keep only coding problem content (problem statement, constraints, examples, input/output notes).",
      "Remove IDE/browser UI noise and unrelated labels.",
      "Do not solve the problem.",
      "Do not summarize.",
      "Return cleaned text only.",
      "",
      "RAW OCR:",
      raw
    ].join("\n")

    const cleaned = await this.llmHelper.chat(cleaningPrompt)
    return cleaned.trim()
  }

  private async buildProblemInputFromScreenshots(screenshotPaths: string[], extractedText: string): Promise<string> {
    const mode = this.getScreenshotUnderstandingMode()

    if (mode === "multimodal") {
      const parts = await Promise.all(
        screenshotPaths.map(async (screenshotPath) => {
          try {
            const analyzed = await this.llmHelper.analyzeImageFile(screenshotPath)
            return (analyzed.text || "").trim()
          } catch (error) {
            console.warn(`[ProcessingHelper] Multimodal image analysis failed for ${screenshotPath}:`, error)
            return ""
          }
        })
      )

      const combined = parts.filter(Boolean).join("\n\n")
      if (combined) {
        return combined
      }
    }

    const cleanedDeterministic = this.stripLikelyUiNoise(extractedText)

    if (mode === "ocr-llm-filter" && cleanedDeterministic) {
      try {
        const llmCleaned = await this.filterOcrWithLlm(cleanedDeterministic)
        if (llmCleaned) {
          return llmCleaned
        }
      } catch (error) {
        console.warn("[ProcessingHelper] OCR LLM filtering failed; falling back to deterministic OCR cleanup.", error)
      }
    }

    return cleanedDeterministic || extractedText || "No OCR text extracted from screenshots."
  }

  private getPythonExecutable(): string {
    const explicit = (process.env.STT_PYTHON_BIN || "").trim()
    if (explicit) {
      return explicit
    }

    const candidates = [
      path.join(process.cwd(), ".venv", "Scripts", "python.exe"),
      path.join(process.cwd(), "venv", "Scripts", "python.exe"),
      path.join(process.cwd(), ".venv", "bin", "python"),
      path.join(process.cwd(), "venv", "bin", "python")
    ]

    const discovered = candidates.find((candidate) => fs.existsSync(candidate))
    if (discovered) {
      return discovered
    }

    return "python"
  }

  private resolveModelsRoot(): string {
    const configured = process.env.STT_MODELS_DIR
    if (configured) {
      return configured
    }

    return path.join(process.cwd(), "models")
  }

  private resolveSttScriptPath(): string {
    const candidates = [
      path.join(process.cwd(), "python", "stt_stream.py"),
      path.join(__dirname, "..", "python", "stt_stream.py")
    ]

    const found = candidates.find((candidate) => fs.existsSync(candidate))
    if (!found) {
      throw new Error("Could not find python/stt_stream.py. Ensure the file exists in the project.")
    }

    return found
  }

  private resolveModelBootstrapScriptPath(): string {
    const candidates = [
      path.join(process.cwd(), "python", "bootstrap_vosk_model.py"),
      path.join(__dirname, "..", "python", "bootstrap_vosk_model.py")
    ]

    const found = candidates.find((candidate) => fs.existsSync(candidate))
    if (!found) {
      throw new Error("Could not find python/bootstrap_vosk_model.py")
    }

    return found
  }

  private collectVoskModelCandidates(): string[] {
    const candidates: string[] = []

    if (process.env.VOSK_MODEL_PATH) {
      candidates.push(process.env.VOSK_MODEL_PATH)
    }

    const modelsRoot = this.resolveModelsRoot()
    candidates.push(
      path.join(modelsRoot, "vosk-model-en-us-0.22-lgraph"),
      path.join(modelsRoot, "vosk-model-en-us-0.22"),
      path.join(modelsRoot, "vosk-model-small-en-us-0.15"),
      path.join(process.cwd(), "models", "vosk-model-en-us-0.22-lgraph"),
      path.join(process.cwd(), "models", "vosk-model-en-us-0.22"),
      path.join(process.cwd(), "models", "vosk-model-small-en-us-0.15"),
    )

    if (process.resourcesPath) {
      candidates.push(
        path.join(process.resourcesPath, "models", "vosk-model-en-us-0.22-lgraph"),
        path.join(process.resourcesPath, "models", "vosk-model-en-us-0.22"),
        path.join(process.resourcesPath, "models", "vosk-model-small-en-us-0.15"),
      )
    }

    const unique = new Set(candidates.map((entry) => path.resolve(entry)))
    return Array.from(unique)
  }

  private isValidVoskModelDirectory(modelPath: string): boolean {
    if (!fs.existsSync(modelPath) || !fs.statSync(modelPath).isDirectory()) {
      return false
    }

    const requiredCandidates = [
      path.join(modelPath, "am", "final.mdl"),
      path.join(modelPath, "conf", "model.conf")
    ]

    return requiredCandidates.every((candidate) => fs.existsSync(candidate))
  }

  private isSmallVoskModel(modelPath: string): boolean {
    return path.basename(modelPath).toLowerCase().includes("small")
  }

  private shouldPreferHighAccuracyVoskModel(): boolean {
    const raw = (process.env.STT_PREFER_HIGH_ACCURACY || "true").trim().toLowerCase()
    return !["0", "false", "no", "off"].includes(raw)
  }

  private findFirstInstalledVoskModel(): string | null {
    for (const candidate of this.collectVoskModelCandidates()) {
      if (this.isValidVoskModelDirectory(candidate)) {
        return candidate
      }
    }

    const modelsRoot = this.resolveModelsRoot()
    if (fs.existsSync(modelsRoot) && fs.statSync(modelsRoot).isDirectory()) {
      const entries = fs.readdirSync(modelsRoot)
      const dynamicCandidate = entries
        .filter((name) => name.toLowerCase().startsWith("vosk-model"))
        .map((name) => path.join(modelsRoot, name))
        .find((entry) => this.isValidVoskModelDirectory(entry))

      if (dynamicCandidate) {
        return dynamicCandidate
      }
    }

    return null
  }

  private async bootstrapVoskModelIfMissing(): Promise<string> {
    const existing = this.findFirstInstalledVoskModel()
    if (existing && (!this.isSmallVoskModel(existing) || !this.shouldPreferHighAccuracyVoskModel())) {
      return existing
    }

    if (this.attemptedVoskQualityUpgrade && existing) {
      return existing
    }

    if (existing && this.isSmallVoskModel(existing) && this.shouldPreferHighAccuracyVoskModel()) {
      this.emitAudioTranscriptEvent({
        type: "status",
        text: "Small Vosk model detected. Attempting one-time upgrade to higher-accuracy model...",
        active: false
      })
    }

    this.attemptedVoskQualityUpgrade = true

    const pythonExec = this.getPythonExecutable()
    const scriptPath = this.resolveModelBootstrapScriptPath()
    const modelsRoot = this.resolveModelsRoot()
    const modelUrl =
      process.env.VOSK_MODEL_URL ||
      "https://alphacephei.com/vosk/models/vosk-model-en-us-0.22-lgraph.zip"

    this.emitAudioTranscriptEvent({
      type: "status",
      text: `Speech model not found. Downloading Vosk model (python: ${pythonExec})...`,
      active: false
    })

    const bootstrapResult = await new Promise<{ modelPath?: string; error?: string }>((resolve) => {
      const child = spawn(
        pythonExec,
        [
          scriptPath,
          "--url",
          modelUrl,
          "--dest-root",
          modelsRoot
        ],
        {
          cwd: process.cwd(),
          stdio: ["ignore", "pipe", "pipe"]
        }
      )

      let reportedModelPath: string | undefined
      let stderrText = ""

      child.stdout.on("data", (chunk: Buffer) => {
        const lines = chunk
          .toString("utf-8")
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean)

        for (const line of lines) {
          try {
            const payload = JSON.parse(line) as { type?: string; text?: string }
            const type = payload.type || "status"
            const text = (payload.text || "").trim()

            if (type === "result" && text) {
              reportedModelPath = text
              continue
            }

            if (type === "error") {
              resolve({ error: text || "Vosk model bootstrap failed." })
              return
            }

            if (text) {
              this.emitAudioTranscriptEvent({
                type: "status",
                text,
                active: false
              })
            }
          } catch {
            this.emitAudioTranscriptEvent({
              type: "status",
              text: line,
              active: false
            })
          }
        }
      })

      child.stderr.on("data", (chunk: Buffer) => {
        const text = chunk.toString("utf-8").trim()
        if (text) {
          stderrText += (stderrText ? " | " : "") + text
        }
      })

      child.on("error", (error) => {
        resolve({ error: `Failed to run Vosk bootstrap script: ${error.message}` })
      })

      child.on("close", (code) => {
        if (code === 0) {
          resolve({ modelPath: reportedModelPath })
          return
        }

        resolve({ error: stderrText || `Vosk bootstrap exited with code ${code}` })
      })
    })

    if (bootstrapResult.error) {
      if (existing) {
        this.emitAudioTranscriptEvent({
          type: "warn",
          text: `High-accuracy model download failed; continuing with existing model (${path.basename(existing)}). ${bootstrapResult.error}`,
          active: false
        })
        return existing
      }

      throw new Error(bootstrapResult.error)
    }

    const fromResult = bootstrapResult.modelPath && fs.existsSync(bootstrapResult.modelPath)
      ? bootstrapResult.modelPath
      : null

    if (fromResult) {
      return fromResult
    }

    const discovered = this.findFirstInstalledVoskModel()
    if (discovered) {
      return discovered
    }

    if (existing) {
      this.emitAudioTranscriptEvent({
        type: "warn",
        text: `Model bootstrap completed without a detected install; continuing with existing model (${path.basename(existing)}).`,
        active: false
      })
      return existing
    }

    throw new Error("Vosk model bootstrap completed but model directory was not found.")
  }

  private handleRealtimeSttStdoutChunk(chunk: Buffer): void {
    const lines = chunk
      .toString("utf-8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)

    for (const line of lines) {
      try {
        const parsed = JSON.parse(line) as { type?: string; text?: string; source?: string }
        const text = (parsed.text || "").trim()
        const type = parsed.type || "status"
        const source = parsed.source === "mic" || parsed.source === "system"
          ? parsed.source
          : undefined

        if (type === "partial") {
          if (source) {
            this.realtimeTranscriptPartialBySource[source] = text
            this.realtimeTranscriptPartial = this.buildRealtimePartialText()
          } else {
            this.realtimeTranscriptPartial = text
          }
          this.emitAudioTranscriptEvent({
            type: "partial",
            text: source ? this.realtimeTranscriptPartial : text,
            active: this.realtimeSttActive,
            source
          })
          continue
        }

        if (type === "final") {
          if (text) {
            this.realtimeTranscriptFinalChunks.push({ source: source || "mic", text })
          }
          if (source) {
            this.realtimeTranscriptPartialBySource[source] = ""
            this.realtimeTranscriptPartial = this.buildRealtimePartialText()
          } else {
            this.realtimeTranscriptPartial = ""
          }
          this.emitAudioTranscriptEvent({
            type: "final",
            text: source ? this.formatRealtimeSourceText(source, text) : text,
            active: this.realtimeSttActive,
            source
          })
          continue
        }

        if (type === "error") {
          this.emitAudioTranscriptEvent({
            type: "error",
            text,
            active: this.realtimeSttActive
          })
          continue
        }

        if (type === "warn") {
          this.emitAudioTranscriptEvent({
            type: "warn",
            text,
            active: this.realtimeSttActive
          })
          continue
        }

        this.emitAudioTranscriptEvent({
          type: "status",
          text,
          active: this.realtimeSttActive
        })
      } catch {
        this.emitAudioTranscriptEvent({
          type: "status",
          text: line,
          active: this.realtimeSttActive
        })
      }
    }
  }

  private async startRealtimeAudioTranscription() {
    if (this.realtimeSttActive || this.realtimeSttProcess) {
      return { active: true }
    }

    let pythonExec = ""
    let sttScriptPath = ""
    let voskModelPath = ""
    let sampleRate = 16000
    let sourceMode: RealtimeAudioSourceMode = "both"

    try {
      pythonExec = this.getPythonExecutable()
      sttScriptPath = this.resolveSttScriptPath()
      voskModelPath = await this.bootstrapVoskModelIfMissing()
      sampleRate = Number(process.env.STT_SAMPLE_RATE || 16000)
      sourceMode = this.getRealtimeAudioSourceMode()

      this.emitAudioTranscriptEvent({
        type: "status",
        text: `Starting STT with python: ${pythonExec}`,
        active: false
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.emitAudioTranscriptionState(false)
      this.emitAudioTranscriptEvent({
        type: "error",
        text: `Realtime STT unavailable: ${message}`,
        active: false
      })
      return {
        active: false,
        transcript: "",
        llmReply: "",
        error: message
      }
    }

    this.realtimeTranscriptFinalChunks = []
    this.realtimeTranscriptPartial = ""
    this.realtimeTranscriptPartialBySource = { mic: "", system: "" }
    this.realtimeTranscriptSourceMode = sourceMode

    const child = spawn(
      pythonExec,
      [
        sttScriptPath,
        "--engine",
        "vosk",
        "--model",
        voskModelPath,
        "--sample-rate",
        String(sampleRate),
        "--source",
        sourceMode
      ],
      {
        cwd: process.cwd(),
        stdio: ["ignore", "pipe", "pipe"]
      }
    )

    this.realtimeSttProcess = child
    this.realtimeSttActive = true
    this.realtimeSttStartedAt = Date.now()
    this.emitAudioTranscriptionState(true)

    child.stdout.on("data", (chunk: Buffer) => {
      this.handleRealtimeSttStdoutChunk(chunk)
    })

    child.stderr.on("data", (chunk: Buffer) => {
      const text = chunk.toString("utf-8").trim()
      if (text) {
        if (/DeprecationWarning.*audioop/i.test(text)) {
          return
        }

        if (/Failed to create (a )?model/i.test(text)) {
          this.emitAudioTranscriptEvent({
            type: "error",
            text,
            active: this.realtimeSttActive
          })
          return
        }

        this.emitAudioTranscriptEvent({
          type: "warn",
          text,
          active: this.realtimeSttActive
        })
      }
    })

    child.on("error", (error) => {
      this.emitAudioTranscriptEvent({
        type: "error",
        text: `Realtime transcription process failed: ${error.message}`,
        active: false
      })
    })

    child.on("close", () => {
      const transcript = this.buildRealtimeTranscriptText()
      this.realtimeSttProcess = null
      this.realtimeSttActive = false
      this.realtimeSttStartedAt = 0
      this.emitAudioTranscriptionState(false)
      if (this.realtimeStopResolve) {
        this.realtimeStopResolve(transcript)
        this.realtimeStopResolve = null
        this.realtimeStopPromise = null
      }
    })

    this.emitAudioTranscriptEvent({
      type: "status",
      text: `Realtime audio transcription started (${sourceMode}).`,
      active: true
    })

    return { active: true }
  }

  private async stopRealtimeAudioTranscription() {
    if (!this.realtimeSttActive) {
      this.emitAudioTranscriptEvent({
        type: "warn",
        text: "Realtime STT is not active.",
        active: false
      })
      return {
        active: false,
        transcript: "",
        llmReply: "",
        note: "STT was not active."
      }
    }

    const proc = this.realtimeSttProcess
    if (!proc) {
      this.realtimeSttActive = false
      this.emitAudioTranscriptionState(false)
      this.emitAudioTranscriptEvent({
        type: "warn",
        text: "Realtime STT process was already closed.",
        active: false
      })
      return {
        active: false,
        transcript: "",
        llmReply: "",
        note: "STT process was already closed."
      }
    }

    const partialSnapshot = this.buildRealtimePartialText() || this.realtimeTranscriptPartial

    if (!this.realtimeStopPromise) {
      this.realtimeStopPromise = new Promise<string>((resolve) => {
        this.realtimeStopResolve = resolve
      })
    }

    proc.kill("SIGINT")

    let transcript = await Promise.race([
      this.realtimeStopPromise,
      new Promise<string>((resolve) =>
        setTimeout(() => resolve(this.buildRealtimeTranscriptText()), 1500)
      )
    ])

    if (!transcript && partialSnapshot) {
      transcript = partialSnapshot.trim()
    }

    this.realtimeTranscriptPartialBySource = { mic: "", system: "" }
    this.realtimeTranscriptPartial = ""
    this.emitAudioTranscriptEvent({
      type: "status",
      text: "Realtime audio transcription stopped.",
      active: false
    })

    if (!transcript) {
      this.emitAudioTranscriptEvent({
        type: "warn",
        text: "No speech captured before stop.",
        active: false
      })
      return {
        active: false,
        transcript: "",
        llmReply: "",
        note: "No speech captured before stop."
      }
    }

    try {
      const submission = await this.submitTaggedInput("audio", transcript, {
        inputMode: "realtime-stt",
        audioSourceMode: this.realtimeTranscriptSourceMode
      })

      const mainWindow = this.getMainWindow()
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("open-chat")
      }

      return {
        active: false,
        transcript,
        llmReply: submission.reply
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.emitAudioTranscriptEvent({
        type: "error",
        text: `Audio transcript captured but LLM reply failed: ${message}`,
        active: false
      })

      const mainWindow = this.getMainWindow()
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("open-chat")
      }

      return {
        active: false,
        transcript,
        llmReply: "",
        error: message
      }
    }
  }

  public async toggleRealtimeAudioTranscription() {
    if (this.realtimeTogglePromise) {
      return this.realtimeTogglePromise
    }

    this.realtimeTogglePromise = (async () => {
      if (this.realtimeSttActive || this.realtimeSttProcess) {
        const minStopMs = Math.max(0, Number(process.env.STT_MIN_STOP_MS || 1800))
        const elapsedMs = this.realtimeSttStartedAt ? Date.now() - this.realtimeSttStartedAt : Number.MAX_SAFE_INTEGER
        const hasAnyTranscript = Boolean(this.buildRealtimeTranscriptText()) || Boolean(this.buildRealtimePartialText())

        if (!hasAnyTranscript && elapsedMs < minStopMs) {
          return {
            active: true,
            transcript: "",
            llmReply: "",
            debounced: true,
            note: `Ignoring quick stop toggle (${elapsedMs}ms < ${minStopMs}ms).`
          }
        }

        return this.stopRealtimeAudioTranscription()
      }
      return this.startRealtimeAudioTranscription()
    })()

    try {
      return await this.realtimeTogglePromise
    } finally {
      this.realtimeTogglePromise = null
    }
  }

  public async processScreenshots(): Promise<void> {
    const mainWindow = this.appState.getMainWindow()
    if (!mainWindow) return

    const view = this.appState.getView()

    if (view === "queue") {
      const screenshotQueue = this.appState.getScreenshotHelper().getScreenshotQueue()
      if (screenshotQueue.length === 0) {
        mainWindow.webContents.send(this.appState.PROCESSING_EVENTS.NO_SCREENSHOTS)
        return
      }

      mainWindow.webContents.send(this.appState.PROCESSING_EVENTS.INITIAL_START)
      this.appState.setView("solutions")

      this.currentProcessingAbortController = new AbortController()

      try {
        const allPaths = [...screenshotQueue]
        const extractedParts = await Promise.all(
          allPaths.map((screenshotPath) => this.extractScreenshotText(screenshotPath))
        )

        const extractedText = extractedParts
          .map((part) => part.trim())
          .filter(Boolean)
          .join("\n\n")

        const normalizedImageInput = await this.buildProblemInputFromScreenshots(allPaths, extractedText)

        const submission = await this.submitTaggedInput("image", normalizedImageInput, {
          screenshotPaths: allPaths,
          trigger: "ctrl+enter"
        })

        const problemInfo = {
          problem_statement: normalizedImageInput,
          input_format: {
            description: "OCR extracted from screenshot input",
            parameters: [] as any[]
          },
          output_format: {
            description: "Interview response generated from screenshot",
            type: "string",
            subtype: "text"
          },
          complexity: { time: "N/A", space: "N/A" },
          test_cases: [] as any[],
          validation_type: "manual",
          difficulty: "custom",
          latest_response: submission.reply
        }

        this.appState.setProblemInfo(problemInfo)

        mainWindow.webContents.send(this.appState.PROCESSING_EVENTS.PROBLEM_EXTRACTED, problemInfo)
        mainWindow.webContents.send(this.appState.PROCESSING_EVENTS.SOLUTION_SUCCESS, {
          solution: {
            code: submission.reply,
            thoughts: ["Generated from unified session context (chat + audio + screenshot OCR)."],
            time_complexity: "N/A",
            space_complexity: "N/A"
          }
        })
      } catch (error: any) {
        console.error("Image processing error:", error)
        this.appState.setProblemInfo(null)
        this.appState.setView("queue")
        mainWindow.webContents.send(this.appState.PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR, error.message)
      } finally {
        this.currentProcessingAbortController = null
      }
      return;
    } else {
      // Debug mode
      const extraScreenshotQueue = this.appState.getScreenshotHelper().getExtraScreenshotQueue()
      if (extraScreenshotQueue.length === 0) {
        console.log("No extra screenshots to process")
        mainWindow.webContents.send(this.appState.PROCESSING_EVENTS.NO_SCREENSHOTS)
        return
      }

      const problemInfo = this.appState.getProblemInfo()
      if (!problemInfo) {
        this.appState.setView("queue")
        mainWindow.webContents.send(
          this.appState.PROCESSING_EVENTS.DEBUG_ERROR,
          "No problem info available. Capture and process an initial screenshot/audio first."
        )
        return
      }

      mainWindow.webContents.send(this.appState.PROCESSING_EVENTS.DEBUG_START)
      this.currentExtraProcessingAbortController = new AbortController()

      try {
        const extractedParts = await Promise.all(
          extraScreenshotQueue.map((screenshotPath) => this.extractScreenshotText(screenshotPath))
        )
        const extractedText = extractedParts
          .map((part) => part.trim())
          .filter(Boolean)
          .join("\n\n")

        const debugInput = [
          "Follow-up debugging context from screenshots:",
          extractedText || "No OCR text extracted.",
          "",
          "Original problem context:",
          JSON.stringify(problemInfo, null, 2)
        ].join("\n")

        const submission = await this.submitTaggedInput("image", debugInput, {
          screenshotPaths: extraScreenshotQueue,
          mode: "debug"
        })

        const debugResult = {
          solution: {
            code: submission.reply,
            thoughts: ["Generated from debug screenshots and session context."],
            time_complexity: "N/A",
            space_complexity: "N/A"
          }
        }

        this.appState.setHasDebugged(true)
        mainWindow.webContents.send(
          this.appState.PROCESSING_EVENTS.DEBUG_SUCCESS,
          debugResult
        )

      } catch (error: any) {
        console.error("Debug processing error:", error)
        mainWindow.webContents.send(
          this.appState.PROCESSING_EVENTS.DEBUG_ERROR,
          error.message
        )
      } finally {
        this.currentExtraProcessingAbortController = null
      }
    }
  }

  public cancelOngoingRequests(): void {
    if (this.currentProcessingAbortController) {
      this.currentProcessingAbortController.abort()
      this.currentProcessingAbortController = null
    }

    if (this.currentExtraProcessingAbortController) {
      this.currentExtraProcessingAbortController.abort()
      this.currentExtraProcessingAbortController = null
    }

    this.appState.setHasDebugged(false)
  }

  public async processAudioBase64(data: string, mimeType: string) {
    const analyzed = await this.llmHelper.analyzeAudioFromBase64(data, mimeType)
    const submission = await this.submitTaggedInput("audio", analyzed.text, {
      mimeType,
      inputMode: "base64"
    })

    return {
      text: analyzed.text,
      timestamp: analyzed.timestamp,
      response: submission.reply
    }
  }

  // Add audio file processing method
  public async processAudioFile(filePath: string) {
    const analyzed = await this.llmHelper.analyzeAudioFile(filePath)
    const submission = await this.submitTaggedInput("audio", analyzed.text, {
      filePath,
      inputMode: "file"
    })

    return {
      text: analyzed.text,
      timestamp: analyzed.timestamp,
      response: submission.reply
    }
  }

  public async processImageFile(filePath: string) {
    const ocrText = await this.extractScreenshotText(filePath)
    const submission = await this.submitTaggedInput("image", ocrText || "No OCR text extracted from screenshot.", {
      filePath,
      trigger: "manual-analyze-image"
    })

    return {
      text: ocrText,
      timestamp: Date.now(),
      response: submission.reply
    }
  }

  public getLLMHelper() {
    return this.llmHelper
  }
}
