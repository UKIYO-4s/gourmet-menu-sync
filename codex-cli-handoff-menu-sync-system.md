# Codex CLI 引き継ぎ資料 — Menu Sync System

## 0. この資料の目的

この資料は、飲食店メニュー同期システム `Menu Sync System` の設計・検証ディレクションを、ChatGPT から Codex CLI に引き継ぐためのものです。

現在はまだ本実装ではなく、**設計・安全要件・検証計画・DB論理設計・Chrome拡張MVP準備** の段階です。

今後のCodex CLIの役割は、以下です。

- 既存ドキュメントを読み込む
- 設計の整合性を保つ
- 実画面検証の記録を残す
- Hotpepper実画面検証結果をもとにmapping sampleを更新する
- Chrome拡張MVPの最小プロトタイプ設計へ進める
- ただし、安全制約を絶対に崩さない

---

## 1. プロジェクト概要

### プロジェクト名

`Menu Sync System`

### ローカル想定パス

```txt
/Users/shoeigoto/Desktop/Menu-sync-system
```

### 目的

飲食店のメニュー情報を、自社サイト・CSV・外部グルメサイトなどから取り込み、共通メニューモデルへ正規化した上で、Hotpepper / 食べログ / ぐるなび等の管理画面への入力補助を行う。

MVPでは完全自動化ではなく、**Chrome拡張による安全な入力補助**までを対象とする。

---

## 2. 最重要設計原則

### 2.1 Common Menu Model 経由

外部サイト同士を直接変換しない。

```txt
Source
  ↓
Common Menu Model
  ↓
Target
```

例：

```txt
自社DB → Common Menu Model → Hotpepper
CSV → Common Menu Model → Hotpepper
食べログ → Common Menu Model → Hotpepper
```

### 2.2 MVPでは自動保存・自動公開は禁止

MVPでは以下を絶対に行わない。

- 保存ボタンを押す
- 公開ボタンを押す
- 削除ボタンを押す
- 外部サイト上での確定操作を自動実行する

DB制約・Mapping JSON・Chrome拡張設計すべてで、以下を維持する。

```txt
auto_submit_enabled = false
```

### 2.3 DOM変更時は停止

外部サイト管理画面のDOM変更は、誤入力リスクに直結する。

そのため、以下の場合は自動入力を停止する。

- required field が見つからない
- field match score が閾値未満
- store identity が一致しない
- critical diff が検出された
- 未マッピングカテゴリがある
- required_extension_version を満たさない

### 2.4 保存禁止データ

以下は保存禁止。

- ログインID
- パスワード
- Cookie
- Session
- Token
- CSRF token
- 認証情報
- input value
- hidden field value
- 生DOM全文
- PIIを含む可能性のある自由入力値

原則は「マスクして保存」ではなく、**そもそも取得・保存しない**。

### 2.5 Mapping JSONは宣言的設定のみ

Mapping JSONでは以下を管理する。

- labels
- placeholders
- selector_hints
- nearby_text
- min_match_score
- target_url_patterns
- store_identity rules
- safety thresholds
- prohibited_actions

Mapping JSONにJavaScriptコード文字列や任意コード実行機構を入れない。

---

## 3. 現在の進捗

### 完了済み

```txt
README.md
CLAUDE.md

tasks/00_project-backlog.md
tasks/01_phase1-design-tasks.md

decisions/adr-001-common-menu-model.md
decisions/adr-002-chrome-extension-first.md
decisions/adr-003-no-auto-submit-in-mvp.md
decisions/adr-004-json-mapping-hot-update.md

devlog/template.md
devlog/2026-04-29.md
devlog/2026-04-30.md

docs/06_dom-diff-design.md
docs/07_sync-flow.md
docs/09_security-policy.md
docs/10_development-roadmap.md

database/schema-draft.sql
database/erd-notes.md

experiments/phase1-dom-detection-plan.md
experiments/phase1-dom-detection-checklist.md
experiments/results/hotpepper-menu-edit-YYYY-MM-DD.md

extension-mvp/README.md
```

### 注意

`docs/03_database-design.md`、`docs/04_chrome-extension-design.md`、`docs/05_mapping-json-design.md`、`docs/08_failure-and-countermeasures.md` は、既存内容がある場合でも、最新のDB・mapping・実画面検証結果に合わせて見直しが必要。

---

## 4. 直近の実行結果

以下が直近で完了した内容。

### 4.1 ADR-004 作成

`decisions/adr-004-json-mapping-hot-update.md` を作成済み。

含まれる内容：

- Status
- Context
- Decision
- JSONで即時更新可能なもの
- Chrome拡張本体更新が必要なもの
- Consequences
  - Pros
  - Cons
  - Risks
  - Mitigations
- Related Files
- Notes
  - `auto_submit_enabled=false` 維持
  - 任意コード実行禁止
  - 宣言的設定のみ

### 4.2 Phase 1.5 準備完了

以下を確認済み。

```txt
decisions/adr-004-json-mapping-hot-update.md ✅
experiments/phase1-dom-detection-checklist.md ✅
extension-mvp/README.md TODO解消 ✅
tasks/00_project-backlog.md Phase 1.5 ADR-004項目完了化 ✅
devlog/2026-04-30.md 作成 ✅
```

### 4.3 実画面検証テンプレート作成済み

`experiments/results/hotpepper-menu-edit-YYYY-MM-DD.md` を作成済み。

使うときは `YYYY-MM-DD` を実日付に置き換える。

例：

```txt
experiments/results/hotpepper-menu-edit-2026-04-30.md
```

---

## 5. 現在のフェーズ

現在は以下。

```txt
Phase 1.5: Hotpepper 実画面検証
```

目的は、Hotpepperの実際のメニュー編集画面が、現在のDOM検出・Mapping JSON設計で安全に扱えるかを検証すること。

まだChrome拡張MVPの実装には入らない。

---

## 6. 次にCodex CLIがやるべきこと

### Step 1: 実画面検証結果ファイルを作成

テンプレートをコピーして、実日付のファイルを作成する。

```bash
cp experiments/results/hotpepper-menu-edit-YYYY-MM-DD.md experiments/results/hotpepper-menu-edit-2026-04-30.md
```

日付は実作業日に合わせる。

### Step 2: チェックリストに沿ってHotpepper実画面を確認

参照ファイル：

```txt
experiments/phase1-dom-detection-checklist.md
```

確認する主な項目：

- ログイン・画面遷移時の注意
- 保存してはいけない情報
- 店舗識別情報の検出可否
- URL pattern
- menu_name field
- price field
- category field
- description field
- status field
- sale_start_date / sale_end_date
- 保存/公開ボタン
- prohibited_actions
- DOM差分検知への影響
- match_score
- critical / warning 判定
- GO / HOLD / STOP 判定

### Step 3: 検証結果を記録

記録先：

```txt
experiments/results/hotpepper-menu-edit-YYYY-MM-DD.md
```

記録時の注意：

- ログイン情報を書かない
- Cookieを書かない
- Sessionを書かない
- Tokenを書かない
- 生DOM全文を書かない
- input valueを書かない
- 店舗名や個人情報は仮名に置換する
- スクリーンショットに個人情報が写る場合は保存しない

### Step 4: Mapping Sampleを更新

実画面検証後、以下を更新する。

```txt
configs/mapping-samples/hotpepper-menu-edit.sample.json
```

更新対象：

- target_url_patterns
- store_identity signals
- field labels
- placeholders
- selector_hints
- nearby_text
- required fields
- min_match_score
- safety thresholds
- prohibited_actions
- dom_diff_policy
- TODO

注意：

- 実selectorを入れる場合も `confidence` を明記する
- 不確実なselectorは `provisional` 扱いにする
- valueは絶対に入れない
- 生DOMは入れない

### Step 5: 関連docsを更新

実画面検証結果をもとに、必要に応じて以下を更新する。

```txt
docs/04_chrome-extension-design.md
docs/05_mapping-json-design.md
docs/06_dom-diff-design.md
docs/07_sync-flow.md
docs/09_security-policy.md
docs/10_development-roadmap.md
```

特に反映すべき内容：

- 実画面が detail_page / modal / inline_edit のどれか
- field検出方式の妥当性
- store identity の検出可否
- match_score初期値
- critical diff定義の修正要否
- mapping JSONで吸収できる変更範囲
- 拡張本体更新が必要になりそうな箇所

### Step 6: devlog更新

作業後は必ずdevlogを更新する。

例：

```txt
devlog/2026-04-30.md
```

日付が変わっていれば新規作成。

記録する内容：

- 今日の目的
- 作業内容
- 決めたこと
- 迷っていること
- 発見したリスク
- 仕様に反映すべきこと
- 次にやること
- 関連ファイル

---

## 7. 重要ファイル別の役割

### README.md

プロジェクト概要・ディレクトリ構成・主要ドキュメントへの入口。

### CLAUDE.md

AI/CLIがこのプロジェクトで守るべき作業ルール。
Codex CLIも必ず確認すること。

### tasks/00_project-backlog.md

全体バックログ。
進捗が変わったら更新する。

### docs/06_dom-diff-design.md

DOMスナップショット、差分検知、severity、stop conditionの仕様。
事故防止の中核。

### docs/07_sync-flow.md

同期フロー。
自社DB正本、CSV正本、外部サイト正本、ロールバック、失敗時再実行など。

### docs/09_security-policy.md

保存禁止情報、PIIマスキング、ログ保持期間、権限、インシデント対応。

### docs/10_development-roadmap.md

Phase 0〜6の開発ロードマップ。
Phase 1.5はHotpepper実画面検証。

### database/schema-draft.sql

PostgreSQL寄りの論理スキーマ。
26テーブル。
JSONBはD1移行時にTEXT JSONへ置換する想定。

### database/erd-notes.md

DB関係性の補足。

### configs/mapping-samples/hotpepper-menu-edit.sample.json

Hotpepperメニュー編集画面のMapping JSON初期サンプル。
実画面検証後に最優先で更新する。

### experiments/phase1-dom-detection-plan.md

Phase 1 DOM検出検証の計画。

### experiments/phase1-dom-detection-checklist.md

実画面検証時に使うチェックリスト。

### experiments/results/hotpepper-menu-edit-YYYY-MM-DD.md

実画面検証結果テンプレート。
コピーして実日付ファイルとして使う。

### extension-mvp/README.md

Chrome拡張MVPの責務定義。
まだ実装コードではない。

---

## 8. DB設計の要点

### テーブル構成

`database/schema-draft.sql` には、指定25テーブル + `site_pages` がある。

主な領域：

```txt
組織/ユーザー
外部サービス
メニュー
学習データ
マッピング/DOM
同期ジョブ/ログ
監査ログ
ガードレール
```

### 履歴管理

`menu_item_versions` は追記型。

ロールバックは過去versionを直接復元しない。
過去versionを元に、新しいversionを作る。

```txt
change_type = 'rollback'
```

### 論理削除

`menu_items.publish_status` は以下。

```txt
enabled
hidden
deleted
```

季節終了は原則 `hidden`。

### 認証情報

`store_site_accounts` は管理画面URL + サイト内店舗IDのみ。

保存しないもの：

- ID/PW
- Cookie
- Session
- Token
- 認証情報

### DOM

`dom_snapshots` は構造情報のみ。
`dom_diffs` は `severity` と `must_stop` を持つ。

### ログ

- `audit_logs`: ユーザー操作の監査
- `sync_job_logs`: 同期処理イベント

役割を分ける。

### ADR-003 DB制約

以下をDBレベルで強制。

```txt
mapping_versions.safety_json->>'auto_submit_enabled' = 'false'
sync_jobs.auto_submit_enabled = FALSE
```

---

## 9. Hotpepper実画面検証の観点

実画面で特に確認すること。

### 9.1 画面タイプ

以下のどれかを確認。

```txt
detail_page
modal
inline_edit
unknown
```

この分類でChrome拡張MVPの設計が変わる。

### 9.2 URL Pattern

Mapping JSONの `target_url_patterns` に反映する。

ただし、クエリや店舗IDなど個別情報はそのまま記録しない。
必要なら仮名化する。

### 9.3 Store Identity

店舗識別に使える情報を確認。

候補：

- 店舗名
- 電話番号
- 住所
- 管理画面内店舗ID
- ページタイトル
- パンくず

ただし、個人情報や実店舗情報は検証結果ファイルには仮名で記録。

### 9.4 Field Detection

以下を確認。

- menu_name
- price
- category
- description
- status
- sale_start_date
- sale_end_date

確認する情報：

- label
- placeholder
- nearby_text
- input type
- selector hint
- requiredかどうか
- match_scoreの妥当性

### 9.5 Button Detection

保存・公開・削除ボタンを検出してよいが、クリックは禁止。

Mapping JSONでは `prohibited_actions` として扱う。

---

## 10. 絶対にやってはいけないこと

Codex CLIは以下を行わないこと。

```txt
保存ボタンを押す
公開ボタンを押す
削除ボタンを押す
ログイン情報を保存する
Cookie/Session/Tokenを保存する
input valueを保存する
hidden valueを保存する
生DOM全文を保存する
Mapping JSONに任意コード実行を入れる
auto_submit_enabled=true にする
MVP範囲で完全自動化を目指す
```

---

## 11. Codex CLIへの初回指示文

以下をそのままCodex CLIに渡す。

```txt
このプロジェクトは /Users/shoeigoto/Desktop/Menu-sync-system にある Menu Sync System です。

まず実装は始めず、既存ドキュメントを読み込んで現在の状態を把握してください。

最初に必ず確認するファイル：
- README.md
- CLAUDE.md
- tasks/00_project-backlog.md
- docs/06_dom-diff-design.md
- docs/07_sync-flow.md
- docs/09_security-policy.md
- docs/10_development-roadmap.md
- database/schema-draft.sql
- database/erd-notes.md
- experiments/phase1-dom-detection-plan.md
- experiments/phase1-dom-detection-checklist.md
- experiments/results/hotpepper-menu-edit-YYYY-MM-DD.md
- extension-mvp/README.md
- decisions/adr-001-common-menu-model.md
- decisions/adr-002-chrome-extension-first.md
- decisions/adr-003-no-auto-submit-in-mvp.md
- decisions/adr-004-json-mapping-hot-update.md

現在のフェーズは Phase 1.5: Hotpepper 実画面検証です。

次にやること：
1. experiments/results/hotpepper-menu-edit-YYYY-MM-DD.md を実日付ファイルにコピー
2. experiments/phase1-dom-detection-checklist.md に沿って実画面検証を進める
3. 検証結果を experiments/results/ に記録
4. configs/mapping-samples/hotpepper-menu-edit.sample.json を実画面結果に合わせて更新
5. 必要に応じて docs/04, docs/05, docs/06, docs/07, docs/09, docs/10 を更新
6. devlog に作業内容を記録

絶対に守ること：
- 保存ボタン・公開ボタン・削除ボタンは押さない
- 自動保存・自動公開は禁止
- auto_submit_enabled=false を維持
- ログイン情報、Cookie、Session、Token、生DOM、input value は保存しない
- Mapping JSONに任意コード実行を入れない
- 実装コードは、実画面検証と設計反映が終わるまで作らない

作業前に、現在のファイル構成と未完了タスクを確認し、次に行う作業計画を短く提示してください。
```

---

## 12. 実画面検証後のGO/HOLD/STOP基準

### GO

次へ進める条件：

- 店舗識別が十分できる
- menu_name / price / category のrequired fieldを安定検出できる
- 保存/公開ボタンをprohibited_actionsとして識別できる
- critical diff条件が定義できる
- Mapping JSON更新だけで対応できる範囲が明確

### HOLD

追加調査が必要な条件：

- 一部fieldが曖昧
- category構造が複雑
- 画面タイプが複数ある
- 店舗識別情報が弱い
- match_score閾値が未確定

### STOP

設計見直しが必要な条件：

- 店舗識別ができない
- required fieldの検出が不安定
- 保存/公開ボタンと入力欄が安全に分離できない
- DOMが頻繁に変わり、mapping JSONで吸収できない
- 外部サイト規約・安全面で運用困難

---

## 13. 次の大きなマイルストーン

Phase 1.5完了後は、以下に進む。

```txt
Phase 2: Chrome拡張MVPの最小プロトタイプ設計
```

ただし、実装に入る前に以下を完了すること。

- 実画面検証結果の記録
- Hotpepper mapping sampleの更新
- docs/04の更新
- docs/05の更新
- docs/06のTODO回収
- tasks/00_project-backlog.md更新
- devlog更新

---

## 14. 最後に

このプロジェクトは、通常のRPAや単純なPlaywright操作ではなく、外部管理画面の変更に耐えるために、以下の構造を取っている。

```txt
Chrome拡張本体 = 汎用DOMスキャン・安全停止・入力補助
Mapping JSON = サイト別の検出ルール・閾値・selector hints
DB = メニュー履歴・マッピング履歴・DOM差分・同期ログ・監査ログ
Devlog/ADR = なぜその設計にしたかの記録
```

Codex CLIは、この思想を崩さずに進めること。

特に、**安全停止・履歴・ログ・人間確認** を削ってはいけない。
