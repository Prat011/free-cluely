/**
 * Horalix Halo - Electron Main Process
 *
 * Modern AI meeting assistant with multi-provider LLM support
 */

import { app, BrowserWindow } from 'electron'
import path from 'path'
import { LlmEngine } from '../src/main/engines/llm/LlmEngine'
import { SessionEngine } from '../src/main/engines/session/SessionEngine'
import { initializeIpcHandlers } from '../src/main/ipc/handlers'

let mainWindow: BrowserWindow | null = null
let llmEngine: LlmEngine
let sessionEngine: SessionEngine

const isDev = process.env.NODE_ENV === 'development'
const VITE_DEV_SERVER_URL = 'http://localhost:5180'

/**
 * Initialize engines (LLM and Session)
 */
async function initializeEngines() {
  console.log('[Horalix] Initializing engines...')

  // Initialize LLM Engine
  llmEngine = new LlmEngine({
    defaultProviderId: 'deepseek',
    maxConcurrentRequests: 3,
  })

  // Initialize Session Engine
  sessionEngine = new SessionEngine({
    enableWAL: true,
    enableForeignKeys: true,
  })
  await sessionEngine.initialize()

  // Setup IPC handlers
  initializeIpcHandlers(llmEngine, sessionEngine)

  console.log('[Horalix] Engines initialized successfully')
}

/**
 * Create the main application window
 */
async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'horalix-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: 'default',
    backgroundColor: '#1a1625',
  })

  // Load the app
  if (isDev) {
    await mainWindow.loadURL(VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    await mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  console.log('[Horalix] Main window created')
}

// App lifecycle
app.whenReady().then(async () => {
  try {
    // Initialize engines first
    await initializeEngines()

    // Then create window
    await createWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
      }
    })

    console.log('[Horalix Halo] Application started successfully')
  } catch (error) {
    console.error('[Horalix] Failed to start application:', error)
    app.quit()
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
