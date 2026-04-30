# Design Consistency Check

## 1. 整合性チェックの目的

このドキュメントは、Menu Sync System の設計ドキュメント間の整合性を確認し、DB・API・UI・Sync Job・Category Mapping・Error Handling・Security の矛盾や未決事項を洗い出すための確認メモである。

この文書では矛盾・不足・TODOを記録するだけで、既存設計ドキュメントや実装コードは修正しない。

---

## 2. チェック対象ドキュメント一覧

| 種別 | ファイル |
|---|---|
| DB設計 | `docs/03_database-design.md` |
| Sync flow | `docs/07_sync-flow.md` |
| Failure / countermeasures | `docs/08_failure-and-countermeasures.md` |
| Security | `docs/09_security-policy.md` |
| Common Menu Model | `docs/11_common-menu-model.md` |
| CSV import | `docs/12_csv-import-design.md` |
| Internal Admin | `docs/13_internal-menu-admin-design.md` |
| API MVP | `docs/14_api-mvp-design.md` |
| Admin UI MVP | `docs/15_admin-ui-mvp-design.md` |
| Sync Job | `docs/16_sync-job-design.md` |
| Category Mapping | `docs/17_category-mapping-operation-design.md` |
| Error Handling / Logging | `docs/18_error-handling-and-logging-design.md` |
| Schema draft | `database/schema-draft.sql` |
| ERD notes | `database/erd-notes.md` |

---

## 3. DB / API / UI / Sync Job の対応確認

| 項目 | 確認結果 | メモ |
|---|---|---|
| Menu sections | OK | UI `Menu sections`、API `menu-sections`、DB `menu_sections` が対応している |
| Menu items | OK | UI `Menu item list/edit`、API `menu-items`、DB `menu_items` / `menu_item_versions` が対応している |
| CSV import | PARTIAL | APIは upload / preview / validate / commit / errors を定義。DBにはimport session / import job専用テーブルが未定義 |
| Category mapping | OK | UI、API、DB `category_mappings` / `site_store_categories` が対応している |
| Sync job | PARTIAL | API create / preview / execute_request / status / logs とDB `sync_jobs` / `sync_job_logs` は対応。list APIはTODO |
| Rollback | OK | API rollback-preview / rollback、DB `menu_item_rollbacks`、UI Rollback preview が対応している |
| Audit log | PARTIAL | DB `audit_logs` は存在。UI `Audit log view` とAPIのread APIはあるが、具体endpointは未定義 |
| Error logs | TODO | `docs/18` で専用 `error_logs` テーブル追加を検討TODO化済み。現行DBには未定義 |

---

## 4. menu_item_versions の作成タイミング確認

確認結果: OK。

各文書の方針:

- `docs/12_csv-import-design.md`: CSV import preview確認後、commit時に `menu_item_versions(change_type=import)` を作成する
- `docs/13_internal-menu-admin-design.md`: 管理画面での新規作成・編集・非公開化・削除候補確定時に `menu_item_versions` を作成する
- `docs/14_api-mvp-design.md`: `POST` / `PATCH` 確定時、CSV commit時、rollback時にversionを作る
- `docs/15_admin-ui-mvp-design.md`: preview段階では作らず、保存/commit/rollback確定時に作る
- `docs/16_sync-job-design.md`: sync jobは確定済みversionを反映候補として参照する
- `database/schema-draft.sql`: `menu_item_versions` と `menu_items.current_version_id` が存在する

結論:

- CSV upload / preview / validate段階では作成しない
- CSV commit、管理画面編集確定、rollback確定時に作成する
- sync job作成時には新しいmenu item versionを作らず、対象versionを参照する

---

## 5. rollback 方針の統一確認

確認結果: OK。

統一されている方針:

- 既存versionを上書きしない
- 過去versionを元に新しい `menu_item_versions(change_type=rollback)` を作る
- `menu_item_rollbacks.from_version_id / to_version_id` を記録する
- rollback後の外部サイト反映は別途sync jobとsync previewを通す
- rollback対象versionが特定できない場合は停止する

DB対応:

- `menu_item_rollbacks`
- `menu_item_versions.change_type = rollback`

---

## 6. category mapping 未設定時の停止条件確認

確認結果: PARTIAL。

統一されている方針:

- 未対応カテゴリがある場合、外部サイト同期は停止する
- sync preview / sync job validation / Chrome拡張MVP入力補助は進めない
- `unmapped_category` reason codeを使う
- `category_mappings` と `site_store_categories` を参照する

注意点:

- `docs/12` と `docs/18` では、CSV import commit自体はカテゴリ未設定でも可能な場合があると読める
- `docs/17` では、未マッピングカテゴリはsync preview / sync jobで停止する方針
- ユーザー指定の重点項目「category mapping 未設定なら import commit または sync preview が停止」と照らすと、現行設計は「import commitは許可しうるが、sync preview以降は停止」である

判定:

- 外部サイト反映に対する停止条件としては整合
- import commitも必ず止めるべきかは未決事項

TODO:

- `category_name` 未設定・未マッピング時にCSV import commitを許可するかを明文化する

---

## 7. auto_submit_enabled=false の全体維持確認

確認結果: OK。

確認箇所:

- `docs/08`: MVPでは `auto_submit_enabled=false`
- `docs/09`: 自動保存・自動公開しない
- `docs/13`: `sync_jobs.auto_submit_enabled` は常にfalse
- `docs/14`: `sync_jobs.auto_submit_enabled=false` を維持
- `docs/15`: Admin UIにtrueへ変更するUIを作らない
- `docs/16`: `auto_submit_enabled=false` を強制
- `docs/18`: true検出時は停止
- `database/schema-draft.sql`: `store_site_accounts` / `sync_jobs` / `mapping_versions` にfalse制約あり
- `database/erd-notes.md`: 自動保存禁止として明記

注意:

- Phase後送りに「自動保存・自動公開の限定解禁」という記述が複数ある
- MVPでは扱わないと明記されているため、現時点の矛盾ではない

---

## 8. sync_job_logs / audit_logs / error_logs の役割確認

確認結果: PARTIAL。

| ログ | 役割 | 状態 |
|---|---|---|
| `sync_job_logs` | sync job、Chrome拡張MVP、DOM検出、安全停止など技術ログ | DBあり |
| `audit_logs` | ユーザー操作、承認、停止確認、監査ログ | DBあり |
| `guardrail_events` | safety stop、identity mismatch、DOM critical diffなどの安全停止記録 | DBあり |
| `error_logs` | アプリケーション横断エラーログ候補 | DBなし。`docs/18`でTODO化済み |
| `import_logs` | CSV import専用ログ候補 | DBなし。`docs/18`でTODO化済み |
| `validation_logs` | validation専用ログ候補 | DBなし。`docs/18`でTODO化済み |

混在リスク:

- `sync_job_logs` と `audit_logs` は概ね役割分離されている
- `sync_validation_failed` のようなイベントは `sync_job_logs` と `audit_logs` の両方に出る可能性があり、保存粒度のschema定義が必要

TODO:

- `sync_job_logs.details_json`
- `audit_logs.details_json`
- `error_logs` 独立テーブル要否

---

## 9. 保存禁止情報の反映確認

確認結果: OK。

保存禁止として一貫している情報:

- パスワード
- Cookie
- Session
- Token
- CSRF token
- 認証情報
- input value
- hidden value
- raw DOM / 生DOM
- outerHTML / outer_html
- Authorization header
- 顧客個人情報
- 外部サイト管理画面スクリーンショット

DB側:

- `database/schema-draft.sql` 冒頭コメントで保存禁止を明記
- `dom_snapshots` は `sanitized_snapshot_json` 前提
- `mapping_versions` / `sync_jobs` はauto submit false制約あり

注意:

- `stores.address` / `stores.phone`、`store_site_identity_checks.expected_value` は店舗識別目的で保存される
- `docs/18` ではエラーログには住所全文・電話番号を保存しない方針
- 店舗識別情報と個人情報ログ禁止の境界は、今後schema単位で明確化が必要

---

## 10. Admin UI と API の対応確認

確認結果: PARTIAL。

対応できている画面:

- Menu sections
- Menu item list / edit
- CSV import upload / preview / validate / commit / errors
- Category mapping
- Sync preview
- Sync job detail / logs / preview / execute-request
- Rollback preview

不足または未確定:

| Admin UI | docs/15記述 | docs/14対応 | 判定 |
|---|---|---|---|
| Login / Account | 認証API未確定、`GET /extension/me`相当 | 認証方式未確定 | TODO |
| Organization switch | organization / store read API | 具体endpoint未定義 | TODO |
| Store list | organization / store read API | 具体endpoint未定義 | TODO |
| Store detail | store read API等 | 具体endpoint未定義 | TODO |
| Sync job list | list API追加検討 | detail endpointのみ | TODO |
| Audit log view | audit log read API | 具体endpoint未定義 | TODO |

---

## 11. API と schema-draft.sql の対応確認

確認結果: PARTIAL。

対応あり:

- `menu_sections`
- `menu_items`
- `menu_item_versions`
- `menu_item_rollbacks`
- `category_mappings`
- `sync_jobs`
- `sync_job_logs`
- `audit_logs`
- `mapping_versions`
- `menu_sync_routes`
- `transform_rules`
- `site_store_categories`
- `store_site_identity_checks`
- `guardrail_events`

API設計にあるがDB専用テーブルが未定義:

- CSV import session / batch / import job
- import logs
- validation logs
- error logs
- sync job target items
- retry attempts / attempt_number
- category mapping versions
- store_mapping_overrides

DBにはあるがAPI詳細が未定義:

- `guardrail_events`
- `dom_diffs`
- `dom_snapshots`
- `site_store_profiles`
- `site_pages`
- `transform_rules`

---

## 12. MVPスコープのズレ確認

確認結果: mostly OK。

一貫してMVP対象:

- Admin Webでのメニュー管理
- CSV import preview / validation / commit
- Common Menu Model
- category mapping
- sync preview
- sync job候補とログ
- rollback設計
- audit log
- `auto_submit_enabled=false`

一貫してMVP対象外:

- 外部サイト自動保存
- 外部サイト自動公開
- 外部サイト自動削除
- 生DOM保存
- input value保存
- Cookie / Session / Token保存
- 複数店舗一括同期
- AI自動確定
- 画像アップロード実行

ズレ・曖昧:

- Chrome拡張MVPとの接続点は設計上存在するが、実装詳細はPhase後送り
- 外部サイトカテゴリ取得は必要だが、具体実装は未定義
- import commit時の未マッピングカテゴリ許可/停止が文書により解釈余地あり

---

## 13. HOLD中の外部サイト解析との関係

確認結果: HOLD。

外部サイト解析待ちとして扱うべき項目:

- `site_pages` 未定義
- `mapping_versions.status != published`
- required extension version未確定
- `site_store_categories` 未取得
- `store_site_identity_checks` 未作成
- 未解決のcritical `dom_diffs`
- field mapping未定義

HOLD時の方針:

- sync previewで「外部サイト解析待ち」と表示する
- sync job作成前に停止、または `blocked_by_safety_check`
- `guardrail_events(reason_code=external_site_analysis_pending)` を残す
- 外部サイト管理画面の解析自体はこのチェック文書では扱わない

---

## 14. 見つかった矛盾・不足・TODO一覧

| ID | 優先度 | 種別 | 内容 | 影響 |
|---|---|---|---|---|
| C-001 | high | API | organization / store read APIの具体endpointが未定義 | Admin UIのStore list / detail / organization switch実装前に必要 |
| C-002 | high | API | Sync job list APIが未定義 | Sync job list画面で必要 |
| C-003 | high | API | Audit log read APIの具体endpointが未定義 | Audit log viewで必要 |
| C-004 | medium | DB/API | CSV import session / batch / import jobテーブルが未定義 | import_idを使うAPIとの対応が弱い |
| C-005 | medium | DB/API | sync job target items関連テーブルが未定義 | sync job対象item/versionの正規化が未完 |
| C-006 | medium | Logging | error_logsを独立テーブルにするか未決 | 横断エラー調査設計が未確定 |
| C-007 | medium | Category | import commit時に未マッピングカテゴリを許可するか停止するか明文化が必要 | CSV運用とsync停止UIに影響 |
| C-008 | medium | Category | category_mapping_versions未定義 | mapping rollback / version固定はPhase後送り |
| C-009 | medium | Mapping | store_mapping_overrides未定義 | 店舗別上書きは概念のみ |
| C-010 | medium | Retry | attempt_number / retry_reason の保存先が未定義 | retry履歴の追跡に影響 |
| C-011 | low | Security | 店舗識別情報とエラーログ禁止情報の境界schemaが未定義 | ログ設計詳細化で対応 |
| C-012 | low | DOM | dom_snapshots / dom_diffs API詳細が未定義 | Chrome拡張MVP詳細化時に必要 |
| C-013 | low | Transform | transform_rules API詳細が未定義 | CSV列マッピング学習やTarget変換高度化時に必要 |

---

## 15. 修正優先度

### critical

現時点でcriticalな矛盾は見つかっていない。

理由:

- 自動保存・自動公開・自動削除は禁止で統一されている
- `auto_submit_enabled=false` は文書とDB制約で維持されている
- raw DOM / input value / Cookie / Session / Token保存禁止は一貫している
- rollbackは新version作成で統一されている

### high

- C-001: organization / store read API endpoint定義
- C-002: sync job list API endpoint定義
- C-003: audit log read API endpoint定義

### medium

- C-004: CSV import session / batch / import job DB方針
- C-005: sync job target items関連テーブル
- C-006: error_logs独立テーブル要否
- C-007: 未マッピングカテゴリ時のimport commit可否
- C-008: category_mapping_versions
- C-009: store_mapping_overrides
- C-010: retry attempt保存方針

### low

- C-011: 店舗識別情報とログ禁止情報の境界schema
- C-012: dom snapshot / diff API詳細
- C-013: transform_rules API詳細

---

## 16. 次アクション

1. `docs/14_api-mvp-design.md` に organization / store read、sync job list、audit log read の具体endpointを追加する
2. CSV import session / batch / import job をDBテーブル化するか決める
3. sync job target itemsを `summary_json` で続けるか、専用テーブル化するか決める
4. error_logs専用テーブルを追加するか、MVPでは `sync_job_logs` / `audit_logs` / `guardrail_events` に寄せるか決める
5. category mapping未設定時のCSV import commit可否を明文化する
6. retry attemptの保存方法を決める
7. 外部サイト解析HOLD条件をPhase 1.5検証後に更新する

---

## 17. GO / HOLD / STOP 判定

| 領域 | 判定 | 理由 |
|---|---|---|
| Internal Admin / CSV / Common Menu Model設計 | GO | versioning、preview/commit分離、rollback方針は整合している |
| API詳細化 | HOLD | 一部read/list endpointとimport session関連が未定義 |
| DB schema確定 | HOLD | import job、sync target items、error logs、category mapping versionsの扱いが未決 |
| Sync job設計 | GO with TODO | 安全停止方針は整合。target items / retry attemptはTODO |
| Category mapping設計 | GO with TODO | 同期停止方針は整合。import commit可否とversioningはTODO |
| Error handling / logging設計 | GO with TODO | 保存禁止・停止方針は整合。error_logs独立化はTODO |
| Chrome拡張MVP / 外部サイト反映候補実行 | HOLD | 外部サイト解析、mapping version、identity check、DOM diff検証待ち |
| 自動保存・自動公開・自動削除 | STOP | MVPでは扱わない。許可する記述は見つかっていない |

総合判定:

```txt
HOLD for external-site execution.
GO for internal design cleanup and API/schema TODO resolution.
STOP for auto-submit, auto-publish, auto-delete in MVP.
```
