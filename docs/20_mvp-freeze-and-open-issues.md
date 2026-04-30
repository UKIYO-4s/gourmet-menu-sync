# MVP Freeze and Open Issues

## 1. MVP Freeze の目的

このドキュメントは、Menu Sync System のMVP範囲を一旦固定し、未決事項・HOLD事項・STOP事項を整理するためのものである。

外部サイト解析待ちでも進められるMVP範囲と、Hotpepper / 食べログ / ぐるなび等の実画面検証後に再開する範囲を分ける。

この文書はfreeze判断とopen issue整理であり、既存ドキュメントや実装コードは修正しない。

---

## 2. 現時点の前提

現時点の前提。

- 外部サイト解析はHOLD
- Chrome拡張MVP実行はHOLD
- 自動保存 / 自動公開 / 自動削除はSTOP
- `auto_submit_enabled=false` を維持する
- Cookie / Session / Token / 生DOM / input value は扱わない
- 外部サイト管理画面の解析はこのfreezeでは行わない
- 内部DB正本、CSV import、Admin UI、sync preview、ログ設計は外部サイト解析前でも進められる

---

## 3. MVPで作るもの

MVPで作るもの。

| 項目 | 内容 |
|---|---|
| Common Menu Model | 入力元を共通形式へ正規化するモデル |
| CSV import preview / validation / commit | CSVをpreview / validation後に確定する |
| Internal Menu Admin | 自社DB正本としてメニューを作成・編集する |
| Menu versioning | `menu_items` と `menu_item_versions` で現在状態と履歴を分離する |
| Rollback preview | rollback前に現在状態との差分を確認する |
| Category Mapping UI | Commonカテゴリと外部サイトカテゴリの対応を手動管理する |
| Sync preview | 外部サイト反映候補の差分と安全条件を確認する |
| Sync job logs | sync jobの技術ログを記録・閲覧する |
| Audit logs | ユーザー操作・承認・停止確認を監査可能にする |
| Error handling / safe logging | 停止条件、復旧手順、保存禁止情報を含まないログ方針を定義する |

---

## 4. MVPで作らないもの

MVPで作らないもの。

- 外部サイト自動保存
- 外部サイト自動公開
- 外部サイト自動削除
- 認証情報保存
- Cookie / Session / Token保存
- 生DOM保存
- input value保存
- hidden value保存
- AIによる自動確定
- 複数店舗一括同期
- 外部サイト同士の直接同期
- 画像アップロード実行
- アレルゲン外部サイト反映

---

## 5. HOLD事項

外部サイト解析や実接続が必要なためHOLDする事項。

- Hotpepper実画面検証
- 食べログ実画面検証
- ぐるなび実画面検証
- Chrome拡張MVPの実接続
- 外部サイトカテゴリ取得方式
- DOM差分閾値
- `required_extension_version` の実運用値
- `mapping_versions` の実画面向けpublish workflow
- `store_site_identity_checks` の実画面検証
- `site_store_categories` の取得粒度

HOLD中の扱い:

- sync previewで「外部サイト解析待ち」と表示する
- sync job作成前に停止、または `blocked_by_safety_check`
- 外部サイト解析完了後にmapping / DOM / identity / categoryの設計を再確認する

---

## 6. STOP事項

MVPで禁止する事項。

- `auto_submit_enabled=true`
- 自動保存
- 自動公開
- 自動削除
- 保存禁止情報の記録
- Cookie / Session / Token の保存
- 生DOM / outerHTML の保存
- input value / hidden value の保存
- 外部サイトログインID / パスワードの保存
- 外部サイト管理画面スクリーンショットの保存

STOP事項が必要になった場合:

- MVP範囲外として扱う
- 別途セキュリティ・規約・監査要件を満たす設計が必要
- 現行MVPでは実装しない

---

## 7. OPEN論点

未決事項。

| 論点 | 状態 | メモ |
|---|---|---|
| category mapping未設定時にCSV import commitを許可するか | OPEN | 推奨案はcommit可、sync preview停止 |
| `error_logs` 独立テーブルをMVPで作るか | OPEN | 現状は `sync_job_logs` / `audit_logs` / `guardrail_events` に寄せる案 |
| API/UI/schemaのHOLD箇所 | OPEN | organization/store read、sync job list、audit log read等 |
| DBエンジン最終決定 | OPEN | PostgreSQL寄りDDL。D1採用時はJSONB等の置換が必要 |
| 認証方式 | OPEN | 自前認証/OIDC等は未決 |
| 管理画面技術スタック | OPEN | 未決 |
| API技術スタック | OPEN | 未決 |
| CSV import session / batch / import jobテーブル | OPEN | `import_id` を使うAPIとの対応で要判断 |
| sync job target itemsテーブル | OPEN | `summary_json` 継続か正規化するか要判断 |
| retry attempt保存方式 | OPEN | `attempt_number` / `retry_reason` の保存先未決 |
| category mapping versions | OPEN | mapping rollback / version固定はPhase後送り候補 |
| `store_mapping_overrides` | OPEN | MVPでは作らず概念整理のみ |

---

## 8. category mapping未設定時のCSV import commit方針案

### 案A: commit不可

CSV import時点で未マッピングカテゴリがある場合、commit自体を止める。

メリット:

- 外部サイト反映できないデータが正本に入らない
- sync時の停止が少なくなる

デメリット:

- 自社DB正本の整備が外部サイトカテゴリ準備に依存する
- 初期データ投入や台帳整理が進みにくい
- 外部サイト解析HOLD中にCSV整備が止まる

### 案B: commit可、sync preview停止

CSV import commitは許可する。ただし、未マッピングカテゴリがある場合は sync preview / sync job 作成 / Chrome拡張MVP入力補助を停止する。

メリット:

- 自社DB正本の整備と外部サイト反映準備を分離できる
- 外部サイト解析HOLD中でもメニュー台帳を整備できる
- 未マッピングカテゴリをAdmin UIで可視化し、後からcategory mappingできる
- CSV import previewとsync previewの責務が明確になる

デメリット:

- 正本には外部サイト反映未準備のカテゴリが入りうる
- sync前の停止UIと運用ルールが重要になる

### 推奨案

推奨は案B。

```txt
category mapping未設定でも CSV import commit は許可する。
ただし sync preview / sync job 作成 / Chrome拡張MVP入力補助は停止する。
```

理由:

- 自社DB正本の整備と外部サイト反映準備を分離できるため
- 外部サイト解析HOLD中でもMVP内部機能を進められるため
- 未マッピングカテゴリを後続のCategory Mapping UIで安全に解消できるため

必要なUI:

- import previewで未マッピングカテゴリをwarning表示
- commit確認で「外部サイト同期は停止される」ことを明示
- Menu item list / Category Mapping UI / Sync previewで未マッピングbadgeを表示

---

## 9. 実装前に必ず決めること

実装前に決めること。

1. DBエンジン
2. 認証方式
3. 管理画面技術スタック
4. API技術スタック
5. organization / store read API endpoint
6. sync job list API endpoint
7. audit log read API endpoint
8. CSV import session / batch / import job のDB方針
9. `error_logs` 独立テーブルを作るか
10. sync job target itemsを正規化するか
11. retry attemptの保存方式
12. category mapping未設定時のCSV import commit方針
13. ログ保持期間
14. request_id / trace_id の発行方式

---

## 10. Phase後送りにすること

Phase後送りにすること。

- Hotpepper実画面検証後のmapping確定
- 食べログ実画面検証
- ぐるなび実画面検証
- Chrome拡張MVPの実接続
- 外部サイトカテゴリ取得実装
- DOM差分閾値の実測調整
- DOM diff visualization
- mapping JSON publish workflow
- category mapping versions
- store mapping overrides
- 複数店舗一括同期
- AIカテゴリ候補
- CSVカテゴリ表記ゆれ学習
- Slack / メール通知
- 自動保存・自動公開の限定解禁検討

---

## 11. GO / HOLD / STOP 判定

| 領域 | 判定 | 理由 |
|---|---|---|
| Common Menu Model | GO | 外部サイト非依存で進められる |
| CSV import preview / validation / commit | GO | category mapping未設定でもcommit可、syncで停止する方針を推奨 |
| Internal Menu Admin | GO | 自社DB正本管理として進められる |
| Menu versioning | GO | `menu_items` / `menu_item_versions` 設計は整合済み |
| Rollback preview | GO | 新version作成方針で統一済み |
| Category Mapping UI | GO with HOLD | UI設計は進める。外部サイトカテゴリ取得方式はHOLD |
| Sync preview | GO with HOLD | preview設計は進める。外部サイト解析依存項目はHOLD |
| Sync job logs / Audit logs | GO with TODO | 既存DBで進める。`error_logs` 独立化はOPEN |
| Error handling / safe logging | GO | STOP条件と保存禁止情報は整合済み |
| Chrome拡張MVP実接続 | HOLD | 外部サイト解析とmapping実測待ち |
| 外部サイト解析 | HOLD | 実画面検証待ち |
| 自動保存 / 自動公開 / 自動削除 | STOP | MVPでは扱わない |
| `auto_submit_enabled=true` | STOP | DB制約・設計方針で禁止 |

総合判定:

```txt
GO: Internal MVP design and implementation preparation.
HOLD: External-site execution and Chrome extension real connection.
STOP: Auto-submit, auto-publish, auto-delete, and prohibited data logging.
```

---

## 12. 次アクション

1. `docs/14_api-mvp-design.md` に未定義APIを追記する
   - organization / store read
   - sync job list
   - audit log read
2. CSV import session / batch / import job のDB方針を決める
3. category mapping未設定時のCSV import commit方針を案Bで確定するか判断する
4. `error_logs` 独立テーブルをMVPで作るか判断する
5. DBエンジン、認証方式、管理画面/API技術スタックを決める
6. schema-draftの未決テーブルをMVP対象 / Phase後送りに分類する
7. 外部サイト解析HOLDの解除条件を定義する
8. STOP事項が実装タスクに混入していないか継続確認する
