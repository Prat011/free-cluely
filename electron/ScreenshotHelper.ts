// ScreenshotHelper.ts

import path from "node:path"
import fs from "node:fs"
import { app, BrowserWindow, desktopCapturer, screen, systemPreferences, dialog } from "electron"
import { v4 as uuidv4 } from "uuid"
import sharp from "sharp"

export class ScreenshotHelper {
  private screenshotQueue: string[] = []
  private extraScreenshotQueue: string[] = []
  private readonly MAX_SCREENSHOTS = 5

  private readonly screenshotDir: string
  private readonly extraScreenshotDir: string

  private view: "queue" | "solutions" = "queue"

  public cropWindow: BrowserWindow | null = null
  public cropResolve: ((data: { x: number, y: number, width: number, height: number } | null) => void) | null = null

  constructor(view: "queue" | "solutions" = "queue") {
    this.view = view

    // Initialize directories
    this.screenshotDir = path.join(app.getPath("userData"), "screenshots")
    this.extraScreenshotDir = path.join(
      app.getPath("userData"),
      "extra_screenshots"
    )

    // Create directories if they don't exist
    if (!fs.existsSync(this.screenshotDir)) {
      fs.mkdirSync(this.screenshotDir)
    }
    if (!fs.existsSync(this.extraScreenshotDir)) {
      fs.mkdirSync(this.extraScreenshotDir)
    }
  }

  public getView(): "queue" | "solutions" {
    return this.view
  }

  public setView(view: "queue" | "solutions"): void {
    this.view = view
  }

  public getScreenshotQueue(): string[] {
    return this.screenshotQueue
  }

  public getExtraScreenshotQueue(): string[] {
    return this.extraScreenshotQueue
  }

  public clearQueues(): void {
    // Clear screenshotQueue
    this.screenshotQueue.forEach((screenshotPath) => {
      fs.unlink(screenshotPath, (err) => {
        if (err)
          console.error(`Error deleting screenshot at ${screenshotPath}:`, err)
      })
    })
    this.screenshotQueue = []

    // Clear extraScreenshotQueue
    this.extraScreenshotQueue.forEach((screenshotPath) => {
      fs.unlink(screenshotPath, (err) => {
        if (err)
          console.error(
            `Error deleting extra screenshot at ${screenshotPath}:`,
            err
          )
      })
    })
    this.extraScreenshotQueue = []
  }

  public async takeScreenshot(
    hideMainWindow: () => void,
    showMainWindow: () => void
  ): Promise<string> {
    try {
      hideMainWindow()
      
      // Add a small delay to ensure window is hidden
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Check for screen recording permissions on macOS
      if (process.platform === 'darwin') {
        const status = systemPreferences.getMediaAccessStatus('screen')
        if (status !== 'granted') {
          dialog.showErrorBox(
            'Screen Recording Permission Required',
            'Please grant Screen Recording permission to your terminal/app in System Settings > Privacy & Security > Screen Recording, then restart the app.'
          )
          showMainWindow()
          throw new Error('Screen recording permission not granted')
        }
      }
      
      const tempPath = path.join(this.screenshotDir, `temp-${uuidv4()}.png`)
      
      const primaryDisplay = screen.getPrimaryDisplay()
      const { width, height } = primaryDisplay.size
      const scaleFactor = primaryDisplay.scaleFactor
      
      const sources = await desktopCapturer.getSources({ 
        types: ['screen'], 
        thumbnailSize: { 
          width: width * scaleFactor, 
          height: height * scaleFactor 
        } 
      })
      
      if (sources.length === 0) {
        throw new Error("No screen sources found");
      }
      
      const image = sources[0].thumbnail.toPNG()
      await fs.promises.writeFile(tempPath, image)

      return await new Promise<string>((resolve, reject) => {
        this.cropWindow = new BrowserWindow({
          fullscreen: true,
          transparent: true,
          frame: false,
          alwaysOnTop: true,
          skipTaskbar: true,
          webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
          }
        });

        const isDev = process.env.NODE_ENV === "development"
        if (isDev) {
          this.cropWindow.loadURL("http://localhost:5180/#/crop")
        } else {
          this.cropWindow.loadFile(path.join(__dirname, "../dist/index.html"), { hash: "/crop" })
        }

        this.cropWindow.webContents.once('did-finish-load', async () => {
          try {
            const preview = await this.getImagePreview(tempPath)
            this.cropWindow?.webContents.send("crop-image", { path: tempPath, preview })
          } catch (e) {
            console.error("Error sending crop image:", e)
          }
        });

        this.cropResolve = async (cropData) => {
          this.cropResolve = null;
          if (this.cropWindow) {
            this.cropWindow.close();
            this.cropWindow = null;
          }

          if (!cropData || cropData.width === 0 || cropData.height === 0) {
            // Cancelled or invalid crop
            await fs.promises.unlink(tempPath).catch(console.error);
            showMainWindow();
            reject(new Error("Screenshot cancelled"));
            return;
          }

          let finalPath = "";
          if (this.view === "queue") {
            finalPath = path.join(this.screenshotDir, `${uuidv4()}.png`);
            this.screenshotQueue.push(finalPath);
            if (this.screenshotQueue.length > this.MAX_SCREENSHOTS) {
              const removedPath = this.screenshotQueue.shift()
              if (removedPath) await fs.promises.unlink(removedPath).catch(console.error)
            }
          } else {
            finalPath = path.join(this.extraScreenshotDir, `${uuidv4()}.png`);
            this.extraScreenshotQueue.push(finalPath);
            if (this.extraScreenshotQueue.length > this.MAX_SCREENSHOTS) {
              const removedPath = this.extraScreenshotQueue.shift()
              if (removedPath) await fs.promises.unlink(removedPath).catch(console.error)
            }
          }

          try {
            await sharp(tempPath)
              .extract({ 
                left: Math.round(cropData.x), 
                top: Math.round(cropData.y), 
                width: Math.round(cropData.width), 
                height: Math.round(cropData.height) 
              })
              .toFile(finalPath);
            await fs.promises.unlink(tempPath).catch(console.error);
            showMainWindow();
            resolve(finalPath);
          } catch (e) {
            await fs.promises.unlink(tempPath).catch(console.error);
            showMainWindow();
            reject(e);
          }
        };
      });
    } catch (error) {
      console.error("Error taking screenshot:", error)
      showMainWindow()
      throw new Error(`Failed to take screenshot: ${(error as Error).message}`)
    }
  }

  public async getImagePreview(filepath: string): Promise<string> {
    try {
      const data = await fs.promises.readFile(filepath)
      return `data:image/png;base64,${data.toString("base64")}`
    } catch (error) {
      console.error("Error reading image:", error)
      throw error
    }
  }

  public async deleteScreenshot(
    path: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await fs.promises.unlink(path)
      if (this.view === "queue") {
        this.screenshotQueue = this.screenshotQueue.filter(
          (filePath) => filePath !== path
        )
      } else {
        this.extraScreenshotQueue = this.extraScreenshotQueue.filter(
          (filePath) => filePath !== path
        )
      }
      return { success: true }
    } catch (error) {
      console.error("Error deleting file:", error)
      return { success: false, error: (error as Error).message }
    }
  }
}
