# Free Cluely

透明オーバーレイ型のデスクトップAIアシスタント（Electron + React + TypeScript）

## アーキテクチャ

```
electron/                  → Electronメインプロセス（Node.js）
  main.ts                  → AppState シングルトン（エントリーポイント）
  ipcHandlers.ts           → IPC通信ハンドラ（全API集約）
  shortcuts.ts             → グローバルショートカット
  WindowHelper.ts          → 透明ウィンドウ管理・クリックスルー・マルチモニター
  ScreenshotHelper.ts      → スクリーンショット撮影
  RegionSelectHelper.ts    → 画面領域選択（フルスクリーンオーバーレイ）
  RegionCropHelper.ts      → Sharp画像クロップ
  ProcessingHelper.ts      → スクリーンショット・音声の処理オーケストレーション
  LLMHelper.ts             → AI連携ファサード（レガシー互換）
  llm/                     → LLMプロバイダー抽象化レイヤー
    types.ts               → LLMProvider / ModelInfo インターフェース
    ProviderRegistry.ts    → プロバイダー管理・切替・自動フォールバック
    GeminiProvider.ts      → Google Gemini（@google/genai）
    OpenAIProvider.ts      → OpenAI（openai SDK）
    ClaudeProvider.ts      → Anthropic Claude（@anthropic-ai/sdk）
    OllamaProvider.ts      → Ollama（REST API）
  SettingsHelper.ts        → 設定永続化（JSON + safeStorage暗号化）
  StorageHelper.ts         → ミーティングデータ永続化
  MeetingHelper.ts         → ミーティングセッション管理 + Map-Reduceチャンク分割要約
  PlaybookHelper.ts        → Playbook管理（ビルトイン6種 + カスタム）
  CoachingHelper.ts        → リアルタイムAIコーチング
  ConversationHelper.ts    → チャット履歴永続化（50メッセージ上限）
  ExportHelper.ts          → ミーティングエクスポート（Markdown / JSON / クリップボード）
  WebhookHelper.ts         → Webhook連携（meeting.ended イベント POST）
  CalendarHelper.ts        → カレンダー連携（ICSパース・Playbook自動選択）
  WhisperTranscriptionHelper.ts → OpenAI Whisper多言語文字起こし（50+言語）
  LiveTranscriptionHelper.ts    → Gemini Live APIリアルタイム文字起こし
  prompts/                 → AIプロンプトテンプレート
    meeting-prompts.ts     → 要約・アクション抽出・コーチング用プロンプト

src/                       → Reactレンダラープロセス
  _pages/                  → ページコンポーネント（Queue, Solutions）
  components/              → UIコンポーネント
    Queue/                 → QueueCommands等
    Solutions/             → ソリューション表示
    ui/                    → 共通UI（ModelSelector, MeetingPanel, PlaybookSelector等）
  hooks/                   → カスタムフック（useMeeting, useSpeechRecognition等）
  types/                   → TypeScript型定義（electron.d.ts, global.d.ts）
  lib/                     → ユーティリティ
```

## テックスタック

- **Runtime**: Electron 40 + Node.js
- **Frontend**: React 18 + TypeScript 5.6 + Vite 5
- **Styling**: TailwindCSS 3 + Radix UI
- **AI**: Gemini (`@google/genai` v1.42), OpenAI (`openai` v6.23), Claude (`@anthropic-ai/sdk` v0.78), Ollama（ローカル）
- **画像処理**: Sharp + screenshot-desktop
- **テスト**: Vitest（184テスト、TDD）

## コマンド

| コマンド | 説明 |
|---------|------|
| `pnpm start` | 開発モード起動（Vite + Electron） |
| `pnpm dev` | Vite devサーバーのみ（port 5180） |
| `pnpm build` | プロダクションビルド |
| `pnpm dist` | Electronパッケージング（release/） |
| `pnpm clean` | dist, dist-electron削除 |
| `pnpm test` | テスト実行（watchモード） |
| `pnpm test:run` | テスト実行（単発） |

## コーディング規約

- **PascalCase**: クラス、Reactコンポーネント
- **camelCase**: 関数、変数
- **SCREAMING_SNAKE_CASE**: 定数（PROCESSING_EVENTS等）
- Helperクラスはモジュール単位で分離（1クラス1ファイル）
- LLMプロバイダーは `electron/llm/` のProviderRegistryパターンで管理
- IPC通信はipcHandlers.tsに集約
- UIはTailwindユーティリティクラス + Radix UIプリミティブ

## 重要な注意事項

- `.env`にAPIキー（GEMINI_API_KEY等）→ **絶対にコミットしない**
- APIキーはSettingsHelper経由で`safeStorage`暗号化保存も可能
- `renderer/`は旧コード（未使用）→触らない
- tsconfig: `tsconfig.json`（React/Vite用）と `electron/tsconfig.json`（Electron用）は別
- テスト: Vitest（TDDで開発。詳細は `.claude/rules/tdd.md`）
