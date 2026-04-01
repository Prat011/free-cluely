// ipcHandlers.ts

import { ipcMain, app } from "electron"
import { AppState } from "./main"
import { SessionSource } from "./SessionMemoryHelper"
import { HOTKEYS } from "./shortcuts"

export function initializeIpcHandlers(appState: AppState): void {
  ipcMain.handle(
    "update-content-dimensions",
    async (event, { width, height }: { width: number; height: number }) => {
      if (width && height) {
        appState.setWindowDimensions(width, height)
      }
    }
  )

  ipcMain.handle("delete-screenshot", async (event, path: string) => {
    return appState.deleteScreenshot(path)
  })

  ipcMain.handle("take-screenshot", async () => {
    try {
      const screenshotPath = await appState.takeScreenshot()
      const preview = await appState.getImagePreview(screenshotPath)
      return { path: screenshotPath, preview }
    } catch (error) {
      console.error("Error taking screenshot:", error)
      throw error
    }
  })

  ipcMain.handle("get-screenshots", async () => {
    console.log({ view: appState.getView() })
    try {
      let previews = []
      if (appState.getView() === "queue") {
        previews = await Promise.all(
          appState.getScreenshotQueue().map(async (path) => ({
            path,
            preview: await appState.getImagePreview(path)
          }))
        )
      } else {
        previews = await Promise.all(
          appState.getExtraScreenshotQueue().map(async (path) => ({
            path,
            preview: await appState.getImagePreview(path)
          }))
        )
      }
      previews.forEach((preview: any) => console.log(preview.path))
      return previews
    } catch (error) {
      console.error("Error getting screenshots:", error)
      throw error
    }
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

  // IPC handler for analyzing audio from base64 data
  ipcMain.handle("analyze-audio-base64", async (event, data: string, mimeType: string) => {
    try {
      const result = await appState.processingHelper.processAudioBase64(data, mimeType)
      return result
    } catch (error: any) {
      console.error("Error in analyze-audio-base64 handler:", error)
      throw error
    }
  })

  // IPC handler for analyzing audio from file path
  ipcMain.handle("analyze-audio-file", async (event, path: string) => {
    try {
      const result = await appState.processingHelper.processAudioFile(path)
      return result
    } catch (error: any) {
      console.error("Error in analyze-audio-file handler:", error)
      throw error
    }
  })

  // IPC handler for analyzing image from file path
  ipcMain.handle("analyze-image-file", async (event, path: string) => {
    try {
      const result = await appState.processingHelper.processImageFile(path)
      return result
    } catch (error: any) {
      console.error("Error in analyze-image-file handler:", error)
      throw error
    }
  })

  ipcMain.handle("gemini-chat", async (event, message: string) => {
    try {
      const result = await appState.processingHelper.submitTaggedInput("chat", message)
      return result.reply
    } catch (error: any) {
      console.error("Error in gemini-chat handler:", error)
      throw error
    }
  })

  ipcMain.handle(
    "submit-tagged-input",
    async (_, source: SessionSource, text: string, metadata?: Record<string, any>) => {
      try {
        return await appState.processingHelper.submitTaggedInput(source, text, metadata)
      } catch (error: any) {
        console.error("Error in submit-tagged-input handler:", error)
        throw error
      }
    }
  )

  ipcMain.handle("get-session-entries", async () => {
    try {
      return appState.processingHelper.getSessionEntries()
    } catch (error: any) {
      console.error("Error in get-session-entries handler:", error)
      throw error
    }
  })

  ipcMain.handle("toggle-realtime-audio-transcription", async () => {
    try {
      return await appState.processingHelper.toggleRealtimeAudioTranscription()
    } catch (error: any) {
      console.error("Error toggling realtime audio transcription:", error)
      throw error
    }
  })

  ipcMain.handle("get-realtime-audio-transcription-state", async () => {
    try {
      return appState.processingHelper.getRealtimeAudioTranscriptionState()
    } catch (error: any) {
      console.error("Error getting realtime transcription state:", error)
      throw error
    }
  })

  ipcMain.handle("get-hotkeys", async () => {
    return HOTKEYS
  })

  ipcMain.handle("quit-app", () => {
    app.quit()
  })

  // Window movement handlers
  ipcMain.handle("move-window-left", async () => {
    appState.moveWindowLeft()
  })

  ipcMain.handle("move-window-right", async () => {
    appState.moveWindowRight()
  })

  ipcMain.handle("move-window-up", async () => {
    appState.moveWindowUp()
  })

  ipcMain.handle("move-window-down", async () => {
    appState.moveWindowDown()
  })

  ipcMain.handle("center-and-show-window", async () => {
    appState.centerAndShowWindow()
  })

  // LLM Model Management Handlers
  ipcMain.handle("get-current-llm-config", async () => {
    try {
      const llmHelper = appState.processingHelper.getLLMHelper();
      return {
        provider: llmHelper.getCurrentProvider(),
        model: llmHelper.getCurrentModel(),
        isOllama: llmHelper.isUsingOllama(),
        isNvidia: llmHelper.isUsingNvidia()
      };
    } catch (error: any) {
      console.error("Error getting current LLM config:", error);
      throw error;
    }
  });

  ipcMain.handle("get-available-ollama-models", async () => {
    try {
      const llmHelper = appState.processingHelper.getLLMHelper();
      const models = await llmHelper.getOllamaModels();
      return models;
    } catch (error: any) {
      console.error("Error getting Ollama models:", error);
      throw error;
    }
  });

  ipcMain.handle("get-ollama-model-capabilities", async () => {
    try {
      const llmHelper = appState.processingHelper.getLLMHelper();
      const capabilities = await llmHelper.getOllamaModelCapabilities();
      return capabilities;
    } catch (error: any) {
      console.error("Error getting Ollama model capabilities:", error);
      throw error;
    }
  });

  ipcMain.handle("switch-to-ollama", async (_, model?: string, url?: string) => {
    try {
      const llmHelper = appState.processingHelper.getLLMHelper();
      await llmHelper.switchToOllama(model, url);
      return { success: true };
    } catch (error: any) {
      console.error("Error switching to Ollama:", error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle("switch-to-gemini", async (_, apiKey?: string) => {
    try {
      const llmHelper = appState.processingHelper.getLLMHelper();
      await llmHelper.switchToGemini(apiKey);
      return { success: true };
    } catch (error: any) {
      console.error("Error switching to Gemini:", error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle("switch-to-nvidia", async (_, apiKey?: string, model?: string, url?: string) => {
    try {
      const llmHelper = appState.processingHelper.getLLMHelper();
      await llmHelper.switchToNvidia(apiKey, model, url);
      return { success: true };
    } catch (error: any) {
      console.error("Error switching to NVIDIA:", error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle("test-llm-connection", async () => {
    try {
      const llmHelper = appState.processingHelper.getLLMHelper();
      const result = await llmHelper.testConnection();
      return result;
    } catch (error: any) {
      console.error("Error testing LLM connection:", error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle("get-screenshot-understanding-mode", async () => {
    try {
      const mode = appState.processingHelper.getCurrentScreenshotUnderstandingMode();
      return { mode };
    } catch (error: any) {
      console.error("Error getting screenshot understanding mode:", error);
      return { mode: "ocr", error: error.message };
    }
  });

  ipcMain.handle("set-screenshot-understanding-mode", async (_, mode: string) => {
    try {
      const normalized = appState.processingHelper.setScreenshotUnderstandingMode(mode);
      return { success: true, mode: normalized };
    } catch (error: any) {
      console.error("Error setting screenshot understanding mode:", error);
      return { success: false, error: error.message };
    }
  });
}
