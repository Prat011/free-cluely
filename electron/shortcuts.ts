import { globalShortcut, app } from "electron"
import { AppState } from "./main" // Adjust the import path if necessary

export const HOTKEYS = {
  toggleWindow: "CommandOrControl+Shift+Space",
  screenshot: "CommandOrControl+Alt+Shift+H",
  solve: "CommandOrControl+Alt+Shift+Enter",
  openChat: "CommandOrControl+Alt+Shift+C",
  sttToggle: "CommandOrControl+Alt+Shift+S"
} as const

export class ShortcutsHelper {
  private appState: AppState
  private lastSttToggleAt: number = 0

  constructor(appState: AppState) {
    this.appState = appState
  }

  public registerGlobalShortcuts(): void {
    // Add global shortcut to show/center window
    globalShortcut.register(HOTKEYS.toggleWindow, () => {
      console.log("Show/Center window shortcut pressed...")
      this.appState.centerAndShowWindow()
    })

    globalShortcut.register(HOTKEYS.screenshot, async () => {
      const mainWindow = this.appState.getMainWindow()
      if (mainWindow) {
        console.log("Taking screenshot...")
        try {
          const screenshotPath = await this.appState.takeScreenshot()
          const preview = await this.appState.getImagePreview(screenshotPath)
          mainWindow.webContents.send("screenshot-taken", {
            path: screenshotPath,
            preview
          })
        } catch (error) {
          console.error("Error capturing screenshot:", error)
        }
      }
    })

    globalShortcut.register(HOTKEYS.solve, async () => {
      await this.appState.processingHelper.processScreenshots()
    })

    globalShortcut.register(HOTKEYS.openChat, () => {
      const mainWindow = this.appState.getMainWindow()
      if (mainWindow && !mainWindow.isDestroyed()) {
        // Keep stealth mode: do not focus or show the window on chat hotkey.
        mainWindow.webContents.send("open-chat")
      }
    })

    globalShortcut.register(HOTKEYS.sttToggle, async () => {
      const now = Date.now()
      if (now - this.lastSttToggleAt < 1200) {
        return
      }
      this.lastSttToggleAt = now

      try {
        const result = await this.appState.processingHelper.toggleRealtimeAudioTranscription()
        const isDebounced = Boolean((result as any)?.debounced)
        const hasMeaningfulPayload = Boolean((result as any)?.transcript) || Boolean((result as any)?.llmReply)
        if (!isDebounced && (result?.active || hasMeaningfulPayload)) {
          console.log("Realtime audio transcription toggled:", result)
        }
      } catch (error) {
        console.error("Failed to toggle realtime audio transcription:", error)
      }
    })

    globalShortcut.register("CommandOrControl+R", () => {
      console.log(
        "Command + R pressed. Canceling requests and resetting queues..."
      )

      // Cancel ongoing API requests
      this.appState.processingHelper.cancelOngoingRequests()

      // Clear both screenshot queues
      this.appState.clearQueues()

      console.log("Cleared queues.")

      // Update the view state to 'queue'
      this.appState.setView("queue")

      // Notify renderer process to switch view to 'queue'
      const mainWindow = this.appState.getMainWindow()
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("reset-view")
      }
    })

    // New shortcuts for moving the window
    globalShortcut.register("CommandOrControl+Left", () => {
      console.log("Command/Ctrl + Left pressed. Moving window left.")
      this.appState.moveWindowLeft()
    })

    globalShortcut.register("CommandOrControl+Right", () => {
      console.log("Command/Ctrl + Right pressed. Moving window right.")
      this.appState.moveWindowRight()
    })
    globalShortcut.register("CommandOrControl+Down", () => {
      console.log("Command/Ctrl + down pressed. Moving window down.")
      this.appState.moveWindowDown()
    })
    globalShortcut.register("CommandOrControl+Up", () => {
      console.log("Command/Ctrl + Up pressed. Moving window Up.")
      this.appState.moveWindowUp()
    })

    globalShortcut.register("CommandOrControl+B", () => {
      this.appState.toggleMainWindow()
      // If window exists and we're showing it, bring it to front
      const mainWindow = this.appState.getMainWindow()
      if (mainWindow && !this.appState.isVisible()) {
        // Force the window to the front on macOS
        if (process.platform === "darwin") {
          mainWindow.setAlwaysOnTop(true, "normal")
          // Reset alwaysOnTop after a brief delay
          setTimeout(() => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.setAlwaysOnTop(true, "floating")
            }
          }, 100)
        }
      }
    })

    // Unregister shortcuts when quitting
    app.on("will-quit", () => {
      globalShortcut.unregisterAll()
    })
  }
}
