import { app, BrowserWindow, Tray, Menu, nativeImage } from "electron"
import { initializeIpcHandlers } from "./ipcHandlers"
import { WindowHelper } from "./WindowHelper"
import { ScreenshotHelper } from "./ScreenshotHelper"
import { ShortcutsHelper } from "./shortcuts"
import { ProcessingHelper } from "./ProcessingHelper"
import { LiveTranscriptionHelper } from "./LiveTranscriptionHelper"
import { SettingsHelper } from "./SettingsHelper"
import { StorageHelper } from "./StorageHelper"
import { MeetingHelper } from "./MeetingHelper"
import { PlaybookHelper } from "./PlaybookHelper"
import { CoachingHelper } from "./CoachingHelper"
import { ConversationHelper } from "./ConversationHelper"
import { ExportHelper } from "./ExportHelper"
import { WebhookHelper } from "./WebhookHelper"
import { RegionSelectHelper } from "./RegionSelectHelper"
import { WhisperTranscriptionHelper } from "./WhisperTranscriptionHelper"
import { CalendarHelper } from "./CalendarHelper"

export class AppState {
  private static instance: AppState | null = null

  private windowHelper: WindowHelper
  private screenshotHelper: ScreenshotHelper
  public shortcutsHelper: ShortcutsHelper
  public processingHelper: ProcessingHelper
  public settingsHelper: SettingsHelper
  public storageHelper: StorageHelper
  public meetingHelper: MeetingHelper
  public playbookHelper: PlaybookHelper
  public coachingHelper: CoachingHelper
  public conversationHelper: ConversationHelper
  public exportHelper: ExportHelper
  public webhookHelper: WebhookHelper
  public regionSelectHelper: RegionSelectHelper
  public calendarHelper: CalendarHelper
  private whisperHelper: WhisperTranscriptionHelper | null = null
  private liveTranscriptionHelper: LiveTranscriptionHelper | null = null
  private tray: Tray | null = null

  // View management
  private view: "queue" | "solutions" = "queue"

  private problemInfo: {
    problem_statement: string
    input_format: Record<string, any>
    output_format: Record<string, any>
    constraints: Array<Record<string, any>>
    test_cases: Array<Record<string, any>>
  } | null = null // Allow null

  private hasDebugged: boolean = false

  // Processing events
  public readonly PROCESSING_EVENTS = {
    //global states
    UNAUTHORIZED: "procesing-unauthorized",
    NO_SCREENSHOTS: "processing-no-screenshots",

    //states for generating the initial solution
    INITIAL_START: "initial-start",
    PROBLEM_EXTRACTED: "problem-extracted",
    SOLUTION_SUCCESS: "solution-success",
    INITIAL_SOLUTION_ERROR: "solution-error",

    //states for processing the debugging
    DEBUG_START: "debug-start",
    DEBUG_SUCCESS: "debug-success",
    DEBUG_ERROR: "debug-error"
  } as const

  constructor() {
    this.settingsHelper = new SettingsHelper()
    this.storageHelper = new StorageHelper()
    this.windowHelper = new WindowHelper(this)
    this.screenshotHelper = new ScreenshotHelper(this.view)
    this.processingHelper = new ProcessingHelper(this)
    this.shortcutsHelper = new ShortcutsHelper(this)

    // Shared chat function using the active LLM provider
    const chatFn = async (prompt: string) => {
      const registry = this.processingHelper.getLLMHelper().getRegistry()
      return registry.chat(prompt)
    }
    this.meetingHelper = new MeetingHelper(this.storageHelper, chatFn)
    this.playbookHelper = new PlaybookHelper()
    this.coachingHelper = new CoachingHelper(chatFn)
    this.conversationHelper = new ConversationHelper()
    this.exportHelper = new ExportHelper(this.storageHelper)
    this.webhookHelper = new WebhookHelper()
    this.regionSelectHelper = new RegionSelectHelper()
    this.calendarHelper = new CalendarHelper()

    // Setup default playbook mappings for calendar events
    this.calendarHelper.setPlaybookMapping("standup", "team-standup")
    this.calendarHelper.setPlaybookMapping("interview", "technical-interview")
    this.calendarHelper.setPlaybookMapping("sales", "sales-call")
    this.calendarHelper.setPlaybookMapping("pitch", "vc-pitch")
    this.calendarHelper.setPlaybookMapping("customer", "customer-success")
  }

  public static getInstance(): AppState {
    if (!AppState.instance) {
      AppState.instance = new AppState()
    }
    return AppState.instance
  }

  // Getters and Setters
  public getMainWindow(): BrowserWindow | null {
    return this.windowHelper.getMainWindow()
  }

  public getView(): "queue" | "solutions" {
    return this.view
  }

  public setView(view: "queue" | "solutions"): void {
    this.view = view
    this.screenshotHelper.setView(view)
  }

  public isVisible(): boolean {
    return this.windowHelper.isVisible()
  }

  public getScreenshotHelper(): ScreenshotHelper {
    return this.screenshotHelper
  }

  public getProblemInfo(): any {
    return this.problemInfo
  }

  public setProblemInfo(problemInfo: any): void {
    this.problemInfo = problemInfo
  }

  public getScreenshotQueue(): string[] {
    return this.screenshotHelper.getScreenshotQueue()
  }

  public getExtraScreenshotQueue(): string[] {
    return this.screenshotHelper.getExtraScreenshotQueue()
  }

  // Window management methods
  public createWindow(): void {
    this.windowHelper.createWindow()
  }

  public hideMainWindow(): void {
    this.windowHelper.hideMainWindow()
  }

  public showMainWindow(): void {
    this.windowHelper.showMainWindow()
  }

  public toggleMainWindow(): void {
    console.log(
      "Screenshots: ",
      this.screenshotHelper.getScreenshotQueue().length,
      "Extra screenshots: ",
      this.screenshotHelper.getExtraScreenshotQueue().length
    )
    this.windowHelper.toggleMainWindow()
  }

  public setWindowDimensions(width: number, height: number): void {
    this.windowHelper.setWindowDimensions(width, height)
  }

  public clearQueues(): void {
    this.screenshotHelper.clearQueues()

    // Clear problem info
    this.problemInfo = null

    // Reset view to initial state
    this.setView("queue")
  }

  // Screenshot management methods
  public async takeScreenshot(): Promise<string> {
    if (!this.getMainWindow()) throw new Error("No main window available")

    const screenshotPath = await this.screenshotHelper.takeScreenshot(
      () => this.hideMainWindow(),
      () => this.showMainWindow()
    )

    return screenshotPath
  }

  public async getImagePreview(filepath: string): Promise<string> {
    return this.screenshotHelper.getImagePreview(filepath)
  }

  public async deleteScreenshot(
    path: string
  ): Promise<{ success: boolean; error?: string }> {
    return this.screenshotHelper.deleteScreenshot(path)
  }

  // New methods to move the window
  public moveWindowLeft(): void {
    this.windowHelper.moveWindowLeft()
  }

  public moveWindowRight(): void {
    this.windowHelper.moveWindowRight()
  }
  public moveWindowDown(): void {
    this.windowHelper.moveWindowDown()
  }
  public moveWindowUp(): void {
    this.windowHelper.moveWindowUp()
  }

  public centerAndShowWindow(): void {
    this.windowHelper.centerAndShowWindow()
  }

  public toggleClickThrough(): boolean {
    return this.windowHelper.toggleClickThrough()
  }

  public getAvailableDisplays() {
    return this.windowHelper.getAvailableDisplays()
  }

  public moveToDisplay(displayId: number): void {
    this.windowHelper.moveToDisplay(displayId)
  }

  public snapTo(position: "left" | "right" | "top-left" | "top-right" | "bottom-left" | "bottom-right"): void {
    this.windowHelper.snapTo(position)
  }

  public createTray(): void {
    this.tray = new Tray(nativeImage.createEmpty())
    
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Show Interview Coder',
        click: () => this.centerAndShowWindow()
      },
      {
        label: 'Toggle Window',
        click: () => this.toggleMainWindow()
      },
      { type: 'separator' },
      {
        label: 'Take Screenshot (Cmd+H)',
        click: async () => {
          try {
            const screenshotPath = await this.takeScreenshot()
            const preview = await this.getImagePreview(screenshotPath)
            const mainWindow = this.getMainWindow()
            if (mainWindow) {
              mainWindow.webContents.send("screenshot-taken", {
                path: screenshotPath,
                preview
              })
            }
          } catch (error) {
            console.error("Error taking screenshot from tray:", error)
          }
        }
      },
      { type: 'separator' },
      {
        label: 'Quit',
        accelerator: 'Command+Q',
        click: () => app.quit()
      }
    ])
    
    this.tray.setToolTip('Interview Coder - Press Cmd+Shift+Space to show')
    this.tray.setContextMenu(contextMenu)
    
    // Set a title for macOS (will appear in menu bar)
    if (process.platform === 'darwin') {
      this.tray.setTitle('IC')
    }
    
    // Double-click to show window
    this.tray.on('double-click', () => {
      this.centerAndShowWindow()
    })
  }

  public setHasDebugged(value: boolean): void {
    this.hasDebugged = value
  }

  public getHasDebugged(): boolean {
    return this.hasDebugged
  }

  public getLiveTranscriptionHelper(): LiveTranscriptionHelper | null {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) return null
    this.liveTranscriptionHelper ??= new LiveTranscriptionHelper(apiKey)
    return this.liveTranscriptionHelper
  }

  public getWhisperHelper(): WhisperTranscriptionHelper | null {
    const apiKey = this.settingsHelper.getApiKey("openai") || process.env.OPENAI_API_KEY
    if (!apiKey) return null
    this.whisperHelper ??= new WhisperTranscriptionHelper(apiKey)
    return this.whisperHelper
  }
}

async function initializeApp(): Promise<void> {
  const appState = AppState.getInstance()

  initializeIpcHandlers(appState)

  app.dock?.hide()
  app.commandLine.appendSwitch("disable-background-timer-throttling")

  await app.whenReady()

  console.log("App is ready")
  appState.createWindow()
  appState.createTray()
  appState.shortcutsHelper.registerGlobalShortcuts()

  app.on("activate", () => {
    if (appState.getMainWindow() === null) {
      appState.createWindow()
    }
  })

  app.on("before-quit", async () => {
    await appState.getLiveTranscriptionHelper()?.disconnect()
  })

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit()
    }
  })
}

// Start the application
initializeApp().catch(console.error)
