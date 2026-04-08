import { BrowserWindow, screen, ipcMain, app } from "electron"
import path from "node:path"
import screenshot from "screenshot-desktop"
import { v4 as uuidv4 } from "uuid"
import { RegionCropHelper, type CropRect } from "./RegionCropHelper"
import fs from "node:fs"

export class RegionSelectHelper {
  private selectWindow: BrowserWindow | null = null
  private cropHelper: RegionCropHelper
  private screenshotDir: string

  constructor() {
    this.screenshotDir = path.join(app.getPath("userData"), "screenshots")
    if (!fs.existsSync(this.screenshotDir)) {
      fs.mkdirSync(this.screenshotDir, { recursive: true })
    }
    this.cropHelper = new RegionCropHelper(this.screenshotDir)
  }

  /**
   * Start region capture flow:
   * 1. Take fullscreen screenshot
   * 2. Open fullscreen transparent selection window
   * 3. User draws rectangle
   * 4. Crop and return the region
   */
  async startCapture(): Promise<{ path: string; preview: string } | null> {
    if (this.selectWindow) {
      this.selectWindow.close()
      this.selectWindow = null
    }

    // Take a fullscreen screenshot first
    const fullScreenshotPath = path.join(this.screenshotDir, `full-${uuidv4()}.png`)
    await screenshot({ filename: fullScreenshotPath })

    return new Promise((resolve) => {
      const primaryDisplay = screen.getPrimaryDisplay()
      const { width, height } = primaryDisplay.size
      const scaleFactor = primaryDisplay.scaleFactor

      this.selectWindow = new BrowserWindow({
        x: primaryDisplay.bounds.x,
        y: primaryDisplay.bounds.y,
        width,
        height,
        fullscreen: true,
        transparent: true,
        frame: false,
        alwaysOnTop: true,
        skipTaskbar: true,
        hasShadow: false,
        resizable: false,
        webPreferences: {
          nodeIntegration: true,
          contextIsolation: false,
        },
      })

      // Close on blur (user clicked outside)
      this.selectWindow.on("blur", () => {
        cleanup(null)
      })

      const cleanup = async (rect: CropRect | null) => {
        // Remove IPC listeners
        ipcMain.removeAllListeners("region-select-done")
        ipcMain.removeAllListeners("region-select-cancel")

        if (this.selectWindow && !this.selectWindow.isDestroyed()) {
          this.selectWindow.close()
        }
        this.selectWindow = null

        if (!rect) {
          // Cancelled — clean up full screenshot
          fs.promises.unlink(fullScreenshotPath).catch(() => {})
          resolve(null)
          return
        }

        try {
          const croppedPath = await this.cropHelper.cropImage(
            fullScreenshotPath,
            rect,
            scaleFactor
          )

          // Clean up full screenshot
          fs.promises.unlink(fullScreenshotPath).catch(() => {})

          // Generate base64 preview
          const data = await fs.promises.readFile(croppedPath)
          const preview = `data:image/png;base64,${data.toString("base64")}`

          resolve({ path: croppedPath, preview })
        } catch (error) {
          console.error("Error cropping region:", error)
          fs.promises.unlink(fullScreenshotPath).catch(() => {})
          resolve(null)
        }
      }

      ipcMain.once("region-select-done", (_event, rect: CropRect) => {
        cleanup(rect)
      })

      ipcMain.once("region-select-cancel", () => {
        cleanup(null)
      })

      const htmlPath = path.join(__dirname, "region-select.html")
      this.selectWindow.loadFile(htmlPath).catch((err) => {
        console.error("Failed to load region-select.html:", err)
        cleanup(null)
      })
    })
  }

  isActive(): boolean {
    return this.selectWindow !== null && !this.selectWindow.isDestroyed()
  }

  cancel(): void {
    if (this.selectWindow && !this.selectWindow.isDestroyed()) {
      this.selectWindow.close()
    }
    this.selectWindow = null
  }
}
