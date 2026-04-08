# セキュリティルール

- `.env`ファイルは絶対にgit add/commitしない
- APIキー・シークレットをソースコードにハードコードしない
- `process.env`経由でのみ環境変数を参照
- APIキーの永続化は`SettingsHelper.setApiKey()`経由で`safeStorage`暗号化（macOS Keychain / Windows DPAPI / Linux Secret Service）
- Electronの`nodeIntegration`は無効。preloadスクリプト（`contextBridge`）でのみNode APIを公開
- `contentProtection: true`を維持（画面録画対策）
- Webhook URLのバリデーション: ユーザー入力URLへのHTTP POSTのみ。内部ネットワーク宛も許可（ユーザー責任）
