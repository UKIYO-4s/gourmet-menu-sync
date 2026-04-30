# Sync Job Design

## 1. sync job の目的

このドキュメントは、Menu Sync System における同期ジョブの設計を定義する。

sync job は、自社DBまたはCSV importで確定された Common Menu Model を、外部サイト反映候補として扱うための作業単位である。MVPでは、sync job は「反映候補と操作ログ」であり、外部サイトへの自動保存・自動公開・削除実行を行わない。

sync job の責務は以下に限定する。

- 対象店舗、同期経路、外部サイト、mapping versionを紐づける
- 対象menu item / menu item versionを反映候補として扱う
- 外部サイト同期前のpreview / validation結果を保持する
- Chrome拡張MVPへ将来渡す入力補助リクエストの境界になる
- safety stop、失敗、再実行、ユーザー確認をログとして追跡する
- `auto_submit_enabled=false` を維持する

---

## 2. sync job が扱う範囲

MVPのsync jobが扱う範囲。

- 自社DB正本から外部サイトへの反映候補
- CSV import commit後の外部サイト反映候補
- rollback後の外部サイト反映候補
- 外部サイト同期前preview
- 同期前validation
- category mapping確認
- store identity確認結果の参照
- mapping version確認
- DOM差分critical有無の参照
- Chrome拡張MVPへのexecute request
- `sync_job_logs` への技術ログ記録
- `audit_logs` へのユーザー操作ログ記録
- `guardrail_events` への安全停止記録

---

## 3. sync job が扱わない範囲

MVPのsync jobは以下を扱わない。

- 外部サイトへの自動保存
- 外部サイトへの自動公開
- 外部サイト上の削除ボタン操作
- 外部サイト管理画面の解析そのもの
- Cookie / Session / Token の受信・保存
- 外部サイトのログインID / パスワード保存
- 生DOM全文の保存
- input value / hidden value の保存
- 外部サイト同士の直接変換
- AIによるカテゴリ自動確定
- 複数店舗一括同期
- 画像アップロード実行
- アレルゲン外部サイト反映

---

## 4. 関連テーブル

sync jobの主要テーブル。

| テーブル | 用途 |
|---|---|
| `sync_jobs` | 同期候補の本体。対象store、route、account、mapping version、statusを持つ |
| `sync_job_logs` | 技術的な実行ログ。値ではなくevent type、reason code、hash、score、件数を保存する |
| `audit_logs` | ユーザー操作・承認・安全停止確認などの監査ログ |
| `guardrail_events` | safety stop、identity mismatch、DOM critical diffなどのガードレール記録 |
| `menu_sync_routes` | Source -> Common Menu Model -> Target の同期経路 |
| `store_site_accounts` | 店舗と外部サイト接続情報。認証情報は持たない |
| `mapping_versions` | 外部サイト入力補助用mappingのバージョン |
| `category_mappings` | Commonカテゴリと外部サイトカテゴリの対応 |
| `store_site_identity_checks` | 店舗名、電話、住所、管理画面URL、外部店舗IDの照合 |
| `dom_diffs` | DOM差分。`critical` は停止条件になる |

---

## 5. sync job 作成タイミング

sync jobは、メニュー正本の変更が確定し、外部サイト同期前確認を通した後に作成する。

### 5.1 Admin Web編集後

```txt
1. ユーザーがMenu itemを作成/編集
2. 保存前previewを確認
3. menu_itemsを作成/更新
4. menu_item_versionsを作成
5. 外部サイト同期前確認を表示
6. ユーザーが同期候補作成を選ぶ
7. sync_jobsをpendingで作成
```

### 5.2 CSV import commit後

```txt
1. CSV upload
2. validate
3. import preview
4. human review
5. commit
6. menu_items / menu_item_versionsを作成/更新
7. 外部サイト同期前確認を表示
8. sync_jobsをpendingで作成
```

### 5.3 rollback後

```txt
1. rollback preview
2. human review
3. rollback確定
4. menu_item_versions(change_type=rollback)を作成
5. menu_item_rollbacksを作成
6. 外部サイト同期前確認を表示
7. 必要に応じてsync_jobs(job_type=rollbackまたはexport)を作成
```

### 5.4 作成時に必須の紐づけ

- `store_id`
- `route_id`
- `store_site_account_id`
- `mapping_version_id`
- `job_type`
- `started_by_user_id`
- 対象menu item id
- 対象menu item version id
- `summary_json`
- `auto_submit_enabled=false`

現行DDLでは対象menu item / versionの専用関連テーブルは未定義である。MVP設計では `sync_jobs.summary_json` に対象IDと件数を保持する案とし、必要に応じてPhase後続で関連テーブル化を検討する。

---

## 6. sync job status 一覧

`sync_jobs.status` は以下を使う。

| status | 意味 | 主な遷移元 | 主な遷移先 |
|---|---|---|---|
| `pending` | 同期候補が作成され、まだ実行要求されていない | 作成時 | `waiting_user_review` / `cancelled` / `blocked_by_safety_check` |
| `running` | Chrome拡張や将来workerが処理中 | `waiting_user_review` | `completed` / `failed` / `blocked_by_safety_check` |
| `waiting_user_review` | 人間確認待ち。外部サイト保存・公開前で停止している | `pending` / `running` | `running` / `completed` / `cancelled` / `blocked_by_safety_check` |
| `completed` | 入力補助または確認フローが完了した | `running` / `waiting_user_review` | なし |
| `failed` | 技術エラーやvalidation失敗で失敗した | `running` / `pending` | 再実行時は新しいsync jobを作る |
| `cancelled` | ユーザーまたは運用判断で中止した | `pending` / `waiting_user_review` | なし |
| `blocked_by_safety_check` | 安全条件を満たさず停止した | `pending` / `running` / `waiting_user_review` | 原因解消後に新しいsync jobを作る |

方針:

- `completed` は外部サイトへの公開完了を意味しない
- `waiting_user_review` は人間が外部サイト管理画面で確認する状態
- `blocked_by_safety_check` は危険状態であり、自動的に再開しない

---

## 7. sync job event_type 一覧

`sync_job_logs.event_type` は以下を基本とする。

| event_type | 用途 |
|---|---|
| `job_created` | sync job作成 |
| `preview_created` | sync preview作成 |
| `validation_started` | validation開始 |
| `validation_completed` | validation完了 |
| `validation_failed` | validation失敗 |
| `mapping_loaded` | mapping version読込 |
| `mapping_version_mismatch` | mapping version不一致 |
| `category_mapping_checked` | category mapping確認 |
| `unmapped_category_detected` | 未対応カテゴリ検出 |
| `store_identity_checked` | 店舗識別確認 |
| `store_identity_missing` | 店舗識別未確認 |
| `store_identity_mismatch` | 店舗識別不一致 |
| `dom_scanned` | サニタイズ済みDOM構造の確認 |
| `dom_diff_detected` | DOM差分検出 |
| `dom_critical_diff_detected` | critical DOM差分検出 |
| `fields_matched` | 入力対象フィールド照合 |
| `auto_fill_started` | 自動入力補助開始 |
| `auto_fill_completed` | 自動入力補助完了 |
| `user_review_required` | 人間確認待ち |
| `execute_requested` | Chrome拡張MVP向けexecute request作成 |
| `safety_stop` | 安全停止 |
| `job_completed` | sync job完了 |
| `job_failed` | sync job失敗 |
| `job_cancelled` | sync job中止 |
| `retry_requested` | 再実行要求 |

ログには外部サイトの入力値、生DOM、Cookie、Session、Token、hidden valueを含めない。

---

## 8. preview / validation / execution request の分離

sync jobでは以下を分離する。

```txt
external sync preview
  ↓
sync job create
  ↓
sync job validation
  ↓
human review
  ↓
execute request
  ↓
Chrome extension input assistance
  ↓
user manual save/publish outside system
```

### 8.1 preview

目的:

- 対象menu item / versionを確認する
- 変更前/変更後の差分を確認する
- 価格差分、status変更、カテゴリ対応を確認する
- mapping version / required extension versionを確認する
- safety stop候補を確認する

previewでは外部サイトに何も送信しない。

### 8.2 validation

目的:

- organization / store scopeを確認する
- role permissionを確認する
- route / mapping version / target accountの存在を確認する
- category mappingを確認する
- store identity checkが利用可能か確認する
- DOM critical diffが未解決でないか確認する
- `auto_submit_enabled=false` を確認する
- prohibited dataがsummary/logに混入していないか確認する

validation失敗時は `blocked_by_safety_check` または `failed` にする。

### 8.3 execution request

目的:

- Chrome拡張MVPへ入力補助リクエストを渡すための状態遷移
- `status=waiting_user_review` を基本にする
- 自動保存・自動公開・削除操作は要求しない

execution requestは、外部サイト管理画面でユーザーが最終確認する前提である。

---

## 9. 外部サイト同期前確認

外部サイト同期前確認は、sync job作成前またはsync job previewで必ず表示する。

表示内容:

- 対象organization / store
- 対象外部サイト
- `store_site_account_id`
- `menu_sync_routes`
- 対象menu item / version
- 変更前/変更後
- 価格差分
- `publish_status` 変更
- 未対応カテゴリ
- `mapping_version_id`
- `mapping_versions.required_extension_version`
- store identity状態
- DOM差分状態
- safety stop候補
- `auto_submit_enabled=false`

方針:

- 確認画面は同期候補作成前の人間確認ポイントである
- 未対応カテゴリ、identity未確認、mapping不一致、critical DOM diffがある場合は同期候補作成またはexecute requestを停止する
- 「外部サイトへ自動保存しない」「外部サイトへ自動公開しない」を明示する

---

## 10. 停止条件

### 10.1 category mapping未設定時の停止

停止条件:

- 対象menu itemの `category_name` に対応する `category_mappings` がない
- mapping先の `site_store_categories.status` が `hidden` / `deleted`
- `confidence_score` が運用閾値を下回る

処理:

- `sync_jobs.status=blocked_by_safety_check`
- `sync_job_logs(event_type=unmapped_category_detected)`
- `guardrail_events(guardrail_type=category_mapping, reason_code=unmapped_category, must_stop=true)`
- Admin UIでCategory mapping画面への導線を表示する

### 10.2 store identity未確認時の停止

停止条件:

- `store_site_identity_checks` が未作成
- 必須check_typeが `missing` / `mismatch`
- `match_score` が閾値未満
- 管理画面URLまたは外部店舗IDが確認できない

処理:

- `sync_jobs.status=blocked_by_safety_check`
- `sync_job_logs(event_type=store_identity_missing or store_identity_mismatch)`
- `guardrail_events(guardrail_type=store_identity, reason_code=store_identity_not_verified, must_stop=true)`

### 10.3 mapping_version不一致時の停止

停止条件:

- `mapping_versions.status` が `published` ではない
- sync job作成時の `mapping_version_id` と配信対象versionが一致しない
- `required_extension_version` を満たさない
- mapping JSON内に `autoSubmit=true` または `auto_submit_enabled=true` が含まれる

処理:

- `sync_jobs.status=blocked_by_safety_check`
- `sync_job_logs(event_type=mapping_version_mismatch)`
- `guardrail_events(guardrail_type=mapping_version, reason_code=mapping_version_mismatch, must_stop=true)`

### 10.4 DOM差分critical時の停止

停止条件:

- 未解決の `dom_diffs.severity=critical`
- `dom_diffs.must_stop=true`
- 必須フィールド未検出
- field hash / selector / labelのcritical差分

処理:

- `sync_jobs.status=blocked_by_safety_check`
- `sync_job_logs(event_type=dom_critical_diff_detected)`
- `guardrail_events(guardrail_type=dom_diff, reason_code=critical_dom_diff, must_stop=true)`
- mapping更新または外部サイト解析完了までexecute requestを出さない

### 10.5 prohibited data検出時の停止

停止条件:

- request / summary / log候補に保存禁止情報が含まれる
- Cookie / Session / Token / CSRF tokenらしき文字列がある
- 生DOM / outerHTML / input value / hidden valueが含まれる

処理:

- `sync_jobs.status=blocked_by_safety_check`
- `sync_job_logs(event_type=safety_stop)`
- `guardrail_events(guardrail_type=prohibited_data, reason_code=prohibited_data_detected, must_stop=true)`
- 該当値は保存せず、理由コードだけ保存する

---

## 11. auto_submit_enabled=false の強制

sync jobでは `auto_submit_enabled=false` を常に強制する。

対象:

- `store_site_accounts.auto_submit_enabled`
- `sync_jobs.auto_submit_enabled`
- `mapping_versions.mapping_json.submit.autoSubmit`
- `mapping_versions.mapping_json.submit.auto_submit_enabled`
- `mapping_versions.mapping_json.safety.autoSubmit`
- `mapping_versions.mapping_json.safety.auto_submit_enabled`
- `mapping_versions.safety_json.auto_submit_enabled`

方針:

- `sync_jobs` 作成時に `auto_submit_enabled=false` を設定する
- DB制約でも `CHECK (auto_submit_enabled = FALSE)` を維持する
- API validationでtrue混入を拒否する
- Admin UIにtrueへ変更するUIを作らない
- Chrome拡張MVPへ自動保存・自動公開要求を渡さない

trueが検出された場合:

- `auto_submit_not_allowed`
- `sync_jobs.status=blocked_by_safety_check`
- `sync_job_logs(event_type=safety_stop)`
- `guardrail_events(reason_code=auto_submit_not_allowed, must_stop=true)`

---

## 12. sync_job_logs に残す内容

`sync_job_logs` は技術ログであり、値そのものではなく追跡に必要なメタ情報を保存する。

保存してよい内容:

- `sync_job_id`
- `log_level`
- `event_type`
- 人間向け短文message
- reason code
- target count
- affected menu item id
- affected menu item version id
- route id
- mapping version id
- required extension version
- extension version
- match score
- page hash
- snapshot hash
- field hash
- category count
- warning count
- error count
- safety stop reason
- timestamp

保存しない内容:

- 外部サイトログインID
- 外部サイトパスワード
- Cookie
- Session
- Token
- CSRF token
- Authorization header
- 生DOM
- outerHTML
- input value
- hidden value
- 顧客個人情報
- 問い合わせ内容

`details_json` は、保存可能なID、hash、score、reason code、件数だけを持つ。

---

## 13. audit_logs に残す内容

`audit_logs` はユーザー操作の監査ログである。

event_type候補:

- `sync_candidate_created`
- `sync_job_created`
- `sync_preview_viewed`
- `sync_validation_failed`
- `sync_execute_requested`
- `sync_job_cancelled`
- `sync_retry_requested`
- `safety_stop_acknowledged`
- `sync_job_completed`
- `sync_job_failed`

保存する内容:

- `organization_id`
- `store_id`
- `user_id`
- `event_type`
- `target_type=sync_job`
- `target_id`
- `result`
- reason code
- mapping version id
- route id
- target count
- timestamp

保存しない内容:

- メニュー本文の詳細値
- 外部サイト入力値
- 認証情報
- Cookie / Session / Token
- 生DOM
- input value
- 個人情報を含む自由入力

---

## 14. 失敗時の扱い

失敗は大きく2種類に分ける。

### 14.1 validation / safety failure

例:

- 未対応カテゴリ
- store identity mismatch
- mapping version不一致
- critical DOM diff
- `auto_submit_enabled=true`
- prohibited data detected

扱い:

- `sync_jobs.status=blocked_by_safety_check`
- `guardrail_events.must_stop=true`
- Admin UIに停止理由と解消導線を表示する
- 原因解消までexecute requestを出さない

### 14.2 technical failure

例:

- API timeout
- Chrome拡張MVPからのreport失敗
- mapping version取得失敗
- 想定外例外

扱い:

- `sync_jobs.status=failed`
- `sync_job_logs(event_type=job_failed, log_level=error)`
- `audit_logs(result=failure)`
- 再実行は原則、新しいsync jobとして作る

---

## 15. 再実行方針

再実行は、既存sync jobを直接巻き戻さず、新しいsync jobを作成する。

理由:

- 過去ログを追記型で保持するため
- mapping versionやmenu item versionが変わる可能性があるため
- safety stop原因の解消前後を追跡するため

再実行フロー:

```txt
1. failed / blocked sync jobを確認
2. 原因を解消
3. 対象menu item versionを再確認
4. 外部サイト同期前確認を再表示
5. 新しいsync_jobsをpendingで作成
6. 古いsync jobにはretry_requestedログを残す
```

方針:

- `completed` / `cancelled` / `failed` / `blocked_by_safety_check` のstatusを再利用してrunningへ戻さない
- 再実行元sync job idは `summary_json` または将来の関連テーブルで参照できるようにする
- 同じ原因で再停止した場合も新しい `guardrail_events` を作る

---

## 16. rollbackとの関係

rollbackは過去versionを直接復元せず、新しい `menu_item_versions(change_type=rollback)` を作る。

sync jobとの関係:

- rollback previewでは現在状態との差分を表示する
- rollback確定後、必要に応じて外部サイト同期前確認を表示する
- rollback後の反映候補は新しいsync jobとして作成する
- rollback元・先のversion idは `menu_item_rollbacks` に保存する
- sync jobにはrollback後のmenu item version idを対象として持たせる

方針:

- rollback実行と外部サイト反映は分離する
- rollback確定だけで外部サイトへ自動反映しない
- rollback由来のsync jobでも通常のcategory mapping / identity / mapping version / DOM差分確認を通す

---

## 17. Chrome拡張MVPとの接続点

Chrome拡張MVPとは将来以下のAPIで接続する。

```txt
GET  /extension/me
GET  /extension/stores
GET  /extension/mapping-versions?site={site_key}&page={page_key}
GET  /extension/sync-jobs/{sync_job_id}
POST /extension/sync-jobs/{sync_job_id}/report
POST /extension/dom-snapshots
POST /extension/safety-stops
```

接続方針:

- Admin Webと同じ認証・認可基盤を使う
- 拡張は外部サイト認証情報を送らない
- 拡張はサニタイズ済みDOM構造情報のみ送る
- 拡張はinput value / hidden value / 生DOMを送らない
- 拡張は保存・公開・削除クリックを自動実行しない
- 拡張からのreportは `sync_job_logs` と `guardrail_events` に変換して保存する

execute requestの意味:

- 入力補助を開始してよいという管理画面側の要求
- 外部サイト保存・公開の許可ではない
- 最終保存・公開はユーザーが外部サイト管理画面で手動確認して行う

---

## 18. 外部サイト解析待ちの扱い

外部サイト管理画面の解析が未完了、またはmappingが未公開の場合、sync jobは実行可能にしない。

代表状態:

- `site_pages` が未定義
- `mapping_versions.status != published`
- 必須field mappingが未定義
- `required_extension_version` が未確定
- `site_store_categories` が未取得
- `store_site_identity_checks` が未作成
- 未解決のcritical `dom_diffs` がある

扱い:

- sync previewで「外部サイト解析待ち」と表示する
- `sync_jobs` を作る場合は `pending` ではなく `blocked_by_safety_check` とするか、作成前に停止する
- `guardrail_events(reason_code=external_site_analysis_pending)` を残す
- 外部サイト管理画面の解析作業自体はこのドキュメントの対象外

---

## 19. セキュリティ・プライバシー方針

sync job関連API、logs、audit logs、summary_json、details_jsonでは以下を保存しない。

```txt
external_site_login_id
external_site_password
cookie
session
token
csrf_token
authorization_header
input_value
hidden_value
raw_dom
outer_html
local_storage
indexed_db
customer_personal_data
```

店舗識別に必要な店舗名、住所、電話番号、管理画面URL、外部店舗IDは、`store_site_identity_checks` 等の限定された用途でのみ扱う。

---

## 20. MVPで扱う範囲

MVPで扱う範囲。

- 1店舗単位のsync job
- Admin Web編集後の外部サイト反映候補
- CSV import commit後の外部サイト反映候補
- rollback後の外部サイト反映候補
- `job_type=export`
- `job_type=rollback`
- `job_type=dom_scan`
- `job_type=identity_check`
- sync preview
- sync validation
- execute request設計
- sync job status管理
- sync job logs表示
- safety stop表示
- `auto_submit_enabled=false` 強制

---

## 21. MVPで扱わない範囲

MVPでは扱わない範囲。

- 外部サイトへの自動保存
- 外部サイトへの自動公開
- 外部サイトの削除操作
- 外部サイト管理画面の解析UI
- 外部サイト同士の直接同期
- 複数店舗一括同期
- job queue / workerの実装詳細
- 高度なretry scheduler
- DOM diff visualization
- mapping publish workflow
- 画像アップロード同期
- アレルゲン外部サイト反映
- AIカテゴリ自動確定

---

## 22. Phase後送り

- sync job target items専用テーブル
- retry元sync job参照カラム
- job queue / worker実装
- Chrome拡張MVP report schema詳細
- DOM diff visualization
- mapping JSON publish workflow
- 複数店舗一括同期
- sync job SLA / timeout設計
- notification / alert設計
- sync job retention policy
- external site analysis workflow
- 自動保存・自動公開の限定解禁

---

## 23. TODO

- [ ] `sync_jobs.summary_json` のschemaを定義する
- [ ] `sync_job_logs.details_json` のschemaを定義する
- [ ] sync job target item関連テーブルを作るか決める
- [ ] retry元sync job idの保存方法を決める
- [ ] sync job list APIの正式エンドポイントを `docs/14_api-mvp-design.md` に追加する
- [ ] `guardrail_events.details_json` の保存可能フィールドを定義する
- [ ] category mapping confidenceの停止閾値を決める
- [ ] store identity match_scoreの停止閾値を決める
- [ ] mapping version不一致時のUI文言を `docs/15_admin-ui-mvp-design.md` と整合させる
- [ ] Chrome拡張MVPのreport payloadを別ドキュメントで定義する
