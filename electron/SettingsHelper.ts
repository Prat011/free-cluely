import { safeStorage, app } from "electron"
import fs from "fs"
import path from "path"

export interface ProviderSettings {
  gemini?: { encryptedApiKey?: string }
  openai?: { encryptedApiKey?: string }
  claude?: { encryptedApiKey?: string }
  ollama?: { url: string; defaultModel: string }
}

export interface AppSettings {
  activeProvider: string
  activeModel?: string
  fallbackOrder: string[]
  providers: ProviderSettings
  speechRecognitionLang: string
}

function defaultSettings(): AppSettings {
  return {
    activeProvider: "gemini",
    fallbackOrder: [],
    providers: {},
    speechRecognitionLang: "en-US",
  }
}

export class SettingsHelper {
  private filePath: string
  private settings: AppSettings

  constructor(filePath?: string) {
    this.filePath = filePath ?? path.join(app.getPath("userData"), "settings.json")
    this.settings = this.load()
  }

  private load(): AppSettings {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, "utf-8")
        return { ...defaultSettings(), ...JSON.parse(raw) }
      }
    } catch (err) {
      console.error("[SettingsHelper] Failed to load settings:", err)
    }
    return defaultSettings()
  }

  private save(): void {
    try {
      const dir = path.dirname(this.filePath)
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(this.filePath, JSON.stringify(this.settings, null, 2))
    } catch (err) {
      console.error("[SettingsHelper] Failed to save settings:", err)
    }
  }

  getAll(): AppSettings {
    return { ...this.settings }
  }

  get<K extends keyof AppSettings>(key: K): AppSettings[K] {
    return this.settings[key]
  }

  set<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void {
    this.settings[key] = value
    this.save()
  }

  updateAll(partial: Partial<AppSettings>): void {
    Object.assign(this.settings, partial)
    this.save()
  }

  setApiKey(providerId: "gemini" | "openai" | "claude", apiKey: string): void {
    const encrypted = this.encrypt(apiKey)
    if (!this.settings.providers[providerId]) {
      (this.settings.providers as any)[providerId] = {}
    }
    (this.settings.providers[providerId] as any).encryptedApiKey = encrypted
    this.save()
  }

  getApiKey(providerId: "gemini" | "openai" | "claude"): string | undefined {
    const entry = this.settings.providers[providerId] as
      | { encryptedApiKey?: string }
      | undefined
    if (!entry?.encryptedApiKey) return undefined
    return this.decrypt(entry.encryptedApiKey)
  }

  setOllamaConfig(url: string, defaultModel: string): void {
    this.settings.providers.ollama = { url, defaultModel }
    this.save()
  }

  private encrypt(plaintext: string): string {
    if (safeStorage.isEncryptionAvailable()) {
      return safeStorage.encryptString(plaintext).toString("base64")
    }
    // Fallback: base64-only (not secure, but prevents plaintext in file)
    return Buffer.from(plaintext).toString("base64")
  }

  private decrypt(encoded: string): string {
    if (safeStorage.isEncryptionAvailable()) {
      return safeStorage.decryptString(Buffer.from(encoded, "base64"))
    }
    return Buffer.from(encoded, "base64").toString()
  }
}
