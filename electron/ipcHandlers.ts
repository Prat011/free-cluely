import { ipcMain, app } from "electron"
import { AppState } from "./main"
import { GeminiProvider, OpenAIProvider, ClaudeProvider, OllamaProvider } from "./llm"
import type { MeetingRecord } from "./StorageHelper"

export function initializeIpcHandlers(appState: AppState): void {
  ipcMain.handle(
    "update-content-dimensions",
    async (_event, { width, height }: { width: number; height: number }) => {
      if (width && height) {
        appState.setWindowDimensions(width, height)
      }
    }
  )

  ipcMain.handle("delete-screenshot", async (_event, path: string) => {
    return appState.deleteScreenshot(path)
  })

  ipcMain.handle("take-screenshot", async () => {
    const screenshotPath = await appState.takeScreenshot()
    const preview = await appState.getImagePreview(screenshotPath)
    return { path: screenshotPath, preview }
  })

  ipcMain.handle("get-screenshots", async () => {
    const queue =
      appState.getView() === "queue"
        ? appState.getScreenshotQueue()
        : appState.getExtraScreenshotQueue()

    return Promise.all(
      queue.map(async (path) => ({
        path,
        preview: await appState.getImagePreview(path)
      }))
    )
  })

  ipcMain.handle("toggle-window", async () => {
    appState.toggleMainWindow()
  })

  ipcMain.handle("reset-queues", async () => {
    try {
      appState.clearQueues()
      console.log("Screenshot queues have been cleared.")
      return { success: true }
    } catch (error: any) {
      console.error("Error resetting queues:", error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle("analyze-audio-base64", async (_event, data: string, mimeType: string) => {
    return appState.processingHelper.processAudioBase64(data, mimeType)
  })

  ipcMain.handle("analyze-audio-file", async (_event, path: string) => {
    return appState.processingHelper.processAudioFile(path)
  })

  ipcMain.handle("analyze-image-file", async (_event, path: string) => {
    return appState.processingHelper.getLLMHelper().analyzeImageFile(path)
  })

  ipcMain.handle("gemini-chat", async (_event, message: string) => {
    return appState.processingHelper.getLLMHelper().chatWithGemini(message)
  })

  ipcMain.handle("quit-app", () => {
    app.quit()
  })

  // Window movement handlers
  ipcMain.handle("move-window-left", async () => appState.moveWindowLeft())
  ipcMain.handle("move-window-right", async () => appState.moveWindowRight())
  ipcMain.handle("move-window-up", async () => appState.moveWindowUp())
  ipcMain.handle("move-window-down", async () => appState.moveWindowDown())
  ipcMain.handle("center-and-show-window", async () => appState.centerAndShowWindow())

  // LLM Model Management
  ipcMain.handle("get-current-llm-config", async () => {
    const llmHelper = appState.processingHelper.getLLMHelper()
    return {
      provider: llmHelper.getCurrentProvider(),
      model: llmHelper.getCurrentModel(),
      isOllama: llmHelper.isUsingOllama()
    }
  })

  ipcMain.handle("get-available-ollama-models", async () => {
    return appState.processingHelper.getLLMHelper().getOllamaModels()
  })

  ipcMain.handle("switch-to-ollama", async (_, model?: string, url?: string) => {
    try {
      await appState.processingHelper.getLLMHelper().switchToOllama(model, url)
      return { success: true }
    } catch (error: any) {
      console.error("Error switching to Ollama:", error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle("switch-to-gemini", async (_, apiKey?: string) => {
    try {
      await appState.processingHelper.getLLMHelper().switchToGemini(apiKey)
      return { success: true }
    } catch (error: any) {
      console.error("Error switching to Gemini:", error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle("test-llm-connection", async () => {
    try {
      return await appState.processingHelper.getLLMHelper().testConnection()
    } catch (error: any) {
      console.error("Error testing LLM connection:", error)
      return { success: false, error: error.message }
    }
  })

  // Speaker transcription (Gemini Live API)
  ipcMain.handle("start-speaker-transcription", async (_event, language: string) => {
    const helper = appState.getLiveTranscriptionHelper()
    if (!helper) return { success: false, error: "GEMINI_API_KEY not set" }

    const mainWindow = appState.getMainWindow()
    if (!mainWindow) return { success: false, error: "No main window" }

    try {
      await helper.connect(mainWindow, language)
      return { success: true }
    } catch (error: any) {
      console.error("Error starting speaker transcription:", error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle("stop-speaker-transcription", async () => {
    await appState.getLiveTranscriptionHelper()?.disconnect()
    return { success: true }
  })

  ipcMain.on("speaker-audio-chunk", (_event, base64Pcm: string) => {
    appState.getLiveTranscriptionHelper()?.sendAudioChunk(base64Pcm)
  })

  // === Multi-Provider Settings API (Phase 1.3) ===

  ipcMain.handle("get-settings", async () => {
    return appState.settingsHelper.getAll()
  })

  ipcMain.handle("update-settings", async (_, partial: Record<string, any>) => {
    try {
      appState.settingsHelper.updateAll(partial)
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle("get-available-providers", async () => {
    return [
      { id: "gemini", name: "Google Gemini", supportsVision: true, supportsAudio: true },
      { id: "openai", name: "OpenAI", supportsVision: true, supportsAudio: false },
      { id: "claude", name: "Anthropic Claude", supportsVision: true, supportsAudio: false },
      { id: "ollama", name: "Ollama (Local)", supportsVision: true, supportsAudio: false },
    ]
  })

  ipcMain.handle("set-provider-api-key", async (_, providerId: string, apiKey: string) => {
    try {
      if (providerId === "ollama") {
        return { success: false, error: "Ollama does not use API keys" }
      }
      appState.settingsHelper.setApiKey(providerId as "gemini" | "openai" | "claude", apiKey)
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle("set-active-provider", async (_, providerId: string, config?: { model?: string; apiKey?: string; url?: string }) => {
    try {
      const llmHelper = appState.processingHelper.getLLMHelper()
      const registry = llmHelper.getRegistry()

      if (providerId === "gemini") {
        const apiKey = config?.apiKey || appState.settingsHelper.getApiKey("gemini") || process.env.GEMINI_API_KEY
        if (!apiKey) return { success: false, error: "No Gemini API key configured" }
        registry.register(new GeminiProvider(apiKey, config?.model))
        registry.setActiveProvider("gemini")
      } else if (providerId === "openai") {
        const apiKey = config?.apiKey || appState.settingsHelper.getApiKey("openai")
        if (!apiKey) return { success: false, error: "No OpenAI API key configured" }
        registry.register(new OpenAIProvider(apiKey, config?.model))
        registry.setActiveProvider("openai")
      } else if (providerId === "claude") {
        const apiKey = config?.apiKey || appState.settingsHelper.getApiKey("claude")
        if (!apiKey) return { success: false, error: "No Claude API key configured" }
        registry.register(new ClaudeProvider(apiKey, config?.model))
        registry.setActiveProvider("claude")
      } else if (providerId === "ollama") {
        const url = config?.url || "http://localhost:11434"
        registry.register(new OllamaProvider(config?.model || "llama3.2", url))
        registry.setActiveProvider("ollama")
      } else {
        return { success: false, error: `Unknown provider: ${providerId}` }
      }

      // Persist
      appState.settingsHelper.set("activeProvider", providerId)
      if (config?.apiKey && providerId !== "ollama") {
        appState.settingsHelper.setApiKey(providerId as "gemini" | "openai" | "claude", config.apiKey)
      }

      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle("test-provider-connection", async (_, providerId?: string) => {
    try {
      if (!providerId) {
        return appState.processingHelper.getLLMHelper().testConnection()
      }
      const registry = appState.processingHelper.getLLMHelper().getRegistry()
      const provider = registry.getProvider(providerId)
      if (!provider) return { success: false, error: `Provider "${providerId}" not registered` }
      return provider.testConnection()
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle("get-provider-models", async (_, providerId: string) => {
    try {
      const registry = appState.processingHelper.getLLMHelper().getRegistry()
      const provider = registry.getProvider(providerId)
      if (!provider) return []
      return provider.getAvailableModels()
    } catch {
      return []
    }
  })

  // === Meeting Management API (Phase 2) ===

  ipcMain.handle("start-meeting", async (_, title?: string) => {
    try {
      const record = appState.meetingHelper.startMeeting(title)
      return { success: true, meeting: record }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle("end-meeting", async () => {
    try {
      const record = await appState.meetingHelper.endMeeting()
      return { success: true, meeting: record }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle("get-current-meeting", async () => {
    return appState.meetingHelper.getCurrentMeeting()
  })

  ipcMain.handle("get-meeting", async (_, id: string) => {
    return appState.storageHelper.getMeeting(id)
  })

  ipcMain.handle("get-meeting-history", async () => {
    return appState.storageHelper.listMeetings()
  })

  ipcMain.handle("delete-meeting", async (_, id: string) => {
    return { success: appState.storageHelper.deleteMeeting(id) }
  })

  ipcMain.handle("search-meetings", async (_, query: string) => {
    return appState.storageHelper.searchMeetings(query)
  })

  ipcMain.handle("generate-meeting-summary", async (_, meetingId: string) => {
    try {
      const summary = await appState.meetingHelper.generateSummary(meetingId)
      return { success: true, summary }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle("extract-action-items", async (_, meetingId: string) => {
    try {
      const items = await appState.meetingHelper.extractActionItems(meetingId)
      return { success: true, items }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle("add-transcription-entry", async (_, meetingId: string, entry: any) => {
    try {
      appState.storageHelper.addTranscriptionEntry(meetingId, entry)

      // Emit context update to renderer
      const mainWindow = appState.getMainWindow()
      const record = appState.storageHelper.getMeeting(meetingId)
      if (mainWindow && record) {
        mainWindow.webContents.send("meeting-context-update", record)
      }

      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // === Playbook API (Phase 3) ===

  ipcMain.handle("list-playbooks", async () => {
    return appState.playbookHelper.listPlaybooks()
  })

  ipcMain.handle("get-playbook", async (_, id: string) => {
    return appState.playbookHelper.getPlaybook(id)
  })

  ipcMain.handle("create-playbook", async (_, input: any) => {
    try {
      const playbook = appState.playbookHelper.createPlaybook(input)
      return { success: true, playbook }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle("update-playbook", async (_, id: string, partial: any) => {
    const result = appState.playbookHelper.updatePlaybook(id, partial)
    return result ? { success: true, playbook: result } : { success: false, error: "Cannot update" }
  })

  ipcMain.handle("delete-playbook", async (_, id: string) => {
    return { success: appState.playbookHelper.deletePlaybook(id) }
  })

  // === Coaching API (Phase 3) ===

  ipcMain.handle("evaluate-coaching", async (_, statement: string, playbookId: string) => {
    try {
      const playbook = appState.playbookHelper.getPlaybook(playbookId)
      if (!playbook) return { advice: null, error: "Playbook not found" }
      const advice = await appState.coachingHelper.evaluateStatement(statement, playbook)
      return { advice }
    } catch (error: any) {
      return { advice: null, error: error.message }
    }
  })

  ipcMain.handle("generate-quick-responses", async (_, question: string, context: string) => {
    try {
      const responses = await appState.coachingHelper.generateQuickResponses(question, context)
      return { responses }
    } catch (error: any) {
      return { responses: [], error: error.message }
    }
  })

  // === Conversation History (Phase 4.3) ===

  ipcMain.handle("get-conversation-history", async (_, limit?: number) => {
    return appState.conversationHelper.getMessages(limit)
  })

  ipcMain.handle("add-conversation-message", async (_, role: "user" | "assistant", content: string) => {
    appState.conversationHelper.addMessage(role, content)
    return { success: true }
  })

  ipcMain.handle("get-conversation-context", async (_, limit?: number) => {
    return appState.conversationHelper.getContextString(limit)
  })

  ipcMain.handle("clear-conversation-history", async () => {
    appState.conversationHelper.clear()
    return { success: true }
  })

  // === Click-through & Window Management (Phase 4.2 / 4.4) ===

  ipcMain.handle("toggle-click-through", async () => {
    return { isClickThrough: appState.toggleClickThrough() }
  })

  ipcMain.handle("get-available-displays", async () => {
    return appState.getAvailableDisplays()
  })

  ipcMain.handle("move-to-display", async (_, displayId: number) => {
    appState.moveToDisplay(displayId)
    return { success: true }
  })

  ipcMain.handle("snap-window", async (_, position: string) => {
    appState.snapTo(position as any)
    return { success: true }
  })

  // === Export API (Phase 5.2) ===

  ipcMain.handle("export-meeting-markdown", async (_, meetingId: string) => {
    const md = appState.exportHelper.toMarkdown(meetingId)
    return md ? { success: true, markdown: md } : { success: false, error: "Meeting not found" }
  })

  ipcMain.handle("export-meeting-clipboard", async (_, meetingId: string) => {
    return { success: appState.exportHelper.copyToClipboard(meetingId) }
  })

  ipcMain.handle("export-meeting-json", async (_, meetingId: string) => {
    const json = appState.exportHelper.toJSON(meetingId)
    return json ? { success: true, json } : { success: false, error: "Meeting not found" }
  })

  // === Webhook API (Phase 5.3) ===

  ipcMain.handle("set-webhook-url", async (_, url: string | null) => {
    appState.webhookHelper.setWebhookUrl(url)
    return { success: true }
  })

  ipcMain.handle("get-webhook-url", async () => {
    return { url: appState.webhookHelper.getWebhookUrl() }
  })

  ipcMain.handle("test-webhook", async () => {
    const testMeeting: MeetingRecord = {
      id: "test",
      title: "Webhook Test",
      startedAt: Date.now(),
      endedAt: Date.now(),
      entries: [],
      summary: "This is a test webhook delivery.",
      actionItems: [],
      chunkSummaries: [],
      metadata: { language: "en-US", providerId: "test", modelId: "test" },
    }
    return appState.webhookHelper.sendMeetingEnded(testMeeting)
  })

  // === Whisper Transcription API (Phase 4.5) ===

  ipcMain.handle("whisper-transcribe", async (_, filePath: string, options?: { language?: string; prompt?: string }) => {
    try {
      const whisperHelper = appState.getWhisperHelper()
      if (!whisperHelper) {
        return { success: false, error: "OpenAI API key not configured for Whisper" }
      }
      const result = await whisperHelper.transcribe(filePath, options)
      return { success: true, ...result }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle("whisper-transcribe-verbose", async (_, filePath: string, options?: { language?: string; prompt?: string }) => {
    try {
      const whisperHelper = appState.getWhisperHelper()
      if (!whisperHelper) {
        return { success: false, error: "OpenAI API key not configured for Whisper" }
      }
      const result = await whisperHelper.transcribeVerbose(filePath, options)
      return { success: true, ...result }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle("get-whisper-languages", async () => {
    const { WhisperTranscriptionHelper } = await import("./WhisperTranscriptionHelper")
    return WhisperTranscriptionHelper.getSupportedLanguages()
  })

  // === Calendar API (Phase 5.1) ===

  ipcMain.handle("get-upcoming-events", async () => {
    return appState.calendarHelper.getUpcomingEvents()
  })

  ipcMain.handle("get-next-event", async () => {
    return appState.calendarHelper.getNextEvent()
  })

  ipcMain.handle("get-imminent-events", async (_, minutes?: number) => {
    return appState.calendarHelper.getImminentEvents(minutes ?? 5)
  })

  ipcMain.handle("add-calendar-event", async (_, event: any) => {
    try {
      appState.calendarHelper.addEvent(event)
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle("import-ics", async (_, icsText: string) => {
    try {
      const { CalendarHelper } = await import("./CalendarHelper")
      const events = CalendarHelper.parseICS(icsText)
      for (const event of events) {
        appState.calendarHelper.addEvent(event)
      }
      return { success: true, count: events.length }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle("suggest-playbook-for-event", async (_, eventTitle: string) => {
    return { playbookId: appState.calendarHelper.suggestPlaybook(eventTitle) ?? null }
  })

  // === Region Capture API (Phase 4.1) ===

  ipcMain.handle("start-region-capture", async () => {
    try {
      // Hide main window during capture
      appState.hideMainWindow()
      await new Promise(resolve => setTimeout(resolve, 100))

      const result = await appState.regionSelectHelper.startCapture()

      // Show main window again
      appState.showMainWindow()

      if (!result) {
        return { success: false, error: "Region capture cancelled" }
      }

      return { success: true, path: result.path, preview: result.preview }
    } catch (error: any) {
      appState.showMainWindow()
      console.error("Error in region capture:", error)
      return { success: false, error: error.message }
    }
  })
}
