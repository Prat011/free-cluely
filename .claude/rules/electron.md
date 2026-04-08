---
globs: "electron/**"
---
# Electron メインプロセスルール

- AppStateはシングルトン。`AppState.getInstance()`で取得
- Helper間の依存はAppState経由で注入（コンストラクタにthisを渡す）
- IPC通信は`ipcHandlers.ts`に集約。散在させない
- `electron/tsconfig.json`でコンパイル（tsconfig.jsonとは別）
- グローバルショートカットは`shortcuts.ts`で一元管理
- LLMプロバイダーは`electron/llm/`のProviderRegistryパターンで管理（Gemini/OpenAI/Claude/Ollama）
- プロバイダー追加時は`LLMProvider`インターフェース（`llm/types.ts`）を実装し、ProviderRegistryに登録
- APIキーは`SettingsHelper`経由で`safeStorage`暗号化保存
- ミーティングデータは`StorageHelper`経由でJSON永続化（`{userData}/meetings/`）
- プロンプトテンプレートは`electron/prompts/`に集約
