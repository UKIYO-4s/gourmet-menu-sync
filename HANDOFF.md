# セルフヒーリングセレクタシステム - 引き継ぎドキュメント

## 概要

Webサイトのセレクタ変更に自動対応する「セルフヒーリング」システムを実装。
差分エラーが出ても止まらずに最後まで作業を実行して完遂するシステム。

## アーキテクチャ

```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────┐
│ Chrome Extension │────▶│ Cloudflare Workers   │────▶│ Workers KV  │
│ (popup.js)       │     │ (セレクタ検証/修復)   │     │ (セレクタDB) │
└─────────────────┘     └──────────────────────┘     └─────────────┘
        │                         │
        │                         ▼
        │                 ┌──────────────────┐
        │                 │ Workers AI       │
        │                 │ (Llama 3 8B)     │
        │                 └──────────────────┘
        ▼
┌─────────────────┐
│ Content Script  │
│ (command-executor.js)
└─────────────────┘
```

## 主要ファイル

### Workers (Cloudflare)
- `workers/src/index.ts` - メインAPI
  - `/validate` - セレクタ検証 + 自動修復
  - `/selectors` - セレクタ取得/更新
  - `/health` - ヘルスチェック

### Chrome Extension
- `extension/popup/popup.js` - ポップアップUI + テスト実行
- `extension/content/command-executor.js` - DOM操作実行
- `extension/background/background.js` - Service Worker

## セルフヒーリングフロー

```
1. セレクタ検証 (Logic Check)
   ├─ MATCH: セレクタが見つかった → そのまま使用
   ├─ PARTIAL: alternativesで見つかった → alternativeを使用
   └─ MISMATCH: 見つからない → 修復フェーズへ

2. AI修復試行
   ├─ 成功: 新セレクタをKVに保存
   └─ 失敗: ベストエフォートへ

3. ベストエフォートフォールバック
   ├─ 汎用セレクタで検索 (input[name="q"], input[type="search"], etc.)
   ├─ DOMで動作確認
   └─ 動作したセレクタをKVに保存

4. コマンド実行
   └─ fill_form → press_key (Enter)
```

## KVデータ構造

```json
{
  "version": "2026-01-09",
  "site": "gmail",
  "displayName": "Gmail",
  "baseUrl": "https://mail.google.com",
  "pages": {
    "inbox": {
      "url_pattern": "mail.google.com/mail/.*",
      "description": "Gmailインボックス",
      "required_elements": [
        {
          "id": "search_input",
          "selector": "input[name=\"q\"]",
          "alternatives": ["input.old-selector"],
          "type": "input",
          "description": "検索ボックス"
        }
      ]
    }
  }
}
```

## API エンドポイント

### POST /validate
セレクタ検証 + 自動修復 + コマンド生成

**リクエスト:**
```json
{
  "site": "gmail",
  "page": "inbox",
  "html": "<html>...</html>",
  "url": "https://mail.google.com/mail/u/0/#inbox",
  "action": {
    "type": "search",
    "keyword": "検索キーワード"
  }
}
```

**レスポンス:**
```json
{
  "task_completed": true,
  "status": "GO",
  "validation": {
    "logic_check": "MATCH",
    "ai_check": { "confirmed": true, "confidence": 0.95 }
  },
  "execution": {
    "selector_used": "input[name=\"q\"]",
    "healed": false,
    "kv_updated": false
  },
  "commands": [
    { "tool": "fill_form", "args": { "selector": "...", "value": "..." } },
    { "tool": "press_key", "args": { "key": "Enter" } }
  ]
}
```

### GET /selectors?site=gmail
セレクタ定義を取得

### POST /selectors
セレクタ定義を更新
```json
{
  "site": "gmail",
  "selectors": { ... }
}
```

## デプロイ

```bash
# Workers デプロイ
cd workers
npx wrangler deploy

# 型チェック
npm run type-check

# ログ監視
npx wrangler tail --format=pretty
```

## テスト方法

### 正常系テスト
1. Gmailを開く
2. 拡張機能ポップアップでキーワード入力
3. 「テスト実行」クリック
4. 検索結果が表示されることを確認

### 異常系テスト（セルフヒーリング検証）
1. KVに壊れたセレクタを登録:
```bash
curl -X POST "https://gourmet-selector-validator.menu-simulator.workers.dev/selectors" \
  -H "Content-Type: application/json" \
  -d '{
    "site": "gmail",
    "selectors": {
      "version": "2026-01-09",
      "site": "gmail",
      "pages": {
        "inbox": {
          "required_elements": [
            { "id": "search_input", "selector": "input.broken", "alternatives": [] }
          ]
        }
      }
    }
  }'
```

2. テスト実行
3. 確認項目:
   - `status: "ERROR"` + `task_completed: true`
   - 検索が実行される
   - KVが自動更新される

### KV確認
```bash
curl -s "https://gourmet-selector-validator.menu-simulator.workers.dev/selectors?site=gmail" | jq .
```

## 実装済み機能

- [x] Logic Check (DOM検証)
- [x] AI Check (Workers AI確認)
- [x] AI Healing (自動修復)
- [x] Best-effort Fallback (汎用セレクタ)
- [x] KV自動更新
- [x] コマンド実行 (fill_form, press_key)
- [x] リトライ機能 (初回コマンド3回)

## 既知の問題と対応

| 問題 | 原因 | 対応 |
|------|------|------|
| 1回目の実行で動作しない | Content Script初期化待ち不足 | 待機時間を1000msに延長 |
| AI修復が失敗する | JSONパースエラー | ベストエフォートで代替 |
| 不要な要素でERROR | required_elementsに未使用要素 | 必要な要素のみ登録 |

## 今後の拡張予定

1. 食べログ/ホットペッパー/ぐるなび対応
2. メニュー編集機能
3. 複数ページ間のデータ同期
4. バッチ実行機能

## 関連URL

- Workers: https://gourmet-selector-validator.menu-simulator.workers.dev
- GitHub: https://github.com/UKIYO-4s/gourmet-menu-sync

## コミット履歴（本セッション）

1. `refactor: apply code-simplifier patterns` - コード簡素化
2. `fix: add retry logic for first command` - リトライ機能追加
3. `fix: always update KV when selectors healed` - KV自動更新
4. `fix: increase wait time for content script` - タイミング修正
