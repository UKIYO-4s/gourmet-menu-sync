# Development Roadmap

## 1. 方針

このプロジェクトは、いきなり実装に入らず、以下の順で進める。

```txt
設計分解
↓
DB設計
↓
Mapping JSON設計
↓
Chrome拡張MVP
↓
API MVP
↓
Admin Web MVP
↓
DOM差分検知
↓
同期ログ・ロールバック
```

---

## Phase 1: Design Foundation

### 目的

仕様書を分割し、CLIが迷わない設計ドキュメント群を整える。

### Tasks

- [ ] docs/00_master-spec.mdを確定
- [ ] Common Menu Modelを確定
- [ ] MVP Scopeを確定
- [ ] DBテーブル一覧を確定
- [ ] Chrome Extension構成を確定
- [ ] Mapping JSON仕様を確定
- [ ] DOM Diff仕様を確定
- [ ] 主要Failureをテスト項目に変換

### Done Criteria

- 各docsが矛盾していない
- MVPでやること/やらないことが明確
- 自動保存禁止方針が全体に反映されている

---

## Phase 2: Database Draft

### 目的

実装前のDBスキーマ案を作る。

### Tasks

- [ ] schema-draft.sqlを作成
- [ ] organizations/users/storesを定義
- [ ] menu_items/menu_item_versionsを定義
- [ ] external_sites/store_site_accountsを定義
- [ ] mapping_versionsを定義
- [ ] dom_snapshots/dom_diffsを定義
- [ ] sync_jobs/sync_job_logsを定義
- [ ] インデックス案を作成

### Done Criteria

- menuの現在状態と履歴が分離されている
- rollbackを履歴として残せる
- DOM差分を保存できる
- sync jobを監査できる

---

## Phase 3: Mapping and Sample Configs

### 目的

Chrome拡張が読み込むmapping JSONのサンプルを作る。

### Tasks

- [ ] hotpepper-menu-edit.sample.json
- [ ] tabelog-menu-read.sample.json
- [ ] csv-to-common.sample.json
- [ ] common-to-hotpepper.sample.json
- [ ] mapping validation rules作成

### Done Criteria

- required fieldsが定義されている
- autoSubmit=falseになっている
- required_extension_versionが指定されている
- minMatchScoreが設定されている

---

## Phase 4: Chrome Extension MVP

### 目的

外部サイト管理画面でDOMスキャンと自動入力を行う最小拡張を作る。

### Tasks

- [ ] Manifest V3構成作成
- [ ] popup/sidepanel作成
- [ ] API login/token保存
- [ ] store選択UI
- [ ] DOM scanner作成
- [ ] sanitizer作成
- [ ] matcher作成
- [ ] executor作成
- [ ] identity-checker作成
- [ ] reporter作成

### Done Criteria

- 管理画面DOMをスキャンできる
- 生valueを送信しない
- mapping JSONで入力欄を見つけられる
- 保存ボタンを押さない
- sync logを送信できる

---

## Phase 5: API MVP

### 目的

Admin WebとChrome拡張が使うAPIを作る。

### Tasks

- [ ] 認証API
- [ ] organization/store API
- [ ] menu API
- [ ] menu version API
- [ ] mapping JSON API
- [ ] DOM snapshot API
- [ ] sync job API
- [ ] category mapping API

### Done Criteria

- Chrome拡張がmappingを取得できる
- DOM snapshotを保存できる
- sync jobを記録できる
- メニュー履歴を作れる

---

## Phase 6: Admin Web MVP

### 目的

店舗・メニュー・マッピング・同期ログを管理する画面を作る。

### Screens

- Login
- Organization list
- Store list
- Store detail
- Menu editor
- Menu version history
- External site settings
- Category mapping
- Sync jobs
- DOM diffs

### Done Criteria

- 1店舗のメニュー管理ができる
- 履歴が見られる
- 同期ログが見られる
- DOM差分が見られる

---

## Phase 7: First Site Support

### 目的

ホットペッパーのメニュー編集画面を初期対応する。

### Tasks

- [ ] 実際の管理画面DOMを調査
- [ ] sanitized snapshot作成
- [ ] mapping JSON作成
- [ ] 店舗識別項目を定義
- [ ] カテゴリ検出を実装
- [ ] 自動入力テスト

### Done Criteria

- 店舗識別ができる
- 商品名/価格/説明/カテゴリを入力できる
- 保存前に停止する
- DOM差分が取れる

---

## Phase 8: Reliability and Test

### 目的

本番運用で起こりうる障害をテストに変換する。

### Tests

- Wrong store selected
- DOM changed
- Required field missing
- Category unmapped
- Price too different
- Extension version mismatch
- Auto submit blocked
- PII sanitization
- Rollback preview

### Done Criteria

- safety stopが動作する
- 誤入力リスクを検知できる
- ログで追跡できる

---

## Phase 9: Beta Operation

### 目的

少数店舗で実運用テストする。

### 運用ルール

- 1サイト・1店舗から開始
- 自動保存は禁止
- 作業後に人間が目視確認
- 失敗ログを必ずレビュー
- mapping更新履歴を残す

### Done Criteria

- 実店舗で入力補助が成立する
- 手入力時間が削減される
- 誤保存が起きない
- DOM変更時に停止できる

---

## Phase 10: Expansion

### 目的

対応サイトと機能を広げる。

### Candidates

- 食べログ読み取り
- ぐるなび入力補助
- Googleビジネスプロフィール
- 画像アップロード補助
- コース料理対応
- 複数店舗一括更新
- AIカテゴリ候補提案

### 注意

完全自動保存・公開は、十分な運用実績と安全機構が揃うまでは解禁しない。
