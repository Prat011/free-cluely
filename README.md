# [Sponsored by Recall AI - API for desktop recording](https://docs.recall.ai/docs/desktop-sdk?utm_source=github&utm_medium=sponsorship&utm_campaign=prat011-free-cluely)
If you’re looking for a hosted desktop recording API, consider checking out [Recall.ai](https://docs.recall.ai/docs/desktop-sdk?utm_source=github&utm_medium=sponsorship&utm_campaign=prat011-free-cluely), an API that records Zoom, Google Meet, Microsoft Teams, in-person meetings, and more.

# Cluely

[Cluely](https://cluely.com) - ミーティング、面接、プレゼン中にリアルタイムでAIサポートを提供する、透明デスクトップアシスタント。

デスクトップ録画APIをお探しなら [Recall.ai](https://www.recall.ai/product/desktop-recording-sdk?utm_source=github&utm_medium=sponsorship&utm_campaign=prat011-free-cluely) をチェック。Zoom、Google Meet、Microsoft Teams等の録画に対応。

## クイックスタート

### 前提条件

- Node.js（最新LTS）
- pnpm
- Git
- **いずれか**: Gemini / OpenAI / Claude APIキー **または** ローカルAI用の [Ollama](https://ollama.ai)

### インストール

```bash
git clone [repository-url]
cd free-cluely

# 通常のインストール
pnpm install

# Sharp/Pythonビルドエラーが出る場合
SHARP_IGNORE_GLOBAL_LIBVIPS=1 pnpm install --ignore-scripts
pnpm rebuild sharp
```

### 環境変数の設定

ルートに `.env` ファイルを作成。使いたいプロバイダのキーだけ設定すればOK:

```env
# Google Gemini（デフォルト）
GEMINI_API_KEY=your_gemini_api_key

# OpenAI（Whisper文字起こし含む）
OPENAI_API_KEY=your_openai_api_key

# Anthropic Claude
ANTHROPIC_API_KEY=your_claude_api_key

# Ollama（ローカルAI - APIキー不要）
USE_OLLAMA=true
OLLAMA_MODEL=llama3.2
OLLAMA_URL=http://localhost:11434
```

APIキーはアプリ内のModels設定画面からも入力可能（OS Keychainに暗号化保存）。

### 起動

```bash
# 開発モード（初回はこちら推奨）
pnpm start

# プロダクションビルド → release/ に出力
pnpm dist
```

## AIプロバイダ

4つのLLMプロバイダーに対応。アプリ内UIまたは`.env`でいつでも切替可能。

### Ollama（プライバシー重視ならこっち）

- データが外に出ない（100%ローカル処理）
- API費用ゼロ、オフライン動作可
- llama3.2, llama3.2-vision, codellama, mistral等に対応

```bash
# セットアップ
ollama pull llama3.2
```

### Google Gemini

- 最新のAI技術、最速レスポンス
- 音声分析・リアルタイム文字起こし対応（Live API）
- 要APIキー・インターネット接続

### OpenAI

- GPT-4o / GPT-5-mini 対応
- Whisper APIによる50+言語文字起こし
- 要APIキー

### Anthropic Claude

- Claude Sonnet 4.6 / Opus 4.6 / Haiku 4.5 対応
- 高精度なテキスト分析
- 要APIキー

## キーボードショートカット

| ショートカット | 動作 |
|---------------|------|
| `Cmd/Ctrl + Shift + Space` | ウィンドウ表示・中央に配置 |
| `Cmd/Ctrl + H` | スクリーンショット撮影 |
| `Cmd/Ctrl + Shift + H` | 画面領域キャプチャ（矩形選択） |
| `Cmd/Ctrl + Enter` | ソリューション取得 |
| `Cmd/Ctrl + B` | ウィンドウの表示/非表示切替 |
| `Cmd/Ctrl + R` | キュー全クリア |
| `Cmd/Ctrl + Shift + T` | クリックスルーモード切替 |
| `Cmd/Ctrl + 矢印キー` | ウィンドウ移動 |

## 主な機能

### 透明AIアシスタント
- 半透明・常に最前面のオーバーレイウィンドウ
- グローバルホットキーで即座に表示/非表示
- クリックスルーモード（`Cmd+Shift+T`）でウィンドウを透過
- マルチモニター対応（ディスプレイ間移動・スナップ配置）

### スクリーンショット分析
- `Cmd/Ctrl + H` で画面キャプチャ
- `Cmd/Ctrl + Shift + H` で画面領域を矩形選択してキャプチャ
- 画像・ドキュメント・プレゼン・コードをAIが即座に分析

### ミーティングインテリジェンス
- ミーティング開始/停止でセッション管理
- デュアルストリーム文字起こし（マイク + システム音声）
- Map-Reduceチャンク分割による長時間ミーティング要約
- アクションアイテム自動抽出（担当者・期限付き）
- ミーティング履歴の検索・エクスポート（Markdown / JSON / クリップボード）

### リアルタイムコーチング
- Playbookベースのコーチング（ビルトイン6種 + カスタム作成）
- 10秒クールダウン付きのライブアドバイス
- クイック回答提案（質問検出 → 2-3個の回答候補）

### 多言語文字起こし
- OpenAI Whisper API対応（50+言語、自動言語検出）
- Gemini Live APIによるリアルタイム文字起こし

### カレンダー連携
- ICSフィード読み込み
- イベントタイトルからPlaybook自動選択
- 5分前通知対応のイベント検出

### コンテキストチャット
- 画面上のコンテンツについてAIとチャット
- 会話履歴の永続化（直近50メッセージ）

### Webhook連携
- ミーティング終了時にJSON POSTで外部通知
- Slack / Zapier / n8n等と連携可能

### プライバシーファースト
- Ollamaで100%ローカル処理が可能
- APIキーはOS Keychain（safeStorage）で暗号化保存
- スクリーンショットは処理後に自動削除

### クロスプラットフォーム
- **macOS**: ネイティブウィンドウ管理
- **Windows 10/11**: フルサポート
- **Ubuntu/Linux**: 主要ディストリビューション対応

## ユースケース

**学習・アカデミック**
- プレゼン中のリアルタイムサポート
- 翻訳・解説
- 数学・理科の問題解決

**ビジネス**
- 営業コール中の対応支援
- 技術面接のコーチング
- クライアントプレゼンのサポート

**開発**
- エラーメッセージの即座デバッグ
- コード解説・最適化
- アルゴリズム・設計ガイダンス

## 他サービスとの比較

| 項目 | Free Cluely | Cluely | Pluely | Granola |
|------|-------------|--------|--------|---------|
| 費用 | **無料OSS** | $20-75/mo | 無料OSS | $18/mo |
| LLM | **Gemini/OpenAI/Claude/Ollama** | GPT-4o+Claude | マルチ | GPT-4o+Claude |
| ローカルAI | **Ollama Vision対応** | なし | Ollama | なし |
| リアルタイム要約 | **対応 + アクション抽出** | 対応 | 非対応 | Post-call |
| コーチング | **Playbook + AI提案** | テンプレート | 非対応 | 非対応 |
| APIキー管理 | **OS Keychain暗号化** | 自社サーバー | BYOK | 自社サーバー |

## 対応AIモデル

- **Gemini 2.5 Flash / Pro** - Google最新AI（画像・音声・リアルタイム文字起こし対応）
- **GPT-4o / GPT-5-mini** - OpenAI（Whisper文字起こし対応）
- **Claude Sonnet 4.6 / Opus 4.6 / Haiku 4.5** - Anthropic
- **Llama 3.2 / Llama 3.2 Vision** - Meta製ローカルモデル（Ollama経由）
- **カスタムモデル** - Ollama互換モデル全般（qwen3, codellama, mistral等）

## システム要件

| レベル | スペック |
|--------|---------|
| 最小 | 4GB RAM, デュアルコアCPU, 2GB ストレージ |
| 推奨 | 8GB+ RAM, クアッドコアCPU, 5GB+ ストレージ |
| ローカルAI推奨 | 16GB+ RAM |

## トラブルシューティング

### Sharp/Pythonビルドエラー

```bash
rm -rf node_modules pnpm-lock.yaml
SHARP_IGNORE_GLOBAL_LIBVIPS=1 pnpm install --ignore-scripts
pnpm rebuild sharp
```

### アプリが起動しない

```bash
# ポート5180を使用しているプロセスを確認
lsof -i :5180
kill [PID]
```

Ollamaユーザーは `ollama serve` が起動していることを確認。

### アプリの終了

- `Cmd + Q`（Mac）/ `Ctrl + Q`（Windows/Linux）で終了
- またはActivity Monitor / タスクマネージャーから `Interview Coder` を終了
- Xボタンは現在動作しない（既知の問題）

### その他

1. `node_modules` と `pnpm-lock.yaml` を削除
2. `pnpm install` を再実行
3. `pnpm start` で起動

## コントリビュート

PRを歓迎します！

- バグ修正・安定性向上
- 新機能・AIモデル連携
- ドキュメント改善
- 翻訳・i18n対応
- UI/UX改善

商用連携・カスタム開発については [Twitter](https://x.com/prathitjoshi_) まで。

## ライセンス

ISC License - 個人利用・商用利用ともに無料。

---

`ai-assistant` `meeting-notes` `interview-helper` `presentation-support` `ollama` `gemini-ai` `electron-app` `cross-platform` `privacy-focused` `open-source` `local-ai` `screenshot-analysis`
