# グルメサイトメニュー同期ツール - 完全仕様書

> 作成日: 2026-01-09
> 引き継ぎ用ドキュメント

---

## 1. プロジェクト概要

### 目的
飲食店オーナー/スタッフが、3つのグルメサイト（食べログ、ホットペッパーグルメ、ぐるなび）の管理画面でメニュー情報を一括管理・同期するChrome拡張機能

### 主要機能
- メニュー情報の変更・削除・新規追加
- 3サイト間のデータ同期（マスターサイト→他サイト）
- 画像アップロード対応
- サイドパネルUI
- **セルフヒーリング セレクタシステム**（DOM変更時の自動修復）

### 対象サイト

| サイト | 管理画面URL | 用途 |
|--------|------------|------|
| 食べログ | owner.tabelog.com | メニュー管理 |
| ホットペッパーグルメ | restaurant.hotpepper.jp | メニュー管理 |
| ぐるなび | pro.gnavi.co.jp | メニュー管理 |

---

## 2. 技術スタック

### Chrome拡張機能

| 項目 | 選定 | 理由 |
|------|------|------|
| 言語 | TypeScript | 型安全性、保守性 |
| UIフレームワーク | React | コンポーネント指向、状態管理 |
| ビルドツール | Vite + @crxjs/vite-plugin | 高速HMR、Chrome拡張対応 |
| スタイリング | Tailwind CSS | コンパクトUI向け |
| 状態管理 | Zustand | 軽量、Chrome storage連携容易 |
| Manifest | V3 | 最新仕様 |

### バックエンド（セルフヒーリング）

| 項目 | 選定 | 理由 |
|------|------|------|
| ランタイム | Cloudflare Workers | エッジ実行、低レイテンシ |
| AI | Workers AI (Llama 3 8B) | 無料枠寛大、外部API不要 |
| ストレージ | Cloudflare KV | 高速読み取り、セレクタ保存 |
| HTMLパース | linkedom | 軽量DOMパーサー |

### CI/CD

| 項目 | 選定 | 用途 |
|------|------|------|
| ホスティング | GitHub | ソースコード管理 |
| 定期監視 | GitHub Actions | 毎日0時にDOM構造チェック |
| 通知 | Slack Webhook | DOM変更検出時の通知 |

---

## 3. アーキテクチャ

### 全体構成図

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Chrome Browser                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────────┐    chrome.runtime     ┌────────────────────┐  │
│  │    Side Panel    │◄────────────────────►│   Service Worker   │  │
│  │     (React)      │                       │                    │  │
│  │                  │    chrome.storage     │                    │  │
│  │  ┌────────────┐  │◄────────────────────►│                    │  │
│  │  │  Zustand   │  │                       └─────────┬──────────┘  │
│  │  │   Store    │  │                                 │             │
│  │  └────────────┘  │                                 │             │
│  └──────────────────┘                                 │             │
│                                                       │             │
│  chrome.tabs.sendMessage                              │             │
│         │                                             │             │
│         ▼                                             ▼             │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────────┐    │
│  │ Content Script │  │ Content Script │  │  Content Script    │    │
│  │   (食べログ)    │  │(ホットペッパー) │  │    (ぐるなび)      │    │
│  │    Adapter     │  │    Adapter     │  │     Adapter        │    │
│  └───────┬────────┘  └───────┬────────┘  └─────────┬──────────┘    │
│          │                   │                     │               │
└──────────┼───────────────────┼─────────────────────┼───────────────┘
           │                   │                     │
           ▼                   ▼                     ▼
    owner.tabelog.com  restaurant.hotpepper.jp  pro.gnavi.co.jp
                               │
                               │ POST /validate
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Cloudflare Workers                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────────┐      ┌─────────────────────────────────────┐  │
│  │  Cloudflare KV   │◄────►│         /validate endpoint          │  │
│  │  (セレクタ保存)   │      │                                     │  │
│  └──────────────────┘      │  1. KVからセレクタ取得               │  │
│                            │  2. HTMLパース・マッチング            │  │
│  ┌──────────────────┐      │  3. 見つからない→Workers AI呼び出し  │  │
│  │   Workers AI     │◄────►│  4. 成功→KV自動更新（セルフヒーリング）│  │
│  │  (Llama 3 8B)    │      │                                     │  │
│  └──────────────────┘      └─────────────────────────────────────┘  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### セルフヒーリング フロー

```
[メニュー取得/入力リクエスト]
         ↓
┌─────────────────┐
│ KVからセレクタ取得 │ ← Cloudflare KV
└────────┬────────┘
         ↓
┌─────────────────┐
│ HTMLパース実行   │
└────────┬────────┘
         ↓
   結果 0件？ ─────No──→ [正常レスポンス]
      ↓ Yes
┌─────────────────┐
│ Workers AI 分析  │ ← Llama 3 8B (@cf/meta/llama-3-8b-instruct)
│ 新セレクタ提案   │
└────────┬────────┘
         ↓
┌─────────────────┐
│ 新セレクタで再試行│
└────────┬────────┘
         ↓
   成功？ ──────Yes──→ [KV自動更新 + レスポンス]
      ↓ No
[エラー通知 + フォールバック]
```

---

## 4. ディレクトリ構造

```
gourmet-menu-sync/
├── src/
│   ├── background/
│   │   ├── index.ts                 # Service Worker エントリ
│   │   ├── storage-manager.ts       # Chrome Storage管理
│   │   ├── message-handler.ts       # メッセージルーティング
│   │   └── sync-coordinator.ts      # 同期処理調整
│   │
│   ├── content-scripts/
│   │   ├── common/
│   │   │   ├── base-site-adapter.ts # 抽象基底クラス
│   │   │   ├── dom-utils.ts         # DOM操作ユーティリティ
│   │   │   └── image-uploader.ts    # 画像アップロード共通処理
│   │   │
│   │   ├── tabelog/
│   │   │   ├── adapter.ts           # 食べログ操作
│   │   │   └── selectors.ts         # DOMセレクター定義
│   │   │
│   │   ├── hotpepper/
│   │   │   ├── adapter.ts
│   │   │   └── selectors.ts
│   │   │
│   │   └── gurunavi/
│   │       ├── adapter.ts
│   │       └── selectors.ts
│   │
│   ├── sidepanel/
│   │   ├── index.html
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── layout/              # Header, TabNav, StatusBar
│   │   │   ├── menu/                # MenuList, MenuItem, MenuForm
│   │   │   └── sync/                # SyncPanel, SiteSelector
│   │   ├── hooks/
│   │   └── store/
│   │       └── menu-store.ts        # Zustand状態管理
│   │
│   ├── shared/
│   │   ├── types/
│   │   │   └── menu.ts              # 型定義
│   │   ├── constants/
│   │   └── utils/
│   │
│   └── assets/
│
├── workers/                          # Cloudflare Workers
│   ├── src/
│   │   └── index.ts                 # Workers エントリ
│   ├── wrangler.toml
│   └── package.json
│
├── selectors/                        # 基準セレクタ定義
│   ├── tabelog.json
│   ├── hotpepper.json
│   └── gurunavi.json
│
├── .github/
│   └── workflows/
│       └── dom-monitor.yml          # 定期DOM監視
│
├── public/
│   └── manifest.json
│
├── AI_worker.md                      # Workers AI詳細ドキュメント
├── SPECIFICATION.md                  # この仕様書
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
└── package.json
```

---

## 5. データモデル

### MenuItem（メニュー項目）

```typescript
interface MenuItem {
  id: string;                    // 内部ID (UUID)
  name: string;                  // メニュー名
  description: string;           // 説明文
  price: number;                 // 価格
  taxIncluded: boolean;          // 税込みフラグ
  categoryId: string;            // カテゴリID
  images: MenuImage[];           // 画像配列
  isAvailable: boolean;          // 提供可否
  displayOrder: number;          // 表示順
  createdAt: string;             // 作成日時 (ISO8601)
  updatedAt: string;             // 更新日時 (ISO8601)
  siteIds: {                     // 各サイトでのID
    tabelog?: string;
    hotpepper?: string;
    gurunavi?: string;
  };
}

interface MenuImage {
  id: string;
  url: string;                   // 画像URL
  base64?: string;               // Base64データ（アップロード用）
  mimeType: string;              // MIME type
}

interface MenuCategory {
  id: string;
  name: string;
  displayOrder: number;
}
```

### SelectorDefinition（セレクタ定義）

```typescript
interface SelectorDefinition {
  version: string;               // バージョン (YYYY-MM-DD)
  site: 'tabelog' | 'hotpepper' | 'gurunavi';
  displayName: string;           // 表示名
  baseUrl: string;               // ベースURL
  pages: {
    [pageName: string]: PageDefinition;
  };
}

interface PageDefinition {
  url_pattern: string;           // URLパターン (正規表現)
  description: string;           // ページ説明
  required_elements: ElementDefinition[];
  page_indicators: string[];     // ページ識別用セレクタ
}

interface ElementDefinition {
  id: string;                    // 要素ID
  selector: string;              // メインセレクタ
  alternatives: string[];        // 代替セレクタ
  type: 'input' | 'textarea' | 'button' | 'select' | 'file';
  description: string;           // 要素説明
}
```

---

## 6. API仕様

### Cloudflare Workers API

#### POST /validate

DOM構造を検証し、セレクタの有効性を確認

**リクエスト**
```json
{
  "site": "tabelog",
  "page": "menu_edit",
  "html": "<html>...ページ全体のHTML...</html>",
  "url": "https://owner.tabelog.com/xxx/menu/edit/123"
}
```

**レスポンス（成功）**
```json
{
  "status": "GO",
  "matched_elements": [
    { "id": "menu_name", "selector": "#menu-name-input", "found": true },
    { "id": "menu_price", "selector": "#menu-price-input", "found": true },
    { "id": "save_button", "selector": ".btn-save", "found": true }
  ],
  "validation_time_ms": 234
}
```

**レスポンス（セルフヒーリング成功）**
```json
{
  "status": "GO",
  "healed": true,
  "matched_elements": [
    { "id": "menu_name", "selector": "#menu-name-input", "found": true },
    { "id": "save_button", "selector": ".submit-btn", "found": true, "healed": true }
  ],
  "ai_analysis": "保存ボタンのクラス名が .btn-save から .submit-btn に変更されました",
  "updated_selectors": [
    { "id": "save_button", "old": ".btn-save", "new": ".submit-btn" }
  ],
  "validation_time_ms": 1523
}
```

**レスポンス（エラー）**
```json
{
  "status": "ERROR",
  "error_type": "SELECTOR_NOT_FOUND",
  "missing_elements": [
    { "id": "save_button", "expected_selector": ".btn-save", "tried_alternatives": true }
  ],
  "ai_analysis": "ページ構造が大幅に変更されています。手動確認が必要です。",
  "suggested_fix": null
}
```

---

## 7. 画像アップロード仕様

| サイト | 最大サイズ | 形式 | アップロード方式 |
|--------|-----------|------|------------------|
| 食べログ | 5MB | JPEG, PNG | file-input |
| ホットペッパー | 3MB | JPEG, PNG, GIF | file-input |
| ぐるなび | 10MB | JPEG, PNG | drag-drop |

### 処理フロー
1. Base64データを受け取る
2. サイト制限に合わせてリサイズ・圧縮
3. Blob→File変換
4. input[type=file]またはdrag-dropイベントでアップロード

---

## 8. 同期フロー

```
1. ユーザーがマスターサイトを選択（例: 食べログ）
2. ユーザーが反映先を選択（例: ホットペッパー、ぐるなび）
3. 「同期開始」クリック
4. Background Worker が調整:
   a. マスターサイトのタブにメッセージ送信
   b. Content Script がメニューデータをスクレイピング
   c. Cloudflare Workers で反映先サイトのDOM検証
   d. 検証OK → 反映先サイトの各タブにメッセージ送信
   e. 各 Content Script がDOM操作で入力・保存
5. 結果をSide Panelに表示
```

---

## 9. エラーハンドリング

| エラー種別 | 対応 |
|-----------|------|
| DOM要素が見つからない | Workers AIでセルフヒーリング試行 |
| セルフヒーリング失敗 | ユーザーに通知、操作中止 |
| セッション切れ | ユーザーに再ログイン促す |
| 画像アップロード失敗 | リサイズ・圧縮して再試行（最大3回） |
| 同期失敗 | 部分成功でも続行、失敗項目を報告 |
| Workers API エラー | ローカルセレクタでフォールバック |

---

## 10. 環境設定状況

### 完了済み

| 項目 | 状態 | 詳細 |
|------|------|------|
| プロジェクトディレクトリ | 完了 | ~/Desktop/gourmet-menu-sync |
| Git初期化 | 完了 | main ブランチ |
| GitHub リポジトリ | 完了 | https://github.com/UKIYO-4s/gourmet-menu-sync |
| gh CLI | 完了 | 認証済み (UKIYO-4s) |
| Wrangler CLI | 完了 | npm install -g wrangler、認証済み |
| 基準セレクタファイル | 完了 | selectors/*.json（テンプレート） |
| GitHub Issues | 完了 | 12件作成済み |

### 未完了

| 項目 | 状態 | 次のアクション |
|------|------|---------------|
| Cloudflare KV namespace | 未作成 | `wrangler kv:namespace create` |
| Workers デプロイ | 未実施 | workers/ ディレクトリ作成・デプロイ |
| Chrome拡張ビルド環境 | 未構築 | `npm create vite@latest` |
| 実際のDOMセレクタ調査 | 未実施 | 各サイト管理画面の調査 |

---

## 11. GitHub Issues一覧

| # | タイトル | Phase |
|---|---------|-------|
| 1 | Cloudflare Workers セットアップ | 1-1 |
| 2 | 基準セレクター定義 | 1-2 |
| 3 | Cloudflare Workers /validate エンドポイント実装 | 1-3 |
| 4 | GitHub Actions 定期監視 | 1-4 |
| 5 | Chrome拡張 プロジェクトセットアップ | 2-1 |
| 6 | Chrome拡張 基盤実装 | 2-2 |
| 7 | Side Panel UI実装 | 3-1 |
| 8 | Content Script 共通処理 | 4-1 |
| 9 | TabelogAdapter 実装 | 4-2 |
| 10 | HotpepperAdapter 実装 | 4-2 |
| 11 | GurunaviAdapter 実装 | 4-2 |
| 12 | 同期機能実装 | 5-1 |

---

## 12. 実装優先順位

### Phase 1: セルフヒーリング セレクタシステム（最優先）

```
Step 1-1: Cloudflare Workers セットアップ
├── [ ] KV namespace 作成
├── [ ] wrangler.toml 設定
└── [ ] 基本Worker デプロイ

Step 1-2: 基準セレクター定義
├── [x] selectors/tabelog.json（テンプレート済み）
├── [x] selectors/hotpepper.json（テンプレート済み）
├── [x] selectors/gurunavi.json（テンプレート済み）
└── [ ] 実際のセレクタ調査・更新

Step 1-3: Cloudflare Workers 実装
├── [ ] /validate エンドポイント
├── [ ] KV からセレクター取得
├── [ ] HTMLパース（linkedom）
├── [ ] Workers AI (Llama 3) 連携
├── [ ] セルフヒーリング（KV自動更新）
└── [ ] エラーレスポンス

Step 1-4: GitHub Actions 定期監視
├── [ ] dom-monitor.yml
├── [ ] DOM構造チェックスクリプト
├── [ ] KV同期スクリプト
└── [ ] Slack通知設定
```

### Phase 2-5: Chrome拡張機能（Phase 1完了後）

詳細は GitHub Issues #5-12 参照

---

## 13. コスト試算

| 項目 | 単価 | 想定使用量/月 | 月額 |
|------|------|--------------|------|
| Cloudflare Workers | 無料枠: 100,000 req | ~10,000 req | $0 |
| Cloudflare KV | 無料枠: 100,000 read | ~30,000 read | $0 |
| Workers AI (Llama 3) | 無料枠: 10,000 req/日 | ~3,000 req | $0 |
| GitHub Actions | 無料枠: 2,000分/月 | ~30分 | $0 |
| **合計** | | | **$0/月** |

---

## 14. 重要ファイル参照

| ファイル | 役割 |
|---------|------|
| `AI_worker.md` | Workers AI セルフヒーリングの詳細設計 |
| `selectors/*.json` | 各サイトのセレクタ定義 |
| `~/.claude/plans/fizzy-orbiting-wren.md` | 設計計画書（Claude用） |

---

## 15. 次のアクション

1. **Cloudflare KV namespace 作成**
   ```bash
   cd ~/Desktop/gourmet-menu-sync
   wrangler kv:namespace create "SELECTORS"
   ```

2. **Workers プロジェクト初期化**
   ```bash
   mkdir -p workers
   cd workers
   npm init -y
   npm install linkedom
   ```

3. **wrangler.toml 作成**
   ```toml
   name = "dom-validator"
   main = "src/index.ts"
   compatibility_date = "2024-01-01"

   [[kv_namespaces]]
   binding = "SELECTORS"
   id = "<作成したnamespace ID>"

   [ai]
   binding = "AI"
   ```

4. **Workers エンドポイント実装** → Issue #3

---

## 16. 連絡先・リソース

- **GitHub**: https://github.com/UKIYO-4s/gourmet-menu-sync
- **Cloudflare Dashboard**: https://dash.cloudflare.com
- **Workers AI ドキュメント**: https://developers.cloudflare.com/workers-ai/

---

*この仕様書は 2026-01-09 時点の状態を反映しています*
