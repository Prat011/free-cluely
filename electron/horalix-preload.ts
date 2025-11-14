/**
 * Horalix Halo - Electron Preload Script
 *
 * Exposes safe IPC methods to renderer
 */

import { contextBridge, ipcRenderer } from 'electron'

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Version info
  getVersion: () => process.versions.electron,
  
  // IPC invoke method for future features
  invoke: (channel: string, ...args: any[]) => ipcRenderer.invoke(channel, ...args),
})

console.log('[Horalix Halo] Preload script loaded')
