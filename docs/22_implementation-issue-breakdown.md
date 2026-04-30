# Implementation Issue Breakdown

## 1. 実装Issue分解の目的

このドキュメントは、Menu Sync System のMVP実装に向けて、既存の設計ドキュメントを実装Issue単位に分解し、実装順序・依存関係・Done定義を明確にするためのものである。

対象は、外部サイト解析なしで進められる内部MVPである。実装コード、実装ディレクトリ、外部サイト管理画面解析はこの文書では作らない。

参照元:

- `docs/10_development-roadmap.md`
- `docs/11_common-menu-model.md`
- `docs/12_csv-import-design.md`
- `docs/13_internal-menu-admin-design.md`
- `docs/14_api-mvp-design.md`
- `docs/15_admin-ui-mvp-design.md`
- `docs/16_sync-job-design.md`
- `docs/17_category-mapping-operation-design.md`
- `docs/18_error-handling-and-logging-design.md`
- `docs/19_design-consistency-check.md`
- `docs/20_mvp-freeze-and-open-issues.md`
- `docs/21_technical-stack-decision.md`
- `database/schema-draft.sql`
- `database/erd-notes.md`

---

## 2. 実装前提

MVP実装の前提。

- 外部サイト解析はHOLD
- Chrome拡張MVP実接続はHOLD
- 自動保存 / 自動公開 / 自動削除はSTOP
- `auto_submit_enabled=false` 維持
- Cookie / Session / Token / 生DOM / input value は扱わない
- 外部サイト管理画面の解析はしない
- まずはCSV import / Internal Menu Admin / Sync Preview / Logs を作る
- 技術スタック第一候補は `Cloudflare Pages + Astro + Workers + Hono + D1`
- D1採用時は `JSONB -> TEXT JSON`、`TIMESTAMPTZ -> TEXT`、`BOOLEAN -> INTEGER` の変換を前提にする
- 認証/権限管理が重い場合は `Supabase Auth + PostgreSQL` 案を比較対象に残す

---

## 3. 実装Phase一覧

| Phase | 名称 | 目的 | 状態 |
|---:|---|---|---|
| Phase 0 | Repo / tooling setup | 実装基盤を作る | GO |
| Phase 1 | DB schema / migration | MVPテーブルとmigration方針を固める | GO |
| Phase 2 | Auth / organization / store scope | 認証・認可・scope検査を作る | GO with decision |
| Phase 3 | Common Menu Model API | メニュー共通モデルのAPI境界を作る | GO |
| Phase 4 | CSV import preview / validation / commit | CSV取り込みをpreviewとcommit分離で作る | GO |
| Phase 5 | Internal Menu Admin API | 自社DB正本のメニュー編集APIを作る | GO |
| Phase 6 | Admin UI MVP | 管理画面の最小操作フローを作る | GO |
| Phase 7 | Category Mapping UI / API | 手動カテゴリマッピングを作る | GO with HOLD |
| Phase 8 | Sync preview / sync job logs | 外部サイト反映候補とログを作る | GO with HOLD |
| Phase 9 | Error handling / safe logging | safe error responseとログ方針を実装する | GO |
| Phase 10 | Rollback preview | rollback候補のpreviewと新version作成準備を作る | GO |
| Phase 11 | MVP QA / consistency check | MVP横断の整合性と安全制約を確認する | GO |

---

## 4. 各PhaseのIssue候補

### Phase 0: Repo / tooling setup

| Issue | 目的 | 依存関係 | Done定義 |
|---|---|---|---|
| Setup Astro project | Admin UI MVPの土台を作る | 技術スタック最終判断 | Astroの最小起動、routing方針、lint/format方針が決まっている |
| Setup Workers API skeleton | API MVPの土台を作る | 技術スタック最終判断 | health check、routing、error envelopeの最小形がある |
| Setup Hono routing skeleton | Workers APIをREST境界で整理する | Workers skeleton | organization/store scoped routeの雛形がある |
| Setup D1 local schema | local D1でschema検証できるようにする | DB採用判断 | local migrationの実行手順がある |
| Setup test/lint commands | 実装品質の最低ラインを作る | project setup | CI前提のtest/lintコマンドが決まっている |
| Setup environment separation | local / preview / productionを分ける | hosting方針 | 環境名、DB接続先、ログ出力先の分離方針がある |

### Phase 1: DB schema / migration

| Issue | 目的 | 依存関係 | Done定義 |
|---|---|---|---|
| Convert schema-draft.sql for D1 | PostgreSQL寄りDDLをD1向けに変換する | DB採用判断 | `JSONB -> TEXT JSON` 等の変換ルールが反映されている |
| Implement organization/store tables | organization / store scopeの基礎を作る | schema conversion | `organizations`、`stores`、membership/permission系の最小schemaがある |
| Implement menu schema | menu_sections / menu_items / menu_item_versionsを作る | schema conversion | status管理、version追記、store scopeが表現できる |
| Implement CSV import tables | CSV import session / validation結果を保存する | schema conversion | upload/preview/validate/commitの状態が追える |
| Implement category mapping tables | category_mappingsの最小schemaを作る | menu schema | 未マッピング停止と手動確定を表現できる |
| Implement sync job tables | sync_jobs / sync_job_logsを作る | menu schema, mapping schema | `auto_submit_enabled=false` を保持し、job/event/logを追える |
| Implement audit_logs | 操作監査ログを保存する | user/store schema | user_id、role、operation_type、resource_idを追える |
| Decide error_logs table | error_logsを独立させるか決める | logging design | 独立テーブル化またはsync_job_logs/audit_logs集約の判断が記録されている |

### Phase 2: Auth / organization / store scope

| Issue | 目的 | 依存関係 | Done定義 |
|---|---|---|---|
| Decide auth provider | Supabase Auth / Clerk / Auth.jsから選ぶ | Phase 0 | 独自認証を避ける方針でproviderが決まっている |
| Implement authenticated user context | API requestをユーザーに紐づける | auth provider | user_idとroleをAPI内部で参照できる |
| Implement organization membership check | organization scopeを検査する | org tables | scope不一致時に403/409で停止する |
| Implement store scope middleware | store scopeを共通検査する | store tables | 全店舗系APIでstore_idの権限検査が通る |
| Implement role permission matrix | owner/admin/operator/viewerの操作範囲を制御する | user context | viewer更新禁止、CSV commit/rollback権限が制御される |
| Implement safe auth logging | 認証周辺のsafe loggingを作る | logging方針 | Cookie/Session/Tokenをログへ保存しない |

### Phase 3: Common Menu Model API

| Issue | 目的 | 依存関係 | Done定義 |
|---|---|---|---|
| Implement CMM validation schema | Common Menu Modelの必須項目と型を検査する | menu schema | price、tax_policy、status、seasonal dateを検査できる |
| Implement common-menu transform API | CSV/Admin入力をCMM候補へ変換する | CMM validation | 変換結果とsafe errorが返る |
| Implement seasonal menu handling | 季節メニューの期間とstatusを扱う | CMM validation | start/end date不正時にvalidation_errorになる |
| Implement status normalization | active/hidden/deleted等を統一する | CMM validation | 物理削除せずstatus管理になる |
| Implement menu_item_versions creation | 確定更新時のversion追記を作る | menu schema | CSV commit / 管理画面編集 / rollbackで新versionが作られる |

### Phase 4: CSV import preview / validation / commit

| Issue | 目的 | 依存関係 | Done定義 |
|---|---|---|---|
| Implement CSV upload preview | CSVを正本更新せずpreviewする | import tables, CMM API | upload後にmenu_itemsを更新しない |
| Implement CSV parse/normalize | CSV列と値を正規化する | upload preview | カラム揺れと型変換結果が表示できる |
| Implement CSV validation | 行単位validationを行う | parse/normalize | validation_errorを件数・行番号・安全な理由で返す |
| Implement import validation errors API | importエラー一覧を返す | CSV validation | 保存禁止情報を含まないエラー表示ができる |
| Implement CSV diff preview | 既存menu_itemsとの差分を出す | menu schema | 新規/更新/非公開/削除候補が分かる |
| Implement CSV commit | 人間確認後に正本へ反映する | diff preview, authz | menu_items更新、menu_item_versions作成、audit_logs記録が行われる |
| Implement category-unmapped warning on import | 未マッピングカテゴリをwarning扱いにする | category mapping schema | CSV commitは可、sync preview/jobは停止する状態が表現される |

### Phase 5: Internal Menu Admin API

| Issue | 目的 | 依存関係 | Done定義 |
|---|---|---|---|
| Implement menu_sections API | セクションCRUD相当を提供する | auth/scope, menu schema | list/create/update/status変更ができる |
| Implement menu_items API | メニュー項目CRUD相当を提供する | menu_sections API | list/detail/create/updateができる |
| Implement menu item status API | hidden/deleted候補をstatusで扱う | menu_items API | 物理削除せずstatus変更とaudit logになる |
| Implement menu item edit validation | UI編集のvalidationを統一する | CMM validation | price/tax/status/seasonal/categoryを検査できる |
| Implement version history read API | menu_item_versionsを閲覧する | versions creation | item別version一覧と詳細が返る |
| Implement audit_logs write helper | 更新操作の監査記録を共通化する | audit_logs schema | menu/CSV/category/sync操作でaudit logが残る |

### Phase 6: Admin UI MVP

| Issue | 目的 | 依存関係 | Done定義 |
|---|---|---|---|
| Implement Login / Account UI | 認証済み操作の入口を作る | auth provider | login/account表示ができる |
| Implement Organization switch UI | organization切替を作る | org API | scopeがUI上で明示される |
| Implement Store list UI | 店舗一覧を表示する | store API | 権限内storeだけが表示される |
| Implement Store detail UI | 店舗詳細と同期安全状態を表示する | store API | `auto_submit_enabled=false` とHOLD状態が表示される |
| Implement admin menu list UI | menu_sections / menu_itemsを一覧する | menu API | status/seasonal/category warningが見える |
| Implement menu item edit UI | メニュー編集画面を作る | menu item API | 保存前確認、削除はstatus変更確認になる |
| Implement CSV import UI | upload/preview/validation/commitを分離する | CSV API | previewとcommitが別操作になっている |
| Implement import validation errors UI | CSVエラーを安全に表示する | error API | PII/保存禁止情報を表示しない |
| Implement audit log view UI | 操作監査を閲覧する | audit log API | roleに応じた粒度で表示される |

### Phase 7: Category Mapping UI / API

| Issue | 目的 | 依存関係 | Done定義 |
|---|---|---|---|
| Implement category mapping CRUD | category_mappingsを手動管理する | mapping schema, authz | 作成/更新/status変更ができる |
| Implement unmapped category list | 未マッピングカテゴリを一覧する | CSV/menu data | sync停止理由として未設定カテゴリが見える |
| Implement category mapping UI | ユーザーが手動で対応付ける | mapping API | 自動推測だけで確定しない |
| Implement 1:1 mapping support | MVPの基本マッピングを扱う | mapping CRUD | 1:1の手動確定ができる |
| Document 1:N / N:1 HOLD | 複雑な対応をPhase後送りにする | mapping design | 1:N/N:1はTODOまたはPhase後送りとして表示される |
| Implement category mapping audit logs | mapping変更を監査する | audit helper | mapping変更者、理由、対象カテゴリが記録される |

### Phase 8: Sync preview / sync job logs

| Issue | 目的 | 依存関係 | Done定義 |
|---|---|---|---|
| Implement sync preview | 外部サイト反映候補の差分を作る | menu API, mapping API | 外部サイト自動操作なしで差分候補が見える |
| Implement sync precheck | sync前停止条件を検査する | sync preview | 未mapping、store identity未確認、version不一致等で停止する |
| Implement category mapping stop | 未マッピングカテゴリ時にsync停止する | mapping API | sync preview/job作成が停止する |
| Implement auto_submit guard | `auto_submit_enabled=false` を強制する | sync_jobs schema | true検出時にcritical停止する |
| Implement sync job creation | preview確認後に反映候補jobを作る | sync precheck | 自動保存/公開/削除なしのjobが作成される |
| Implement sync_job_logs | sync job eventを記録する | sync job schema | event_type、severity、safe messageが残る |
| Implement sync preview UI | sync前確認と停止理由を画面で表示する | sync preview API | 未mapping、HOLD、STOP条件、`auto_submit_enabled=false` が確認できる |
| Implement sync job list/detail UI | job一覧とlogsを表示する | sync API | operator/adminが停止理由とnext_actionを確認できる |

### Phase 9: Error handling / safe logging

| Issue | 目的 | 依存関係 | Done定義 |
|---|---|---|---|
| Implement safe error response | ユーザー向けエラーを統一する | API skeleton | error_code、safe message、next_actionを返す |
| Implement error classification | validation/mapping/import/sync等を分類する | safe error response | docs/18の分類に沿って返せる |
| Implement severity handling | info/warning/error/criticalを扱う | error classification | critical時は処理停止する |
| Implement prohibited data scrub | 保存禁止情報をログから除外する | logging helper | Cookie/Session/Token/生DOM/input valueを保存しない |
| Implement request_id / trace_id | 調査用IDを付与する | API skeleton | API response/logにIDが付く |
| Implement security violation logging | security_violationを記録する | logging helper | 保存禁止情報混入疑いをcriticalで記録できる |

### Phase 10: Rollback preview

| Issue | 目的 | 依存関係 | Done定義 |
|---|---|---|---|
| Implement rollback preview API | 過去versionとの差分をpreviewする | version history | 正本を更新せず差分が見える |
| Implement rollback target validation | rollback対象versionを検査する | rollback preview | 対象不明ならcritical停止する |
| Implement rollback commit as new version | rollbackを新version作成として扱う | versions creation | 既存versionを上書きしない |
| Implement rollback audit logs | rollback理由を監査する | audit helper | user/role/reason/target_versionが残る |
| Implement rollback preview UI | rollback前確認画面を作る | rollback API | 人間確認後にのみ実行できる |

### Phase 11: MVP QA / consistency check

| Issue | 目的 | 依存関係 | Done定義 |
|---|---|---|---|
| Verify API/UI/schema consistency | docs/19のHOLD/TODOを再確認する | Phase 1-10 | Admin UIから呼ぶAPIとschemaが対応している |
| Verify safety constraints | STOP事項が実装に混入していないか確認する | Phase 1-10 | 自動保存/公開/削除、保存禁止情報保存がない |
| Verify versioning behavior | version作成タイミングを確認する | menu/CSV/rollback | CSV commit / edit / rollbackで新versionができる |
| Verify category mapping flow | 未mapping時の停止を確認する | mapping/sync | CSV commit可、sync preview/job停止が成立する |
| Verify error handling flow | エラー分類と停止条件を確認する | logging/errors | critical停止とsafe messageが成立する |
| Prepare MVP release checklist | MVP受入条件を整理する | QA完了 | GO/HOLD/STOP判定付きchecklistがある |

---

## 5. 各Issueの目的

Issueは以下のどれかの目的に紐づける。

| 目的 | 内容 |
|---|---|
| Foundation | project、routing、DB、認証などの基盤を作る |
| Data correctness | Common Menu Model、validation、versioningで正本の整合性を守る |
| Human confirmation | preview / commit / rollback / sync前確認を分離する |
| Safety | STOP条件、保存禁止情報、`auto_submit_enabled=false` を守る |
| Operation visibility | audit logs / sync_job_logs / error表示で運用可能にする |
| MVP usability | 店舗担当者・オーナー・運用者が最小画面で操作できるようにする |

---

## 6. 依存関係

主要依存関係。

```txt
Phase 0 Repo / tooling
  -> Phase 1 DB schema / migration
  -> Phase 2 Auth / organization / store scope
  -> Phase 3 Common Menu Model API
  -> Phase 4 CSV import
  -> Phase 5 Internal Menu Admin API
  -> Phase 6 Admin UI MVP
  -> Phase 7 Category Mapping UI / API
  -> Phase 8 Sync preview / sync job logs
  -> Phase 9 Error handling / safe logging
  -> Phase 10 Rollback preview
  -> Phase 11 MVP QA
```

横断依存:

- Phase 2のscope検査は、Phase 3以降の全APIに依存される
- Phase 3のCMM validationは、CSV import、Admin edit、rollbackに依存される
- Phase 1の`menu_item_versions`は、CSV commit、管理画面編集、rollbackに依存される
- Phase 7のcategory mappingは、Phase 8のsync preview停止条件に依存される
- Phase 9のsafe loggingは、全Phaseのerror/log出力に依存される
- Phase 8は外部サイト解析HOLDのため、反映候補と操作ログまでに留める

---

## 7. Done定義

全Issue共通のDone定義。

- 実装対象の設計ドキュメントに反していない
- organization / store scope検査が必要なAPIで漏れていない
- role別権限が満たされている
- previewとcommitが分離されている
- 保存/公開/削除に関わる操作は人間確認を挟む
- 物理削除ではなくstatus管理になっている
- `menu_item_versions` は確定更新時に追記される
- rollbackは既存versionを上書きせず新versionを作る
- `auto_submit_enabled=false` が維持されている
- 自動保存 / 自動公開 / 自動削除を実装していない
- Cookie / Session / Token / 生DOM / outerHTML / input value を保存していない
- エラー応答とログに保存禁止情報が混入しない
- audit_logsまたはsync_job_logsに必要な操作記録が残る
- テストまたは手動確認手順が残っている

---

## 8. 作らないもの

MVPで作らないもの。

- 外部サイト自動保存
- 外部サイト自動公開
- 外部サイト自動削除
- Chrome拡張MVP実接続
- Hotpepper / 食べログ / ぐるなび実画面解析
- 外部サイトログイン情報保存
- Cookie / Session / Token保存
- 生DOM / outerHTML保存
- input value / hidden value保存
- 外部サイト管理画面スクリーンショット保存
- AIによる自動確定
- 複数店舗一括同期
- 外部サイト同士の直接同期
- 画像アップロード実行
- アレルゲン外部サイト反映

---

## 9. STOP条件

以下を検出した場合は実装または処理を停止し、設計確認に戻す。

- `auto_submit_enabled=true` を許可する必要が出た
- 外部サイトの保存/公開/削除ボタンを自動で押す必要が出た
- Cookie / Session / Token / 認証情報を保存する必要が出た
- 生DOM / outerHTML / input valueを保存する必要が出た
- organization / store scopeを検査できない
- role権限を判定できない
- category mapping未設定のままsync preview/jobを進める必要が出た
- mapping_version不一致を無視する必要が出た
- store identity未確認を無視する必要が出た
- rollback対象versionが特定できない
- safe loggingで保存禁止情報の除外が保証できない
- 自動リトライをMVPに入れる必要が出た

---

## 10. 実装中に必ず守る安全制約

実装中の安全制約。

- すべての更新APIは認証済みユーザーに紐づける
- すべての店舗系APIはorganization/store scopeを検査する
- viewerは更新系操作を実行できない
- operatorのCSV commit / rollback / deleted変更は制限する
- previewでは正本を更新しない
- commitは人間確認後の明示操作にする
- 削除は物理削除ではなくstatus変更にする
- import previewとcommitはUI/APIとも分離する
- category mappingは自動推測だけで確定しない
- 未マッピングカテゴリがある場合、CSV commitは許可してよいがsync preview / sync job作成は停止する
- sync jobは反映候補と操作ログであり、外部サイトへの自動公開ではない
- error/logには保存禁止情報を残さない
- `request_id` / `trace_id` を付与できる構造にする

---

## 11. 最初に着手するIssue

最初に着手するIssue。

1. DB / API / Admin UI / Auth の最終採用判断
2. Setup Astro project
3. Setup Workers API skeleton
4. Setup D1 local schema
5. Convert schema-draft.sql for D1
6. Implement organization/store tables
7. Decide auth provider
8. Implement store scope middleware

理由:

- schemaとscope検査が固まらないと、CSV / Menu / Mapping / Syncの全APIが不安定になる
- D1採用時の型変換ルールを早めに確定しないと、以降のIssue見積もりがぶれる
- 認証方式はUI/APIの分岐点になるため、Phase 2前に決める必要がある

---

## 12. 後回しにするIssue

後回しにするIssue。

| Issue | 理由 |
|---|---|
| Chrome拡張MVP実接続 | 外部サイト解析HOLDのため |
| Hotpepper / 食べログ / ぐるなび実画面解析 | MVP内部機能とは分離するため |
| 外部サイトカテゴリ自動取得 | 取得方式が未確定のため |
| DOM差分閾値実装 | 実画面検証前に決められないため |
| mapping JSON publish workflow | Chrome拡張実接続後に確定するため |
| category mapping versions | MVPでは手動mappingの最小機能を優先するため |
| store_mapping_overrides | 店舗別例外運用はPhase後送り |
| 1:N / N:1 category mapping確定 | MVPは1:1中心で始めるため |
| Slack / メール通知 | MVPでは画面上のログ確認を優先するため |
| 自動リトライ | MVPでは人間確認後の手動再実行にするため |

---

## 13. Gitブランチ運用案

ブランチ運用案。

```txt
main
  └─ feature/mvp-foundation
       ├─ feature/db-schema-d1
       ├─ feature/auth-store-scope
       ├─ feature/common-menu-api
       ├─ feature/csv-import
       ├─ feature/internal-menu-admin
       ├─ feature/admin-ui-mvp
       ├─ feature/category-mapping
       ├─ feature/sync-preview-logs
       ├─ feature/error-safe-logging
       └─ feature/rollback-preview
```

方針:

- Phaseまたは機能境界ごとにbranchを切る
- schema変更とAPI実装は同じPRに含めてもよいが、UI変更は分ける
- 大きいPhaseはIssue単位で小branchに分ける
- docsのみの変更と実装変更は原則分ける
- STOP条件や保存禁止情報に関わる修正は独立commitにする

---

## 14. コミット単位の目安

コミット単位の目安。

- project setup: scaffold、lint、configを分ける
- DB schema: table group単位で分ける
- migration: schema変換とseed/test dataを分ける
- API: endpoint group単位で分ける
- validation: schema/validatorとendpoint接続を分ける
- UI: screen単位またはworkflow単位で分ける
- logging: audit_logs、sync_job_logs、safe error responseを分ける
- security: scope check、role check、scrub処理を分ける
- rollback: preview、commit、新version作成、audit logを分ける
- docs: 実装に伴う設計更新は実装commitと分ける

コミットメッセージ例:

```txt
Setup Astro admin UI shell
Setup Workers API skeleton
Convert schema draft for D1
Implement organization and store scope tables
Implement menu item versioning
Implement CSV import preview
Implement CSV import commit
Implement category mapping CRUD
Implement sync preview safety checks
Implement safe error responses
Implement rollback preview
```

---

## 15. TODO

- [ ] DBをD1で開始するか最終決定する
- [ ] 認証providerを決める
- [ ] Astro / Workers / Hono / D1 の初期構成を確定する
- [ ] D1向けschema変換ルールを確定する
- [ ] `error_logs` 独立テーブルの要否を決める
- [ ] CSV import session / batch / import job の保存単位を決める
- [ ] sync job target itemsを正規化するか決める
- [ ] request_id / trace_id の仕様を決める
- [ ] role permission matrixを実装Issueへ落とし込む
- [ ] MVP QA checklistを実装開始後に更新する
- [ ] GitHub Issue化する場合のlabel / milestoneを決める
