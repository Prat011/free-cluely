import React, { useState, useEffect } from 'react';

const DEFAULT_GROQ_MODEL = "qwen/qwen3-coder";
const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash-lite";

interface ModelConfig {
  provider: "ollama" | "gemini" | "groq";
  model: string;
  isOllama: boolean;
}

interface ModelSelectorProps {
  onModelChange?: (provider: "ollama" | "gemini" | "groq", model: string) => void;
  onChatOpen?: () => void;
}

const ModelSelector: React.FC<ModelSelectorProps> = ({ onModelChange, onChatOpen }) => {
  const [currentConfig, setCurrentConfig] = useState<ModelConfig | null>(null);
  const [availableOllamaModels, setAvailableOllamaModels] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<'testing' | 'success' | 'error' | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [groqApiKey, setGroqApiKey] = useState('');
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<"ollama" | "gemini" | "groq">("groq");
  const [selectedOllamaModel, setSelectedOllamaModel] = useState<string>("");
  const [ollamaUrl, setOllamaUrl] = useState<string>("http://localhost:11434");

  useEffect(() => {
    loadCurrentConfig();
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
      } else if (selectedProvider === 'groq') {
        result = await window.electronAPI.switchToGroq(groqApiKey || undefined);
      } else {
        result = await window.electronAPI.switchToGemini(geminiApiKey || undefined);
      }

      if (result.success) {
        await loadCurrentConfig();
        setConnectionStatus('success');
        onModelChange?.(
          selectedProvider,
          selectedProvider === 'ollama'
            ? selectedOllamaModel
            : selectedProvider === 'groq'
              ? DEFAULT_GROQ_MODEL
              : DEFAULT_GEMINI_MODEL
        );
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
    <div className="w-full min-w-0 p-3 sm:p-4 bg-white/20 backdrop-blur-md rounded-lg border border-white/30 space-y-4 overflow-x-hidden">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-sm font-semibold text-gray-800">AI Model Selection</h3>
        <div className={`text-xs break-words ${getStatusColor()}`}>
          {getStatusText()}
        </div>
      </div>

      {/* Current Status */}
      {currentConfig && (
        <div className="text-xs text-gray-600 bg-white/40 p-2 rounded break-words">
          Current: {currentConfig.provider === 'ollama' ? '🏠' : currentConfig.provider === 'groq' ? '⚡' : '☁️'} {currentConfig.model}
        </div>
      )}

      {/* Provider Selection */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-gray-700">Provider</label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <button
            onClick={() => setSelectedProvider('groq')}
            className={`min-w-0 px-3 py-2 rounded text-xs transition-all ${
              selectedProvider === 'groq'
                ? 'bg-blue-500 text-white shadow-md'
                : 'bg-white/40 text-gray-700 hover:bg-white/60'
            }`}
          >
            ⚡ Groq (Primary)
          </button>
          <button
            onClick={() => setSelectedProvider('gemini')}
            className={`min-w-0 px-3 py-2 rounded text-xs transition-all ${
              selectedProvider === 'gemini'
                ? 'bg-indigo-500 text-white shadow-md'
                : 'bg-white/40 text-gray-700 hover:bg-white/60'
            }`}
          >
            ☁️ Gemini (Fallback)
          </button>
          <button
            onClick={() => setSelectedProvider('ollama')}
            className={`min-w-0 px-3 py-2 rounded text-xs transition-all ${
              selectedProvider === 'ollama'
                ? 'bg-green-500 text-white shadow-md'
                : 'bg-white/40 text-gray-700 hover:bg-white/60'
            }`}
          >
            🏠 Ollama (Local)
          </button>
        </div>
      </div>

      {/* Provider-specific settings */}
      {selectedProvider === 'groq' ? (
        <div className="space-y-2">
          <label className="text-xs font-medium text-gray-700">Groq API Key (optional if already set)</label>
          <input
            type="password"
            placeholder="Enter Groq key to update..."
            value={groqApiKey}
            onChange={(e) => setGroqApiKey(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-white/40 border border-white/60 rounded focus:outline-none focus:ring-2 focus:ring-blue-400/60"
          />
          <div className="text-xs text-gray-600 bg-blue-100/60 p-2 rounded break-words">
            Default model: {DEFAULT_GROQ_MODEL}
          </div>
        </div>
      ) : selectedProvider === 'gemini' ? (
        <div className="space-y-2">
          <label className="text-xs font-medium text-gray-700">Gemini API Key (optional if already set)</label>
          <input
            type="password"
            placeholder="Enter API key to update..."
            value={geminiApiKey}
            onChange={(e) => setGeminiApiKey(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-white/40 border border-white/60 rounded focus:outline-none focus:ring-2 focus:ring-blue-400/60"
          />
          <div className="text-xs text-gray-600 bg-indigo-100/60 p-2 rounded break-words">
            Default model: {DEFAULT_GEMINI_MODEL}
          </div>
        </div>
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
              <div className="text-xs text-gray-600 bg-yellow-100/60 p-2 rounded break-words">
                No Ollama models found. Make sure Ollama is running and models are installed.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-col sm:flex-row gap-2 pt-2">
        <button
          onClick={handleProviderSwitch}
          disabled={connectionStatus === 'testing'}
          className="flex-1 min-w-0 px-3 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white text-xs rounded transition-all shadow-md"
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
        <div>💡 <strong>Groq:</strong> Fast, low-latency, primary cloud provider</div>
        <div>💡 <strong>Gemini:</strong> Cloud fallback for model coverage and multimodal support</div>
        <div>💡 <strong>Ollama:</strong> Private, local, requires Ollama installation</div>
      </div>
    </div>
  );
};

export default ModelSelector;