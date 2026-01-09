# セルフヒーリング セレクタシステム テスト仕様書

> 作成日: 2026-01-09
> ステータス: テスト実装中

---

## 1. システムゴール

**差分エラーが出ても止まらず、自動修復して作業を完遂するシステム**

- セレクタ不一致でも処理を中断しない
- AIが新セレクタを提案し即座に適用
- 修復成功時はKVを自動更新（次回から高速化）
- 最悪ケースでもベストエフォートで作業実行
- 何が起きたか全て記録してレポート

---

## 2. テスト対象

### Gmail 検索機能
- URL: `https://mail.google.com/mail/u/0/#inbox`
- 操作: 検索キーワード入力 → 検索実行

---

## 3. 実行フロー

```
┌─────────────────────────────────────────────────────────────────────┐
│                    セルフヒーリング完遂フロー                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  [ユーザー] 検索語句入力 → [テスト実行]                               │
│                    │                                                │
│                    ▼                                                │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Step 1: ロジックチェック                                      │   │
│  │   KVセレクタ vs 現在DOM                                       │   │
│  └──────────────────────────┬──────────────────────────────────┘   │
│                             │                                       │
│              ┌──────────────┴──────────────┐                       │
│              ▼                             ▼                       │
│         [一致]                        [不一致]                      │
│              │                             │                       │
│              ▼                             ▼                       │
│  ┌─────────────────────┐    ┌─────────────────────────────────┐   │
│  │ Step 2: AI確認       │    │ Step 2: AI修復                   │   │
│  │ 「本当に正しい？」    │    │ 「新セレクタを提案して」          │   │
│  └──────────┬──────────┘    └──────────────┬──────────────────┘   │
│             │                              │                       │
│             ▼                              ▼                       │
│        [GO確定]                    [新セレクタで再試行]             │
│             │                              │                       │
│             │                    ┌─────────┴─────────┐            │
│             │                    ▼                   ▼            │
│             │               [成功]              [失敗]             │
│             │                    │                   │            │
│             │                    ▼                   ▼            │
│             │              KV自動更新          ログ記録のみ         │
│             │                    │            (処理は続行)         │
│             │                    │                   │            │
│             └────────────────────┴───────────────────┘            │
│                                  │                                 │
│                                  ▼                                 │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Step 3: 作業実行 (必ず実行)                                   │   │
│  │   ・検索入力欄にテキスト入力                                   │   │
│  │   ・検索ボタンクリック or Enterキー                           │   │
│  │   ・結果を返却                                                │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                  │                                 │
│                                  ▼                                 │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Step 4: 結果レポート                                          │   │
│  │   ・実行成功/失敗                                             │   │
│  │   ・セレクタ修復があったか                                     │   │
│  │   ・次回への改善提案                                          │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 4. 差分チェック詳細

### Step 1: ロジックチェック (高速)

```javascript
// KVから取得したセレクタ定義
const stored = {
  selector: 'input[name="q"]',
  alternatives: [
    'input[aria-label="メールを検索"]',
    'input[placeholder="メールを検索"]'
  ]
};

// 現在DOMでチェック
let found = document.querySelector(stored.selector);
if (!found) {
  for (const alt of stored.alternatives) {
    found = document.querySelector(alt);
    if (found) break;
  }
}
```

### Step 2: AIチェック (確認/修復)

```
Workers AI (Llama 3 8B) に送信:
  - 保存済みセレクタ定義
  - 現在のHTML (トリミング)
  - ロジックチェックの結果

AIの役割:
  ✓ 見つかった場合 → 本当に正しい要素か確認
  ✗ 見つからない場合 → 新しいセレクタを提案
```

---

## 5. KVデータ形式

### キー構造
```
selectors:gmail              → セレクタ定義JSON
selectors:gmail:history:xxx  → 変更履歴
```

### Gmail セレクタ定義

```json
{
  "version": "2026-01-09",
  "site": "gmail",
  "displayName": "Gmail",
  "baseUrl": "https://mail.google.com",

  "pages": {
    "inbox": {
      "url_pattern": "mail.google.com/mail/.*#inbox",
      "description": "受信トレイ",

      "elements": {
        "search_input": {
          "selector": "input[name=\"q\"]",
          "alternatives": [
            "input[aria-label=\"メールを検索\"]",
            "input[placeholder=\"メールを検索\"]"
          ],
          "type": "input",
          "role": "検索キーワード入力欄",
          "required": true
        },
        "search_button": {
          "selector": "button[aria-label=\"メールを検索\"]",
          "alternatives": [
            "form button[type=\"submit\"]"
          ],
          "type": "button",
          "role": "検索実行ボタン",
          "required": true
        }
      }
    }
  },

  "metadata": {
    "created_at": "2026-01-09T00:00:00Z",
    "updated_at": "2026-01-09T00:00:00Z",
    "created_by": "manual",
    "last_validated": null,
    "validation_count": 0,
    "heal_count": 0
  }
}
```

---

## 6. API レスポンス形式

### POST /validate リクエスト

```json
{
  "site": "gmail",
  "page": "inbox",
  "html": "<現在ページのHTML>",
  "url": "https://mail.google.com/mail/u/0/#inbox",
  "action": {
    "type": "search",
    "keyword": "Anthropic"
  }
}
```

### レスポンス (成功)

```json
{
  "task_completed": true,
  "status": "GO",

  "validation": {
    "logic_check": "MATCH",
    "ai_check": {
      "confirmed": true,
      "confidence": 0.95,
      "analysis": "検索入力欄が正しく検出されました"
    }
  },

  "execution": {
    "selector_used": "input[name=\"q\"]",
    "healed": false
  },

  "commands": [
    { "tool": "fill_form", "args": { "selector": "input[name=\"q\"]", "value": "Anthropic" }},
    { "tool": "press_key", "args": { "key": "Enter" }}
  ],

  "validation_time_ms": 1234
}
```

### レスポンス (自動修復)

```json
{
  "task_completed": true,
  "status": "GO",

  "validation": {
    "logic_check": "MISMATCH",
    "ai_check": {
      "confirmed": true,
      "confidence": 0.88,
      "analysis": "セレクタを自動修復しました",
      "original_selector": "input[name=\"q\"]",
      "healed_selector": "input[data-search-input]"
    }
  },

  "execution": {
    "selector_used": "input[data-search-input]",
    "healed": true,
    "kv_updated": true
  },

  "commands": [
    { "tool": "fill_form", "args": { "selector": "input[data-search-input]", "value": "Anthropic" }},
    { "tool": "press_key", "args": { "key": "Enter" }}
  ],

  "validation_time_ms": 5678
}
```

---

## 7. 拡張機能側の処理

### テスト実行フロー

```javascript
async function executeTest(keyword) {
  // 1. 現在ページのDOM情報を取得
  const html = document.documentElement.outerHTML;
  const url = window.location.href;

  // 2. CF Workers APIに送信
  const response = await fetch('https://gourmet-selector-validator.menu-simulator.workers.dev/validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      site: 'gmail',
      page: 'inbox',
      html: html,
      url: url,
      action: { type: 'search', keyword: keyword }
    })
  });

  const result = await response.json();

  // 3. コマンドを実行（GOでもERRORでも実行）
  if (result.commands) {
    for (const cmd of result.commands) {
      await commandExecutor.executeCommand(cmd);
    }
  }

  // 4. 結果をレポート
  return result;
}
```

---

## 8. テストケース

| # | シナリオ | 期待結果 |
|---|----------|----------|
| 1 | セレクタ一致 | GO → 即座に検索実行 |
| 2 | セレクタ不一致 (alternatives一致) | GO → alternativeで検索実行 |
| 3 | セレクタ不一致 (AI修復成功) | GO → 修復セレクタで検索実行、KV更新 |
| 4 | セレクタ不一致 (AI修復失敗) | ベストエフォート実行 → ログ記録 |

---

## 9. 次のステップ

1. [ ] Gmail セレクタ定義をKVに登録
2. [ ] Workers API に action 対応を追加
3. [ ] 拡張機能にテストボタン機能を実装
4. [ ] E2Eテスト実行

---

*この仕様書は 2026-01-09 時点の状態を反映しています*
