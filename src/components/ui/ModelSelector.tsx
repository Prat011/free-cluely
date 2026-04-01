import React, { useState, useEffect } from "react"

type Provider = "ollama" | "gemini" | "nvidia"
type ScreenshotUnderstandingMode = "ocr" | "ocr-llm-filter" | "multimodal"

interface ModelConfig {
  provider: Provider
  model: string
  isOllama: boolean
  isNvidia: boolean
}

interface OllamaModelCapability {
  name: string
  supportsVision: boolean
  supportsAudio: boolean
}

interface ModelSelectorProps {
  onModelChange?: (provider: Provider, model: string) => void
  onChatOpen?: () => void
}

const ModelSelector: React.FC<ModelSelectorProps> = ({ onModelChange, onChatOpen }) => {
  const [currentConfig, setCurrentConfig] = useState<ModelConfig | null>(null)
  const [availableOllamaModels, setAvailableOllamaModels] = useState<string[]>([])
  const [ollamaModelCapabilities, setOllamaModelCapabilities] = useState<OllamaModelCapability[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [connectionStatus, setConnectionStatus] = useState<"testing" | "success" | "error" | null>(null)
  const [errorMessage, setErrorMessage] = useState<string>("")
  const [screenshotMode, setScreenshotMode] = useState<ScreenshotUnderstandingMode>("ocr")
  const [screenshotModeStatus, setScreenshotModeStatus] = useState<string>("")

  const [selectedProvider, setSelectedProvider] = useState<Provider>("gemini")

  const [geminiApiKey, setGeminiApiKey] = useState("")

  const [selectedOllamaModel, setSelectedOllamaModel] = useState<string>("")
  const [ollamaUrl, setOllamaUrl] = useState<string>("http://localhost:11434")

  const [nvidiaApiKey, setNvidiaApiKey] = useState("")
  const [nvidiaModel, setNvidiaModel] = useState("mistralai/mistral-small-3.1-24b-instruct-2503")
  const [nvidiaUrl, setNvidiaUrl] = useState("https://integrate.api.nvidia.com/v1/chat/completions")

  useEffect(() => {
    loadCurrentConfig()
  }, [])

  useEffect(() => {
    loadScreenshotMode()
  }, [])

  useEffect(() => {
    if (selectedProvider === "ollama") {
      loadOllamaModels()
    }
  }, [selectedProvider])

  const loadCurrentConfig = async () => {
    try {
      setIsLoading(true)
      const config = await window.electronAPI.getCurrentLlmConfig()
      setCurrentConfig(config)
      setSelectedProvider(config.provider)

      if (config.isOllama) {
        setSelectedOllamaModel(config.model)
        await loadOllamaModels()
      }

      if (config.isNvidia) {
        setNvidiaModel(config.model)
      }
    } catch (error) {
      console.error("Error loading current config:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const loadOllamaModels = async () => {
    try {
      const capabilities = await window.electronAPI.getOllamaModelCapabilities()
      const models = capabilities.map((capability) => capability.name)

      setOllamaModelCapabilities(capabilities)
      setAvailableOllamaModels(models)

      if (models.length > 0 && !selectedOllamaModel) {
        setSelectedOllamaModel(models[0])
      }
    } catch (error) {
      console.error("Error loading Ollama models:", error)
      setOllamaModelCapabilities([])
      setAvailableOllamaModels([])
    }
  }

  const loadScreenshotMode = async () => {
    try {
      const result = await window.electronAPI.getScreenshotUnderstandingMode()
      if (result.mode) {
        setScreenshotMode(result.mode)
      }
    } catch (error) {
      console.error("Error loading screenshot understanding mode:", error)
    }
  }

  const handleScreenshotModeChange = async (mode: ScreenshotUnderstandingMode) => {
    setScreenshotMode(mode)
    setScreenshotModeStatus("Saving...")
    try {
      const result = await window.electronAPI.setScreenshotUnderstandingMode(mode)
      if (result.success) {
        setScreenshotMode(result.mode || mode)
        setScreenshotModeStatus("Saved")
      } else {
        setScreenshotModeStatus(result.error || "Failed")
      }
    } catch (error) {
      setScreenshotModeStatus(String(error))
    }

    setTimeout(() => {
      setScreenshotModeStatus("")
    }, 1500)
  }

  const getModelCapabilities = (modelName: string) => {
    return ollamaModelCapabilities.find((model) => model.name === modelName)
  }

  const hasVisionModel = ollamaModelCapabilities.some((model) => model.supportsVision)
  const hasAudioModel = ollamaModelCapabilities.some((model) => model.supportsAudio)
  const selectedModelCapabilities = getModelCapabilities(selectedOllamaModel)

  const testConnection = async () => {
    try {
      setConnectionStatus("testing")
      const result = await window.electronAPI.testLlmConnection()
      setConnectionStatus(result.success ? "success" : "error")
      if (!result.success) {
        setErrorMessage(result.error || "Unknown error")
      }
    } catch (error) {
      setConnectionStatus("error")
      setErrorMessage(String(error))
    }
  }

  const handleProviderSwitch = async () => {
    try {
      setConnectionStatus("testing")
      let result: { success: boolean; error?: string }

      if (selectedProvider === "ollama") {
        result = await window.electronAPI.switchToOllama(selectedOllamaModel, ollamaUrl)
      } else if (selectedProvider === "nvidia") {
        const hasExistingNvidiaSession = Boolean(currentConfig?.isNvidia)
        if (!nvidiaApiKey && !hasExistingNvidiaSession) {
          setConnectionStatus("error")
          setErrorMessage("Paste your NVIDIA API key to switch to NVIDIA provider.")
          return
        }
        result = await window.electronAPI.switchToNvidia(nvidiaApiKey || undefined, nvidiaModel, nvidiaUrl)
      } else {
        result = await window.electronAPI.switchToGemini(geminiApiKey || undefined)
      }

      if (result.success) {
        await loadCurrentConfig()
        setConnectionStatus("success")
        const modelName =
          selectedProvider === "ollama"
            ? selectedOllamaModel
            : selectedProvider === "nvidia"
              ? nvidiaModel
              : "gemini-2.0-flash"
        onModelChange?.(selectedProvider, modelName)
        setTimeout(() => {
          onChatOpen?.()
        }, 500)
      } else {
        setConnectionStatus("error")
        setErrorMessage(result.error || "Switch failed")
      }
    } catch (error) {
      setConnectionStatus("error")
      setErrorMessage(String(error))
    }
  }

  const getStatusColor = () => {
    switch (connectionStatus) {
      case "testing":
        return "text-yellow-600"
      case "success":
        return "text-green-600"
      case "error":
        return "text-red-600"
      default:
        return "text-gray-600"
    }
  }

  const getStatusText = () => {
    switch (connectionStatus) {
      case "testing":
        return "Testing connection..."
      case "success":
        return "Connected successfully"
      case "error":
        return `Error: ${errorMessage}`
      default:
        return "Ready"
    }
  }

  if (isLoading) {
    return (
      <div className="p-4 bg-white/20 backdrop-blur-md rounded-lg border border-white/30">
        <div className="animate-pulse text-sm text-gray-600">Loading model configuration...</div>
      </div>
    )
  }

  const currentProviderIcon = currentConfig?.provider === "ollama" ? "🏠" : currentConfig?.provider === "nvidia" ? "🟢" : "☁️"

  return (
    <div className="p-4 bg-white/20 backdrop-blur-md rounded-lg border border-white/30 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-800">AI Model Selection</h3>
        <div className={`text-xs ${getStatusColor()}`}>{getStatusText()}</div>
      </div>

      {currentConfig && (
        <div className="text-xs text-gray-600 bg-white/40 p-2 rounded">
          Current: {currentProviderIcon} {currentConfig.model}
        </div>
      )}

      <div className="space-y-2">
        <label className="text-xs font-medium text-gray-700">Provider</label>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => setSelectedProvider("gemini")}
            className={`px-3 py-2 rounded text-xs transition-all ${
              selectedProvider === "gemini"
                ? "bg-blue-500 text-white shadow-md"
                : "bg-white/40 text-gray-700 hover:bg-white/60"
            }`}
          >
            ☁️ Gemini
          </button>
          <button
            onClick={() => setSelectedProvider("ollama")}
            className={`px-3 py-2 rounded text-xs transition-all ${
              selectedProvider === "ollama"
                ? "bg-green-500 text-white shadow-md"
                : "bg-white/40 text-gray-700 hover:bg-white/60"
            }`}
          >
            🏠 Ollama
          </button>
          <button
            onClick={() => setSelectedProvider("nvidia")}
            className={`px-3 py-2 rounded text-xs transition-all ${
              selectedProvider === "nvidia"
                ? "bg-emerald-600 text-white shadow-md"
                : "bg-white/40 text-gray-700 hover:bg-white/60"
            }`}
          >
            🟢 NVIDIA
          </button>
        </div>
      </div>

      {selectedProvider === "gemini" && (
        <div className="space-y-2">
          <label className="text-xs font-medium text-gray-700">Gemini API Key (optional if already set)</label>
          <input
            type="password"
            placeholder="Enter API key to update..."
            value={geminiApiKey}
            onChange={(e) => setGeminiApiKey(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-white/40 border border-white/60 rounded focus:outline-none focus:ring-2 focus:ring-blue-400/60"
          />
        </div>
      )}

      {selectedProvider === "ollama" && (
        <div className="space-y-2">
          <div>
            <label className="text-xs font-medium text-gray-700">Ollama URL</label>
            <input
              type="url"
              value={ollamaUrl}
              onChange={(e) => setOllamaUrl(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white/40 border border-white/60 rounded focus:outline-none focus:ring-2 focus:ring-green-400/60"
            />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-gray-700">Model</label>
              <button
                onClick={loadOllamaModels}
                className="px-2 py-1 text-xs bg-white/60 hover:bg-white/80 rounded transition-all"
                title="Refresh models"
              >
                🔄
              </button>
            </div>

            {availableOllamaModels.length > 0 ? (
              <>
                <select
                  value={selectedOllamaModel}
                  onChange={(e) => setSelectedOllamaModel(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white/40 border border-white/60 rounded focus:outline-none focus:ring-2 focus:ring-green-400/60"
                >
                  {availableOllamaModels.map((model) => {
                    const capability = getModelCapabilities(model)
                    const tags = [
                      capability?.supportsVision ? "vision" : "",
                      capability?.supportsAudio ? "audio" : ""
                    ].filter(Boolean)

                    return (
                      <option key={model} value={model}>
                        {tags.length > 0 ? `${model} [${tags.join(", ")}]` : model}
                      </option>
                    )
                  })}
                </select>

                {selectedModelCapabilities && (
                  <div className="mt-2 text-xs text-gray-700 bg-white/40 p-2 rounded">
                    Selected capabilities: {selectedModelCapabilities.supportsVision ? "vision " : ""}
                    {selectedModelCapabilities.supportsAudio ? "audio" : ""}
                    {!selectedModelCapabilities.supportsVision && !selectedModelCapabilities.supportsAudio ? "text-only" : ""}
                  </div>
                )}

                {!hasVisionModel && (
                  <div className="mt-2 text-xs text-amber-800 bg-amber-100/70 p-2 rounded">
                    No vision-capable Ollama model detected. Install one with: <code>ollama pull llama3.2-vision:11b</code> or <code>ollama pull llava:7b</code>.
                  </div>
                )}

                {!hasAudioModel && (
                  <div className="mt-2 text-xs text-amber-800 bg-amber-100/70 p-2 rounded">
                    No audio-capable Ollama model detected. Try: <code>ollama pull qwen2-audio:7b</code> (if available in your Ollama build).
                  </div>
                )}
              </>
            ) : (
              <div className="text-xs text-gray-600 bg-yellow-100/60 p-2 rounded">
                No Ollama models found. Make sure Ollama is running and models are installed.
              </div>
            )}
          </div>
        </div>
      )}

      {selectedProvider === "nvidia" && (
        <div className="space-y-2">
          <div>
            <label className="text-xs font-medium text-gray-700">NVIDIA API Key</label>
            <input
              type="password"
              placeholder="Enter NVIDIA API key"
              value={nvidiaApiKey}
              onChange={(e) => setNvidiaApiKey(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white/40 border border-white/60 rounded focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-700">NVIDIA Model</label>
            <input
              type="text"
              value={nvidiaModel}
              onChange={(e) => setNvidiaModel(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white/40 border border-white/60 rounded focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-700">NVIDIA API URL</label>
            <input
              type="url"
              value={nvidiaUrl}
              onChange={(e) => setNvidiaUrl(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white/40 border border-white/60 rounded focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
            />
          </div>

          <div className="text-xs text-gray-700 bg-emerald-100/60 p-2 rounded">
            NVIDIA multimodal mode supports text chat, screenshot/image understanding, and audio transcription/analysis via the same model endpoint.
          </div>
        </div>
      )}

      <div className="space-y-2 border-t border-white/30 pt-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-gray-700">Screenshot Understanding</label>
          {screenshotModeStatus && <span className="text-[10px] text-gray-600">{screenshotModeStatus}</span>}
        </div>
        <select
          value={screenshotMode}
          onChange={(e) => handleScreenshotModeChange(e.target.value as ScreenshotUnderstandingMode)}
          className="w-full px-3 py-2 text-xs bg-white/40 border border-white/60 rounded focus:outline-none focus:ring-2 focus:ring-blue-400/60"
        >
          <option value="ocr">OCR (fast)</option>
          <option value="ocr-llm-filter">OCR + LLM cleanup (balanced)</option>
          <option value="multimodal">Multimodal image understanding (best quality)</option>
        </select>
        <div className="text-[11px] text-gray-600 bg-white/30 p-2 rounded">
          This mode controls how screenshot text is interpreted before solving.
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <button
          onClick={handleProviderSwitch}
          disabled={connectionStatus === "testing"}
          className="flex-1 px-3 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white text-xs rounded transition-all shadow-md"
        >
          {connectionStatus === "testing" ? "Switching..." : "Apply Changes"}
        </button>

        <button
          onClick={testConnection}
          disabled={connectionStatus === "testing"}
          className="px-3 py-2 bg-gray-500 hover:bg-gray-600 disabled:bg-gray-400 text-white text-xs rounded transition-all shadow-md"
        >
          Test
        </button>
      </div>

      <div className="text-xs text-gray-600 space-y-1">
        <div>
          <strong>Gemini:</strong> Fast cloud inference with Gemini API key
        </div>
        <div>
          <strong>Ollama:</strong> Local/private model runtime
        </div>
        <div>
          <strong>NVIDIA:</strong> Hosted multimodal model via NVIDIA API key
        </div>
      </div>
    </div>
  )
}

export default ModelSelector
