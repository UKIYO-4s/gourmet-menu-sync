# Error Handling and Logging Design

## 1. 基本方針

このドキュメントは、Menu Sync System において、CSV取り込み、Common Menu Model変換、管理画面操作、カテゴリマッピング、sync job、Chrome拡張MVP、外部サイト反映候補作成の各工程でエラーが発生した場合の停止条件、復旧手順、ログ記録方針を定義する。

基本方針:

- エラーは隠さず記録する
- 不明な状態では処理を進めない
- 自動リトライはMVPでは原則禁止
- 人間確認を挟んで再実行する
- 外部サイト側の保存・公開・削除は自動実行しない
- `auto_submit_enabled=false` を維持する
- Cookie / Session / Token / 生DOM / input value は扱わない
- エラーログにも保存禁止情報を残さない

MVPでは、復旧速度よりも誤更新・誤公開・情報漏洩を防ぐことを優先する。

---

## 2. エラー分類

| error class | 意味 | 主な発生箇所 |
|---|---|---|
| `validation_error` | 入力値、必須項目、enum、日付、価格などの検証失敗 | CSV import、Admin UI、API |
| `mapping_error` | mapping version、Mapping JSON、target field対応の不整合 | sync preview、Chrome拡張MVP |
| `category_mapping_error` | Commonカテゴリと外部サイトカテゴリの対応不備 | import preview、sync preview、sync job |
| `import_error` | CSV upload / parse / normalize / commitの失敗 | CSV import |
| `conversion_error` | Common Menu Modelへの変換失敗 | CSV、Admin form、adapter |
| `permission_error` | role権限不足 | Admin UI、API |
| `store_scope_error` | organization / store / resource scope不一致 | API、Admin UI、Chrome拡張MVP |
| `sync_preview_error` | 外部サイト同期前previewの作成失敗 | Admin UI、API |
| `sync_job_error` | sync job作成・状態遷移・ログ記録の失敗 | sync job |
| `dom_detection_error` | DOM構造検出・field match失敗 | Chrome拡張MVP |
| `dom_diff_error` | DOM差分検出またはcritical差分 | Chrome拡張MVP、mapping validation |
| `external_site_unavailable` | 外部サイト管理画面が利用できない、対象画面ではない | Chrome拡張MVP |
| `extension_version_error` | required extension versionを満たさない | Chrome拡張MVP |
| `security_violation` | 保存禁止情報混入、auto submit有効化、危険操作検出 | 全工程 |
| `unknown_error` | 分類不能な想定外エラー | 全工程 |

---

## 3. severity

| severity | 意味 | 処理継続 | 例 |
|---|---|---|---|
| `info` | 通常の状態変化・参考情報 | 継続可 | preview作成、validation開始 |
| `warning` | 人間確認が必要だが、直ちに危険ではない | 条件付き継続可 | 価格差分大、低confidence候補 |
| `error` | 対象操作は失敗。修正または再実行が必要 | 対象操作は停止 | CSV行エラー、権限不足 |
| `critical` | 危険状態。誤更新・誤公開・情報漏洩の可能性あり | 必ず停止 | DOM critical diff、scope不一致、保存禁止情報混入 |

方針:

- `critical` は必ず処理停止し、`guardrail_events.must_stop=true` を記録する
- `error` は対象操作を停止し、人間による修正後に再実行する
- `warning` はpreviewで明示し、commit / execute request前に人間確認を必須にする
- `info` は状態追跡のために記録する

---

## 4. 処理停止条件

以下の場合は必ず停止する。

- organization / store scope が一致しない
- category mapping が未設定
- mapping_version が不一致
- required_extension_version を満たさない
- DOM critical diff が検出された
- 店舗識別ができない
- 保存禁止情報が混入した可能性がある
- `auto_submit_enabled=true` が検出された
- 外部サイトの保存 / 公開 / 削除ボタンを押す必要がある操作
- CSV validation error が一定数を超えた場合
- rollback対象versionが特定できない場合

停止時の共通処理:

- 対象操作を中断する
- ユーザー向けに安全なエラーメッセージを表示する
- `sync_job_logs`、`audit_logs`、必要に応じて `guardrail_events` に記録する
- 保存禁止情報はログ・レスポンス・UIに出さない
- 自動リトライしない

---

## 5. ログの種類

| ログ | 役割 | MVPでの保存先 |
|---|---|---|
| `sync_job_logs` | sync job、Chrome拡張MVP、同期候補の技術ログ | `sync_job_logs` |
| `audit_logs` | ユーザー操作、承認、停止確認の監査ログ | `audit_logs` |
| `import_logs` | CSV upload / parse / normalize / validate / commitのログ | MVPでは `audit_logs` と将来import sessionに集約 |
| `validation_logs` | validation開始・失敗・警告のログ | MVPでは `sync_job_logs` または `audit_logs` に集約 |
| `error_logs` | アプリケーション横断のエラーログ | MVPでは専用テーブル未定義。追加検討 |
| `dom_diff_logs` | DOM差分、critical diff、安全停止のログ | `dom_diffs`、`sync_job_logs`、`guardrail_events` |
| `security_event_logs` | 保存禁止情報、scope不一致、auto submit検出など | `guardrail_events`、`audit_logs` |
| `devlog` | 開発作業の記録。運用ログではない | `devlog/YYYY-MM-DD.md` |

方針:

- MVPでは既存の `sync_job_logs`、`audit_logs`、`guardrail_events` を優先する
- `import_logs`、`validation_logs`、`error_logs` の専用テーブル追加はTODOで検討する
- devlogに本番の機密情報・顧客情報・外部サイト管理画面情報を書かない

---

## 6. ログに記録する項目

共通ログ項目。

| 項目 | 説明 |
|---|---|
| `log_id` | ログID |
| `timestamp` | 発生時刻 |
| `organization_id` | organization scope |
| `store_id` | store scope |
| `user_id` | 操作ユーザー |
| `role` | 操作時role |
| `operation_type` | import / transform / mapping / sync / rollback / extension等 |
| `event_type` | イベント種別 |
| `severity` | info / warning / error / critical |
| `error_code` | 機械処理可能なエラーコード |
| `error_message_safe` | 保存禁止情報を含まない安全なメッセージ |
| `related_resource_type` | menu_item / sync_job / mapping等 |
| `related_resource_id` | 対象ID |
| `sync_job_id` | 関連sync job |
| `import_job_id` | 関連import job。MVPではimport session候補ID |
| `mapping_version_id` | 関連mapping version |
| `request_id` | API request追跡ID |
| `trace_id` | 複数処理をまたぐ追跡ID |
| `result_status` | success / failure / blocked |
| `next_action` | ユーザーまたは運用者が次に行うこと |
| `created_at` | DB保存時刻 |

MVPのDDLに存在しない項目は、`details_json`、`summary_json`、または将来の専用ログテーブルで扱う。

---

## 7. ログに記録してはいけないもの

以下は禁止。

- パスワード
- Cookie
- Session
- Token
- CSRF token
- 認証情報
- input value
- 生DOM
- outerHTML
- 住所全文
- 電話番号
- メールアドレス
- 個人名
- 自由入力欄の全文
- 外部サイト管理画面のスクリーンショット

方針:

- 店舗識別に必要な住所・電話番号も、エラーログには原則保存しない
- 必要な場合は専用テーブルで目的限定・マスク済み・最小限にする
- エラーUIにも保存禁止情報を表示しない

---

## 8. エラーコード設計

エラーコードはprefixで発生領域を表す。

| prefix | 領域 | 例 |
|---|---|---|
| `CSV_*` | CSV import | `CSV_PARSE_FAILED`, `CSV_REQUIRED_COLUMN_MISSING`, `CSV_TOO_MANY_VALIDATION_ERRORS` |
| `CMM_*` | Common Menu Model変換 | `CMM_REQUIRED_FIELD_MISSING`, `CMM_PRICE_CONVERSION_FAILED`, `CMM_INVALID_SEASONAL_DATE` |
| `MAP_*` | Mapping JSON / mapping version | `MAP_VERSION_MISMATCH`, `MAP_NOT_PUBLISHED`, `MAP_REQUIRED_FIELD_MISSING` |
| `CAT_*` | category mapping | `CAT_UNMAPPED_CATEGORY`, `CAT_TARGET_CATEGORY_DELETED`, `CAT_MULTIPLE_CANDIDATES` |
| `SYNC_*` | sync job / sync preview | `SYNC_PREVIEW_FAILED`, `SYNC_JOB_CREATE_FAILED`, `SYNC_EXECUTE_REQUEST_BLOCKED` |
| `DOM_*` | DOM検出 / DOM差分 | `DOM_DETECTION_FAILED`, `DOM_CRITICAL_DIFF`, `DOM_MATCH_SCORE_LOW` |
| `EXT_*` | Chrome拡張MVP | `EXT_VERSION_UNSUPPORTED`, `EXT_MAPPING_FETCH_FAILED`, `EXT_REPORT_FAILED` |
| `AUTH_*` | 認証・認可・scope | `AUTH_FORBIDDEN`, `AUTH_STORE_SCOPE_MISMATCH`, `AUTH_ROLE_NOT_ALLOWED` |
| `SEC_*` | セキュリティ違反 | `SEC_PROHIBITED_DATA_DETECTED`, `SEC_AUTO_SUBMIT_NOT_ALLOWED`, `SEC_PROHIBITED_ACTION_DETECTED` |
| `DB_*` | DB永続化 | `DB_WRITE_FAILED`, `DB_VERSION_CONFLICT`, `DB_RESOURCE_NOT_FOUND` |
| `UNKNOWN_*` | 不明 | `UNKNOWN_ERROR`, `UNKNOWN_UNEXPECTED_STATE` |

方針:

- エラーコードは機械処理可能な固定文字列にする
- ユーザー向けmessageと開発者向けdetailsを分ける
- 保存禁止情報をコード・message・detailsに含めない

---

## 9. ユーザー向けエラーメッセージ

方針:

- 技術詳細を出しすぎない
- 次に何をすればいいかを表示する
- 保存禁止情報を表示しない
- operator / admin / owner で表示粒度を変える
- viewerには詳細エラーを出さない

表示粒度:

| role | 表示する内容 |
|---|---|
| owner | 停止理由、影響範囲、対象件数、次アクション |
| admin | 停止理由、対象ID、解消導線、再実行可否 |
| operator | 自分が実行可能な修正手順、管理者依頼導線 |
| viewer | 操作が停止した事実、問い合わせ先、概要 |

例:

```txt
同期候補を作成できません。
未対応カテゴリがあります。Category mapping画面で対応付けを確認してください。
```

---

## 10. 開発者向けログ

開発者向けログは、safeな範囲で原因調査に必要な情報を残す。

必須:

- `trace_id`
- `request_id`
- `sync_job_id`
- `import_job_id`
- `mapping_version_id`
- error class
- error code
- severity
- result status
- reason code

方針:

- 生データではなく要約・ハッシュ・件数を記録する
- CSV全文、DOM全文、input valueは保存しない
- stack traceは保存禁止情報を含まないことを確認してから扱う
- 本番では詳細stack traceをユーザーに返さない

---

## 11. CSV import エラー時の流れ

### 11.1 upload

起こりうるエラー:

- ファイル未指定
- サイズ超過
- CSVでない
- 禁止カラム名検出

扱い:

- 禁止情報疑いは `critical` として停止
- その他は `validation_error` として修正要求
- `menu_items` / `menu_item_versions` は更新しない

### 11.2 parse

起こりうるエラー:

- 文字コード不明
- ヘッダー行なし
- 行形式不正
- 列数不一致

扱い:

- ファイル全体が読めない場合は停止
- 行単位エラーは件数を記録し、閾値超過で停止

### 11.3 normalize

起こりうるエラー:

- 価格正規化失敗
- 税区分正規化失敗
- status正規化失敗
- 日付形式不正

扱い:

- 行単位errorとしてpreviewに表示
- 正常行だけ取り込む場合も人間確認を必須にする

### 11.4 validate

起こりうるエラー:

- 必須カラム不足
- 必須値不足
- 重複候補
- 未対応カテゴリ
- 禁止情報疑い

扱い:

- 必須カラム不足と禁止情報疑いは停止
- 未対応カテゴリはimport commit自体は可能だが、syncでは停止
- validation error件数が閾値を超えた場合は停止

### 11.5 preview

起こりうるエラー:

- 既存menu itemとの差分生成失敗
- version conflict
- 削除候補が多すぎる

扱い:

- preview生成失敗はcommit不可
- 削除候補・非公開化候補は人間確認必須

### 11.6 commit

起こりうるエラー:

- DB書き込み失敗
- version conflict
- role権限不足
- scope不一致

扱い:

- `menu_items` / `menu_item_versions` の部分更新を避ける
- 失敗時は `audit_logs(result=failure)` を残す
- 再実行は原因確認後に手動で行う

---

## 12. Common Menu Model 変換エラー時の流れ

| エラー | 扱い |
|---|---|
| 必須項目不足 | `CMM_REQUIRED_FIELD_MISSING`。対象行または対象フォームを停止 |
| price変換失敗 | `CMM_PRICE_CONVERSION_FAILED`。行単位error。外部同期不可 |
| tax_policy不明 | `CMM_INVALID_TAX_POLICY` またはwarning。人間確認必須 |
| status不明 | `CMM_INVALID_STATUS`。commit不可 |
| seasonal date不正 | `CMM_INVALID_SEASONAL_DATE`。対象itemを停止 |
| category不明 | `CAT_UNMAPPED_CATEGORY`。importは可能な場合あり、syncは停止 |

方針:

- Common Menu Model変換結果は候補であり、commit前にpreview / validationを通す
- 変換不能な値を `raw_source_json` に無制限保存しない
- 保存禁止情報が疑われる場合は変換処理自体を停止する

---

## 13. category mapping エラー時の流れ

| エラー | 停止 / 確認 | 復旧 |
|---|---|---|
| 未マッピング | sync停止 | Category mapping画面で手動対応 |
| 複数候補 | 人間確認必須。自動確定しない | owner/adminが1件を選ぶ、またはCommonカテゴリを分ける |
| 削除済みカテゴリ | sync停止 | 外部サイトカテゴリ再取得または再マッピング |
| 外部サイトカテゴリ未取得 | sync停止 | 外部サイト解析待ち、または手動登録 |
| store_mapping_overrides不一致 | MVPでは専用処理なし。設定不整合として停止 | 将来DDL確定後に再設計 |

ログ:

- `sync_job_logs(event_type=unmapped_category_detected)`
- `guardrail_events(guardrail_type=category_mapping)`
- `audit_logs(event_type=category_mapping_updated)` または `sync_validation_failed`

---

## 14. sync job エラー時の流れ

| エラー | 扱い |
|---|---|
| preview失敗 | `SYNC_PREVIEW_FAILED`。sync job作成不可または`failed` |
| validation失敗 | `SYNC_VALIDATION_FAILED`。`blocked_by_safety_check` |
| execution_request失敗 | `SYNC_EXECUTE_REQUEST_FAILED`。`failed` |
| mapping_version不一致 | `MAP_VERSION_MISMATCH`。`blocked_by_safety_check` |
| extension_version不一致 | `EXT_VERSION_UNSUPPORTED`。`blocked_by_safety_check` |
| store identity不一致 | `SYNC_STORE_IDENTITY_MISMATCH`。`blocked_by_safety_check` |
| DOM critical diff | `DOM_CRITICAL_DIFF`。`blocked_by_safety_check` |
| 外部サイト unavailable | `SYNC_EXTERNAL_SITE_UNAVAILABLE`。`failed` または `blocked_by_safety_check` |

方針:

- `blocked_by_safety_check` は自動再開しない
- `failed` も同じsync jobをrunningへ戻さない
- 原因解消後に新しいattemptとして記録する
- `auto_submit_enabled=false` は常に検証する

---

## 15. Chrome拡張MVP エラー時の流れ

以下の場合は停止し、ログに残す。

| エラー | 扱い |
|---|---|
| mapping JSON取得失敗 | `EXT_MAPPING_FETCH_FAILED`。入力補助を開始しない |
| required_extension_version不一致 | `EXT_VERSION_UNSUPPORTED`。入力補助を開始しない |
| DOM検出失敗 | `DOM_DETECTION_FAILED`。入力補助を開始しない |
| match_score不足 | `DOM_MATCH_SCORE_LOW`。人間確認またはmapping更新まで停止 |
| prohibited action検出 | `SEC_PROHIBITED_ACTION_DETECTED`。critical停止 |
| 保存/公開/削除ボタン検出 | `SEC_PROHIBITED_ACTION_DETECTED`。自動クリックしない |
| 店舗識別失敗 | `SYNC_STORE_IDENTITY_MISMATCH`。入力補助を開始しない |

ログ方針:

- 拡張は外部サイト認証情報を送らない
- 拡張はサニタイズ済みDOM構造情報のみ送る
- 生DOM、input value、hidden valueを送らない
- reportは `sync_job_logs` と `guardrail_events` に変換する

---

## 16. retry方針

MVPでは自動リトライしない。

方針:

- ユーザーまたは運用者が原因を確認してから手動再実行する
- 同じsync jobを再実行するのではなく、新しいattemptとして記録する
- `attempt_number` を持つ
- `retry_reason` を記録する
- retry時も `auto_submit_enabled=false` を維持する
- retry時もpreview / validation / human reviewを通す

MVPのDDLでは `attempt_number` と `retry_reason` の専用カラムは未定義である。初期案では `sync_jobs.summary_json` または将来のattempt tableで扱う。

---

## 17. rollbackとの関係

方針:

- rollbackは過去versionに直接戻すのではなく、新しいversionを作る
- rollback実行理由を `audit_logs` に残す
- rollback失敗時は `critical`
- rollback対象が特定できない場合は停止
- rollback後の外部サイト反映は別sync jobとして扱う

停止条件:

- rollback対象versionが存在しない
- 対象menu itemとversionのstore scopeが一致しない
- version chainが不整合
- rollback previewが生成できない

---

## 18. incident response

インシデント対応は以下の流れにする。

| step | 内容 |
|---|---|
| detect | エラー、security violation、safety stopを検知する |
| stop | 対象sync job、import、extension操作を停止する |
| isolate | 対象organization / store / sync jobを切り分ける |
| notify | 必要な管理者・運用者に通知する |
| investigate | `trace_id`、`request_id`、`sync_job_id`、`audit_logs` を確認する |
| fix | mapping、category mapping、CSV、権限、拡張versionなど原因を修正する |
| verify | preview / validation を再実行し、安全条件を確認する |
| resume | 人間確認後に新しいattemptとして再実行する |
| record | 対応内容をaudit logまたはdevlogに記録する |

方針:

- 情報漏洩疑いがある場合は該当ログの保存禁止情報混入を確認する
- 必要に応じてログ削除・マスクを検討する
- 原因が不明なまま再開しない

---

## 19. MVPで扱う範囲

MVPで扱う範囲。

- CSV import validation error
- Common Menu Model conversion error
- category mapping missing
- sync job preview error
- extension version mismatch
- DOM detection failed
- DOM critical diff
- security violation
- rollback target missing
- `sync_job_logs` / `audit_logs` / `guardrail_events` による記録
- `auto_submit_enabled=false` の検証

---

## 20. MVPで扱わない範囲

MVPでは扱わない範囲。

- 自動復旧
- 自動リトライ
- 外部サイト自動保存
- 外部サイト自動公開
- 外部サイト自動削除
- AIによる自動判断での修正
- 生DOM保存による詳細解析
- 専用error log基盤の本格実装
- Slack / メール通知の本格実装

---

## 21. TODO

- [ ] error_code一覧の確定
- [ ] DBに `error_logs` テーブルを追加するか検討
- [ ] `sync_job_logs` で十分か検討
- [ ] `request_id` / `trace_id` の発行方式
- [ ] ログ保持期間
- [ ] 通知先
- [ ] Slack/メール通知のPhase後送り判断
- [ ] 本番監視設計
- [ ] `attempt_number` / `retry_reason` の保存場所を決める
- [ ] import job / import session のログ保存schemaを定義する
