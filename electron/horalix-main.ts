/**
 * Horalix Halo - Main Process
 *
 * Electron main process with LLM and Session engines.
 */

import { app, BrowserWindow } from "electron"
import path from "path"
import { LlmEngine } from "../src/main/engines/llm/LlmEngine"
import { SessionEngine } from "../src/main/engines/session/SessionEngine"
import { initializeIpcHandlers } from "../src/main/ipc/handlers"
import { createAllProviders } from "../src/main/engines/llm/providers"
import type { ProviderConfig } from "../src/main/engines/llm/types"

let mainWindow: BrowserWindow | null = null
let llmEngine: LlmEngine
let sessionEngine: SessionEngine

// ============================================================================
// INITIALIZATION
// ============================================================================

async function initializeEngines(): Promise<void> {
  console.log("[Horalix] Initializing engines...")

  // Initialize Session Engine
  sessionEngine = new SessionEngine({
    enableWAL: true,
    enableForeignKeys: true,
  })
  await sessionEngine.initialize()
  console.log("[Horalix] SessionEngine initialized")

  // Initialize LLM Engine
  // NOTE: Provider configs should come from settings store
  // For now, using environment variables as defaults
  const providerConfigs: Record<string, ProviderConfig> = {
    deepseek: {
      apiKey: process.env.DEEPSEEK_API_KEY || "",
      baseUrl: process.env.DEEPSEEK_BASE_URL,
    },
    openai: {
      apiKey: process.env.OPENAI_API_KEY || "",
      baseUrl: process.env.OPENAI_BASE_URL,
    },
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY || "",
    },
    google: {
      apiKey: process.env.GOOGLE_API_KEY || "",
    },
    ollama: {
      baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
    },
  }

  const providers = await createAllProviders(providerConfigs)

  llmEngine = new LlmEngine({
    providers,
    cacheConfig: { maxSizeMB: 100, ttlMs: 3600000, strategy: "lru" },
    
  })
  console.log("[Horalix] LlmEngine initialized with", providers.size, "providers")

  // Initialize IPC handlers
  initializeIpcHandlers(llmEngine, sessionEngine)
  console.log("[Horalix] IPC handlers initialized")
}

// ============================================================================
// WINDOW MANAGEMENT
// ============================================================================

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    backgroundColor: "#0f0f23",
    titleBarStyle: "hidden",
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "horalix-preload.js"),
    },
  })

  // Load the app
  if (process.env.NODE_ENV === "development") {
    mainWindow.loadURL("http://localhost:5180")
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"))
  }

  mainWindow.on("closed", () => {
    mainWindow = null
  })

  console.log("[Horalix] Main window created")
}

// ============================================================================
// APP LIFECYCLE
// ============================================================================

app.whenReady().then(async () => {
  try {
    await initializeEngines()
    createWindow()

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
      }
    })
  } catch (error) {
    console.error("[Horalix] Initialization error:", error)
    app.quit()
  }
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit()
  }
})

app.on("will-quit", () => {
  console.log("[Horalix] Shutting down...")

  // Close database connection
  if (sessionEngine) {
    sessionEngine.close()
    console.log("[Horalix] SessionEngine closed")
  }
})

// Handle unhandled errors
process.on("uncaughtException", (error) => {
  console.error("[Horalix] Uncaught exception:", error)
})

process.on("unhandledRejection", (reason, promise) => {
  console.error("[Horalix] Unhandled rejection at:", promise, "reason:", reason)
})
