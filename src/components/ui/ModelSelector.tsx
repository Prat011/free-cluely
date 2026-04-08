import React, { useState, useEffect } from 'react';

interface ModelConfig {
  provider: "ollama" | "gemini";
  model: string;
  isOllama: boolean;
}

interface ModelSelectorProps {
  onModelChange?: (provider: "ollama" | "gemini", model: string) => void;
  onChatOpen?: () => void;
}

const ModelSelector: React.FC<ModelSelectorProps> = ({ onModelChange, onChatOpen }) => {
  const [currentConfig, setCurrentConfig] = useState<ModelConfig | null>(null);
  const [availableOllamaModels, setAvailableOllamaModels] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<'testing' | 'success' | 'error' | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<"ollama" | "gemini">("gemini");
  const [selectedOllamaModel, setSelectedOllamaModel] = useState<string>("");
  const [ollamaUrl, setOllamaUrl] = useState<string>("http://localhost:11434");
  const [userInfo, setUserInfo] = useState<string>("");
  const [deepgramApiKey, setDeepgramApiKey] = useState("");
  const [targetLanguage, setTargetLanguage] = useState("");
  const [selectedGeminiModel, setSelectedGeminiModel] = useState("gemini-2.5-flash");

  const GEMINI_MODELS = [
    { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash", desc: "5 RPM · 20 RPD" },
    { value: "gemini-3-flash", label: "Gemini 3 Flash", desc: "5 RPM · 20 RPD" },
    { value: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite", desc: "10 RPM · 20 RPD" },
  ];

  const TRANSLATION_LANGUAGES = [
    { value: "", label: "None (English only)" },
    { value: "en", label: "Translate to English" },
    { value: "fr", label: "Translate to French" },
    { value: "es", label: "Translate to Spanish" },
    { value: "de", label: "Translate to German" },
    { value: "it", label: "Translate to Italian" },
    { value: "ja", label: "Translate to Japanese" },
    { value: "ko", label: "Translate to Korean" },
    { value: "zh", label: "Translate to Chinese" },
  ];

  useEffect(() => {
    loadCurrentConfig();
    const storedUserInfo = localStorage.getItem("about_you_context") || "";
    setUserInfo(storedUserInfo);
    const storedDeepgramKey = localStorage.getItem("deepgram_api_key") || "";
    setDeepgramApiKey(storedDeepgramKey);
    const storedLang = localStorage.getItem("translation_target_lang") || "";
    setTargetLanguage(storedLang);
    const storedModel = localStorage.getItem("gemini_model_name") || "gemini-2.5-flash";
    setSelectedGeminiModel(storedModel);
  }, []);

  const loadCurrentConfig = async () => {
    try {
      setIsLoading(true);
      const config = await window.electronAPI.getCurrentLlmConfig();
      setCurrentConfig(config);
      setSelectedProvider(config.provider);

      if (config.isOllama) {
        setSelectedOllamaModel(config.model);
        await loadOllamaModels();
      }
    } catch (error) {
      console.error('Error loading current config:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadOllamaModels = async () => {
    try {
      const models = await window.electronAPI.getAvailableOllamaModels();
      setAvailableOllamaModels(models);

      // Auto-select first model if none selected
      if (models.length > 0 && !selectedOllamaModel) {
        setSelectedOllamaModel(models[0]);
      }
    } catch (error) {
      console.error('Error loading Ollama models:', error);
      setAvailableOllamaModels([]);
    }
  };

  const testConnection = async () => {
    try {
      setConnectionStatus('testing');
      const result = await window.electronAPI.testLlmConnection();
      setConnectionStatus(result.success ? 'success' : 'error');
      if (!result.success) {
        setErrorMessage(result.error || 'Unknown error');
      }
    } catch (error) {
      setConnectionStatus('error');
      setErrorMessage(String(error));
    }
  };

  const handleProviderSwitch = async () => {
    try {
      setConnectionStatus('testing');
      let result;

      if (selectedProvider === 'ollama') {
        result = await window.electronAPI.switchToOllama(selectedOllamaModel, ollamaUrl);
      } else {
        result = await window.electronAPI.switchToGemini(geminiApiKey || undefined, selectedGeminiModel);
      }

      if (result.success) {
        localStorage.setItem("about_you_context", userInfo);
        localStorage.setItem("deepgram_api_key", deepgramApiKey);
        localStorage.setItem("translation_target_lang", targetLanguage);
        localStorage.setItem("gemini_model_name", selectedGeminiModel);
        await window.electronAPI.invoke("update-user-info", userInfo);
        await loadCurrentConfig();
        setConnectionStatus('success');
        onModelChange?.(selectedProvider, selectedProvider === 'ollama' ? selectedOllamaModel : selectedGeminiModel);
        // Auto-open chat window after successful model change
        setTimeout(() => {
          onChatOpen?.();
        }, 500);
      } else {
        setConnectionStatus('error');
        setErrorMessage(result.error || 'Switch failed');
      }
    } catch (error) {
      setConnectionStatus('error');
      setErrorMessage(String(error));
    }
  };

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'testing': return 'text-yellow-600';
      case 'success': return 'text-green-600';
      case 'error': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusText = () => {
    switch (connectionStatus) {
      case 'testing': return 'Testing connection...';
      case 'success': return 'Connected successfully';
      case 'error': return `Error: ${errorMessage}`;
      default: return 'Ready';
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 bg-white/20 backdrop-blur-md rounded-lg border border-white/30">
        <div className="animate-pulse text-sm text-gray-600">Loading model configuration...</div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-white/20 backdrop-blur-md rounded-lg border border-white/30 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-800">AI Model Selection</h3>
        <div className={`text-xs ${getStatusColor()}`}>
          {getStatusText()}
        </div>
      </div>

      {/* Current Status */}
      {currentConfig && (
        <div className="text-xs text-gray-600 bg-white/40 p-2 rounded">
          Current: {currentConfig.provider === 'ollama' ? '🏠' : '☁️'} {currentConfig.model}
        </div>
      )}

      {/* Provider Selection */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-gray-700">Provider</label>
        <div className="flex gap-2">
          <button
            onClick={() => setSelectedProvider('gemini')}
            className={`flex-1 px-3 py-2 rounded text-xs transition-all ${selectedProvider === 'gemini'
              ? 'bg-blue-500 text-white shadow-md'
              : 'bg-white/40 text-gray-700 hover:bg-white/60'
              }`}
          >
            ☁️ Gemini (Cloud)
          </button>
          <button
            onClick={() => setSelectedProvider('ollama')}
            className={`flex-1 px-3 py-2 rounded text-xs transition-all ${selectedProvider === 'ollama'
              ? 'bg-green-500 text-white shadow-md'
              : 'bg-white/40 text-gray-700 hover:bg-white/60'
              }`}
          >
            🏠 Ollama (Local)
          </button>
        </div>
      </div>

      {/* Provider-specific settings */}
      {selectedProvider === 'gemini' ? (
        <>
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

          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-700">Gemini Model</label>
            <select
              value={selectedGeminiModel}
              onChange={(e) => setSelectedGeminiModel(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white/40 border border-white/60 rounded focus:outline-none focus:ring-2 focus:ring-blue-400/60"
            >
              {GEMINI_MODELS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label} — {m.desc}
                </option>
              ))}
            </select>
          </div>
        </>
      ) : (
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
              <select
                value={selectedOllamaModel}
                onChange={(e) => setSelectedOllamaModel(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white/40 border border-white/60 rounded focus:outline-none focus:ring-2 focus:ring-green-400/60"
              >
                {availableOllamaModels.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
            ) : (
              <div className="text-xs text-gray-600 bg-yellow-100/60 p-2 rounded">
                No Ollama models found. Make sure Ollama is running and models are installed.
              </div>
            )}
          </div>
        </div>
      )}

      {/* User Context */}
      <div className="space-y-2 mt-4 pt-4 border-t border-white/20">
        <label className="text-xs font-medium text-gray-700">About You (Given to AI for context)</label>
        <textarea
          placeholder="I am a Senior Staff Frontend Engineer using React and TypeScript..."
          value={userInfo}
          onChange={(e) => setUserInfo(e.target.value)}
          className="w-full px-3 py-2 text-xs bg-white/40 border border-white/60 rounded focus:outline-none focus:ring-2 focus:ring-blue-400/60 min-h-[60px] resize-y"
        />
      </div>

      {/* Deepgram STT Settings */}
      <div className="space-y-4 mt-4 pt-4 border-t border-white/20">
        <h3 className="text-sm font-semibold text-gray-800">Live Voice Settings (Deepgram)</h3>

        <div className="space-y-2">
          <label className="text-xs font-medium text-gray-700">Deepgram API Key</label>
          <input
            type="password"
            placeholder="Enter Deepgram API Key..."
            value={deepgramApiKey}
            onChange={(e) => setDeepgramApiKey(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-white/40 border border-white/60 rounded focus:outline-none focus:ring-2 focus:ring-blue-400/60"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-gray-700">Live Translation Target</label>
          <select
            value={targetLanguage}
            onChange={(e) => setTargetLanguage(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-white/40 border border-white/60 rounded focus:outline-none focus:ring-2 focus:ring-blue-400/60"
          >
            {TRANSLATION_LANGUAGES.map((lang) => (
              <option key={lang.value} value={lang.value}>
                {lang.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 pt-2">
        <button
          onClick={handleProviderSwitch}
          disabled={connectionStatus === 'testing'}
          className="flex-1 px-3 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white text-xs rounded transition-all shadow-md"
        >
          {connectionStatus === 'testing' ? 'Switching...' : 'Apply Changes'}
        </button>

        <button
          onClick={testConnection}
          disabled={connectionStatus === 'testing'}
          className="px-3 py-2 bg-gray-500 hover:bg-gray-600 disabled:bg-gray-400 text-white text-xs rounded transition-all shadow-md"
        >
          Test
        </button>
      </div>

      {/* Help text */}
      <div className="text-xs text-gray-600 space-y-1">
        <div>💡 <strong>Gemini:</strong> Fast, cloud-based, requires API key</div>
        <div>💡 <strong>Ollama:</strong> Private, local, requires Ollama installation</div>
      </div>
    </div>
  );
};

export default ModelSelector;