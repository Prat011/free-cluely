import React, { useState, useEffect } from 'react';

interface ProviderInfo {
  id: string;
  name: string;
  supportsVision: boolean;
  supportsAudio: boolean;
}

interface ModelSelectorProps {
  onModelChange?: (provider: string, model: string) => void;
  onChatOpen?: () => void;
}

const PROVIDER_ICONS: Record<string, string> = {
  gemini: '✦',
  openai: '◆',
  claude: '◈',
  ollama: '⌂',
};

const ModelSelector: React.FC<ModelSelectorProps> = ({ onModelChange, onChatOpen }) => {
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [activeProvider, setActiveProvider] = useState<string>('gemini');
  const [selectedProvider, setSelectedProvider] = useState<string>('gemini');
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // API key inputs
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434');
  const [ollamaModel, setOllamaModel] = useState('');
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [providerList, config, settings] = await Promise.all([
        window.electronAPI.getAvailableProviders(),
        window.electronAPI.getCurrentLlmConfig(),
        window.electronAPI.getSettings(),
      ]);
      setProviders(providerList);
      setActiveProvider(settings.activeProvider || config.provider);
      setSelectedProvider(settings.activeProvider || config.provider);

      if (config.isOllama) {
        const models = await window.electronAPI.getAvailableOllamaModels();
        setOllamaModels(models);
        setOllamaModel(config.model);
      }
    } catch (error) {
      console.error('Error loading config:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadOllamaModels = async () => {
    try {
      const models = await window.electronAPI.getAvailableOllamaModels();
      setOllamaModels(models);
      if (models.length > 0 && !ollamaModel) setOllamaModel(models[0]);
    } catch {
      setOllamaModels([]);
    }
  };

  const handleApply = async () => {
    setConnectionStatus('testing');
    setErrorMessage('');

    try {
      const config: Record<string, string> = {};
      if (selectedProvider === 'ollama') {
        Object.assign(config, { url: ollamaUrl, model: ollamaModel });
      } else {
        const key = apiKeys[selectedProvider];
        if (key) config.apiKey = key;
      }

      const result = await window.electronAPI.setActiveProvider(selectedProvider, config);

      if (result.success) {
        setActiveProvider(selectedProvider);
        setConnectionStatus('success');
        onModelChange?.(selectedProvider, selectedProvider === 'ollama' ? ollamaModel : selectedProvider);
        setTimeout(() => onChatOpen?.(), 500);
      } else {
        setConnectionStatus('error');
        setErrorMessage(result.error || 'Failed to switch provider');
      }
    } catch (error) {
      setConnectionStatus('error');
      setErrorMessage(String(error));
    }
  };

  const handleTest = async () => {
    setConnectionStatus('testing');
    try {
      const result = await window.electronAPI.testProviderConnection();
      setConnectionStatus(result.success ? 'success' : 'error');
      if (!result.success) setErrorMessage(result.error || 'Unknown error');
    } catch (error) {
      setConnectionStatus('error');
      setErrorMessage(String(error));
    }
  };

  const statusColor = connectionStatus === 'testing' ? 'text-yellow-500'
    : connectionStatus === 'success' ? 'text-green-500'
    : connectionStatus === 'error' ? 'text-red-500'
    : 'text-gray-500';

  const statusText = connectionStatus === 'testing' ? 'Testing...'
    : connectionStatus === 'success' ? 'Connected'
    : connectionStatus === 'error' ? `Error: ${errorMessage}`
    : 'Ready';

  if (isLoading) {
    return (
      <div className="p-4 bg-black/40 backdrop-blur-md rounded-lg border border-white/15">
        <div className="animate-pulse text-sm text-gray-300">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-black/40 backdrop-blur-md rounded-lg border border-white/15 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-200">AI Provider</h3>
        <span className={`text-xs ${statusColor}`}>{statusText}</span>
      </div>

      {/* Active provider badge */}
      <div className="text-xs text-gray-400 bg-black/30 p-2 rounded flex items-center gap-1.5">
        <span>{PROVIDER_ICONS[activeProvider] || '?'}</span>
        <span>Active: {providers.find(p => p.id === activeProvider)?.name || activeProvider}</span>
      </div>

      {/* Provider cards */}
      <div className="grid grid-cols-2 gap-2">
        {providers.map((p) => (
          <button
            key={p.id}
            onClick={() => {
              setSelectedProvider(p.id);
              if (p.id === 'ollama') loadOllamaModels();
            }}
            className={`px-3 py-2 rounded text-xs transition-all text-left ${
              selectedProvider === p.id
                ? 'bg-blue-600 text-white shadow-md ring-1 ring-blue-400'
                : 'bg-black/30 text-gray-300 hover:bg-black/50'
            }`}
          >
            <div className="font-medium">{PROVIDER_ICONS[p.id]} {p.name}</div>
            <div className="flex gap-1 mt-1">
              {p.supportsVision && <span className="text-[10px] bg-white/10 px-1 rounded">Vision</span>}
              {p.supportsAudio && <span className="text-[10px] bg-white/10 px-1 rounded">Audio</span>}
            </div>
          </button>
        ))}
      </div>

      {/* Provider config */}
      {selectedProvider === 'ollama' ? (
        <div className="space-y-2">
          <div>
            <label className="text-xs font-medium text-gray-300">Ollama URL</label>
            <input
              type="url"
              value={ollamaUrl}
              onChange={(e) => setOllamaUrl(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-black/30 border border-white/15 rounded text-gray-200 focus:outline-none focus:ring-2 focus:ring-green-400/60"
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-gray-300">Model</label>
              <button
                onClick={loadOllamaModels}
                className="px-1.5 py-0.5 text-[10px] bg-black/30 hover:bg-black/50 text-gray-300 rounded"
                title="Refresh"
              >
                Refresh
              </button>
            </div>
            {ollamaModels.length > 0 ? (
              <select
                value={ollamaModel}
                onChange={(e) => setOllamaModel(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-black/30 border border-white/15 rounded text-gray-200 focus:outline-none focus:ring-2 focus:ring-green-400/60"
              >
                {ollamaModels.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            ) : (
              <div className="text-xs text-yellow-300 bg-yellow-900/30 p-2 rounded">
                No models found. Make sure Ollama is running.
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <label className="text-xs font-medium text-gray-300">
            {providers.find(p => p.id === selectedProvider)?.name} API Key
          </label>
          <input
            type="password"
            placeholder="Enter API key..."
            value={apiKeys[selectedProvider] || ''}
            onChange={(e) => setApiKeys(prev => ({ ...prev, [selectedProvider]: e.target.value }))}
            className="w-full px-3 py-2 text-xs bg-black/30 border border-white/15 rounded text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-400/60"
          />
          <div className="text-[10px] text-gray-500">
            {selectedProvider === 'gemini' && 'Leave empty to use env GEMINI_API_KEY'}
            {selectedProvider === 'openai' && 'Get key at platform.openai.com'}
            {selectedProvider === 'claude' && 'Get key at console.anthropic.com'}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        <button
          onClick={handleApply}
          disabled={connectionStatus === 'testing'}
          className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white text-xs rounded transition-all shadow-md"
        >
          {connectionStatus === 'testing' ? 'Switching...' : 'Apply'}
        </button>
        <button
          onClick={handleTest}
          disabled={connectionStatus === 'testing'}
          className="px-3 py-2 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-700 text-white text-xs rounded transition-all shadow-md"
        >
          Test
        </button>
      </div>

      {/* Speech Recognition Language */}
      <div className="space-y-2 pt-2 border-t border-white/10">
        <label className="text-xs font-medium text-gray-300">Speech Recognition Language</label>
        <select
          defaultValue={localStorage.getItem('speechRecognitionLang') || navigator.language || 'en-US'}
          onChange={(e) => localStorage.setItem('speechRecognitionLang', e.target.value)}
          className="w-full px-3 py-2 text-xs bg-black/30 border border-white/15 rounded text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400/60"
        >
          <option value="ja-JP">日本語</option>
          <option value="en-US">English (US)</option>
          <option value="en-GB">English (UK)</option>
          <option value="zh-CN">中文 (简体)</option>
          <option value="zh-TW">中文 (繁體)</option>
          <option value="ko-KR">한국어</option>
          <option value="es-ES">Español</option>
          <option value="fr-FR">Français</option>
          <option value="de-DE">Deutsch</option>
          <option value="pt-BR">Português (BR)</option>
        </select>
      </div>
    </div>
  );
};

export default ModelSelector;
