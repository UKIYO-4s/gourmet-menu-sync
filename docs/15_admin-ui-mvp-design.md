# Admin UI MVP Design

## 1. 目的

このドキュメントは、Menu Sync System のMVP管理画面UIを定義する。

管理画面は、飲食店オーナー・店舗担当者・飲食コンサル・運用代行者が、店舗メニューを Common Menu Model として安全に編集し、CSV import、カテゴリ対応、同期前確認、rollback、監査ログ確認までを行うための最小UIである。

MVPでは以下を徹底する。

- 外部サイト同士を直接変換しない
- メニューの正本は `menu_items` / `menu_item_versions` で管理する
- preview と commit を分離する
- 保存・公開・削除の前に人間確認を挟む
- 外部サイトの自動保存・自動公開は扱わない
- Cookie / Session / Token / 生DOM / input value は扱わない
- 物理削除ではなく `status` / `publish_status` による状態管理を前提にする

---

## 2. 対象ユーザー

### 2.1 飲食店オーナー

- 店舗全体のメニュー管理方針を決める
- 価格変更、非公開化、論理削除、rollbackを承認する
- 外部サイト同期前の最終確認を行う

### 2.2 店舗担当者

- 日々のメニュー追加・編集を行う
- CSV import preview を確認する
- 季節メニューの開始・終了、非公開化候補を確認する

### 2.3 飲食コンサル

- 複数店舗のメニュー整理、カテゴリ整理、価格見直しを支援する
- 契約範囲内のorganization / storeのみ操作する
- 提案・下書き・preview確認を中心に使う

### 2.4 運用代行者

- 店舗に代わってメニュー更新作業を行う
- CSV import、カテゴリ対応、同期候補作成を代行する
- 保存・公開の最終判断は契約上の運用ルールに従う

---

## 3. role別に見える画面・できる操作

roleは `organization_users.role` と `store_users.role` を組み合わせて判定する。store単位の権限がある場合は、対象storeの操作範囲を優先する。

| 画面 / 操作 | owner | admin | operator | viewer |
|---|---:|---:|---:|---:|
| Login / Account | yes | yes | yes | yes |
| Organization switch | yes | yes | yes | yes |
| Store list | yes | yes | permitted stores | permitted stores |
| Store detail | yes | yes | permitted stores | permitted stores |
| Menu sections閲覧 | yes | yes | yes | yes |
| Menu sections作成/編集 | yes | yes | yes | no |
| Menu item list閲覧 | yes | yes | yes | yes |
| Menu item作成/編集 | yes | yes | yes | no |
| statusを`hidden`へ変更 | yes | yes | yes | no |
| statusを`deleted`へ変更 | yes | yes | no | no |
| CSV import upload | yes | yes | yes | no |
| CSV import preview | yes | yes | yes | no |
| CSV import commit | yes | yes | no | no |
| Category mapping閲覧 | yes | yes | yes | yes |
| Category mapping編集 | yes | yes | limited | no |
| Sync preview | yes | yes | limited | yes |
| Sync job作成 | yes | yes | limited | no |
| Sync job list/detail閲覧 | yes | yes | yes | yes |
| Rollback preview | yes | yes | yes | yes |
| Rollback実行 | yes | yes | no | no |
| Audit log view | yes | yes | limited | yes |

`limited` は、店舗単位の権限、契約範囲、運用設定に従う。

---

## 4. MVP画面一覧

| 画面 | 主目的 |
|---|---|
| Login / Account | 認証済みユーザーと所属情報の確認 |
| Organization switch | 操作対象organizationの切り替え |
| Store list | 操作可能店舗の一覧確認 |
| Store detail | 店舗基本情報、外部サイト接続、同期状態の確認 |
| Menu sections | メニュー内分類の管理 |
| Menu item list | メニュー項目の検索、確認、状態変更 |
| Menu item edit | メニュー項目の作成・編集・保存前確認 |
| CSV import upload | CSVファイルのアップロード |
| CSV import preview | 取り込み候補と差分の確認 |
| Import validation errors | 取り込み不可行と警告の確認 |
| Category mapping | Commonカテゴリと外部サイトカテゴリの対応 |
| Sync preview | 外部サイト同期前の差分・安全確認 |
| Sync job list | 同期ジョブ一覧と状態確認 |
| Sync job detail/logs | 同期ジョブ詳細とログ確認 |
| Rollback preview | rollback前の差分確認 |
| Audit log view | 監査ログの閲覧 |

---

## 5. 画面詳細

### 5.1 Login / Account

| 項目 | 内容 |
|---|---|
| 目的 | 認証状態、ユーザー名、所属organization、roleを確認する |
| 主要UI要素 | ログインフォーム、ログアウト、アカウント情報、所属organization一覧、現在role表示 |
| 呼び出すAPI | 認証APIはMVP設計段階では未確定、`GET /extension/me` 相当のユーザー確認APIは将来候補 |
| 作成されるDBレコード | `audit_logs(event_type=login)` |

UI方針:

- 外部サイトのログインID、パスワードは入力させない
- Account画面に外部サイト認証情報欄を作らない
- suspended / deleted user は管理画面に入れない

### 5.2 Organization switch

| 項目 | 内容 |
|---|---|
| 目的 | 複数organizationに所属するユーザーが操作対象を切り替える |
| 主要UI要素 | organization selector、organization type、role badge、現在選択中表示 |
| 呼び出すAPI | organization / store read API |
| 作成されるDBレコード | 必要に応じて `audit_logs(event_type=organization_selected)` |

UI方針:

- 切り替え後はstore一覧、menu、sync job、audit logのスコープをすべて更新する
- URL / body のorganization不一致はエラー表示する

### 5.3 Store list

| 項目 | 内容 |
|---|---|
| 目的 | 操作可能な店舗を確認し、対象店舗へ移動する |
| 主要UI要素 | 店舗名、status、住所、電話、外部サイト接続数、未対応カテゴリ数、pending sync jobs数 |
| 呼び出すAPI | organization / store read API |
| 作成されるDBレコード | 店舗選択時に `audit_logs(event_type=store_selected)` |

UI方針:

- viewerには閲覧可能店舗のみ表示する
- `stores.status=deleted` は通常一覧から除外し、フィルタでのみ表示する
- 店舗電話番号・住所は店舗識別目的に限定して表示する

### 5.4 Store detail

| 項目 | 内容 |
|---|---|
| 目的 | 店舗基本情報、外部サイト接続、メニュー正本、同期経路を確認する |
| 主要UI要素 | 店舗基本情報、store_site_accounts一覧、auto fill/auto submit状態、primary menu source、sync routes、identity check状態 |
| 呼び出すAPI | store read API、category mapping API、sync job status API |
| 作成されるDBレコード | 通常閲覧ではなし。設定変更時は `store_site_accounts`、`store_menu_sources`、`menu_sync_routes`、`audit_logs` |

UI方針:

- `auto_submit_enabled=false` を明示する
- 自動保存・自動公開のトグルは出さない
- 外部サイト管理画面URLはリンクとして表示しても、認証情報は保持しない

### 5.5 Menu sections

| 項目 | 内容 |
|---|---|
| 目的 | メニュー内の表示グループを管理する |
| 主要UI要素 | セクション一覧、名称、説明、表示順、status、作成/編集モーダル、非表示/論理削除確認 |
| 呼び出すAPI | `GET /organizations/{organization_id}/stores/{store_id}/menu-sections`、`POST /organizations/{organization_id}/stores/{store_id}/menu-sections`、`PATCH /organizations/{organization_id}/stores/{store_id}/menu-sections/{section_id}` |
| 作成されるDBレコード | `menu_sections`、`audit_logs` |

UI方針:

- 物理削除ボタンは作らない
- `active` / `hidden` / `deleted` を状態として表示する
- `deleted` への変更はowner/adminのみ、確認ダイアログ必須

### 5.6 Menu item list

| 項目 | 内容 |
|---|---|
| 目的 | メニュー項目の現在状態を一覧し、編集・非公開化・同期候補作成へ進む |
| 主要UI要素 | 検索、section filter、category filter、status filter、seasonal filter、価格、税区分、最終更新、current version、warning badge |
| 呼び出すAPI | `GET /organizations/{organization_id}/stores/{store_id}/menu-items` |
| 作成されるDBレコード | 閲覧のみではなし |

UI方針:

- `enabled` / `hidden` / `deleted` を明確に区別する
- 期間終了済みの季節メニューは「hidden候補」として表示する
- 未対応カテゴリがある項目には同期停止badgeを表示する

### 5.7 Menu item edit

| 項目 | 内容 |
|---|---|
| 目的 | メニュー項目を作成・編集し、保存前previewを確認して確定する |
| 主要UI要素 | 名前、説明、section、category、price、tax_type、publish_status、sale_start_date、sale_end_date、sort_order、差分preview、保存確認 |
| 呼び出すAPI | `GET /organizations/{organization_id}/stores/{store_id}/menu-items/{item_id}`、`POST /organizations/{organization_id}/stores/{store_id}/menu-items`、`PATCH /organizations/{organization_id}/stores/{store_id}/menu-items/{item_id}`、`POST /organizations/{organization_id}/stores/{store_id}/menu-items/{item_id}/hide`、`POST /organizations/{organization_id}/stores/{store_id}/menu-items/{item_id}/delete-request` |
| 作成されるDBレコード | `menu_items`、`menu_item_versions`、`audit_logs`。必要に応じて同期候補作成時に `sync_jobs` |

UI方針:

- 保存ボタン押下後、即commitせず差分確認を表示する
- 大きな価格差分、税区分変更、`hidden` / `deleted` 変更は強調する
- `delete-request` は論理削除であり、外部サイト削除操作ではないことを表示する
- viewerには編集UIを出さない

### 5.8 CSV import upload

| 項目 | 内容 |
|---|---|
| 目的 | CSVファイルをアップロードし、preview / validationの準備をする |
| 主要UI要素 | ファイル選択、文字コード候補、ヘッダー有無表示、アップロード実行、禁止情報注意文 |
| 呼び出すAPI | `POST /organizations/{organization_id}/stores/{store_id}/csv-imports` |
| 作成されるDBレコード | 正本DBは更新しない。MVP API上のimport session / batch候補を作る。`audit_logs(event_type=csv_import_uploaded)` |

UI方針:

- upload完了時点では `menu_items` / `menu_item_versions` を作らない
- 禁止カラム名やPII疑いを検出した場合はpreviewへ進めない
- CSVファイル全文をログ表示しない

### 5.9 CSV import preview

| 項目 | 内容 |
|---|---|
| 目的 | CSV由来のCommon Menu Model候補と既存メニューとの差分を確認する |
| 主要UI要素 | 総行数、新規/更新/非公開化/削除候補/エラー/warning件数、カラム対応表、差分表、価格正規化、税区分正規化、commitボタン |
| 呼び出すAPI | `GET /organizations/{organization_id}/stores/{store_id}/csv-imports/{import_id}/preview`、`POST /organizations/{organization_id}/stores/{store_id}/csv-imports/{import_id}/preview`、`POST /organizations/{organization_id}/stores/{store_id}/csv-imports/{import_id}/validate`、`POST /organizations/{organization_id}/stores/{store_id}/csv-imports/{import_id}/commit` |
| 作成されるDBレコード | previewでは正本DBを更新しない。commit時のみ `menu_items`、`menu_item_versions(change_type=import)`、`audit_logs(event_type=csv_import_committed)` |

UI方針:

- preview と commit を画面上でも分離する
- commitボタンはvalidation成功後にだけ有効化する
- エラー行がある場合、正常行だけ取り込むかどうかはowner/adminの明示確認を必須にする
- 削除候補、非公開化候補、大きな価格差分は件数だけでなく対象行を表示する

### 5.10 Import validation errors

| 項目 | 内容 |
|---|---|
| 目的 | 取り込み不可の理由を行番号単位で確認し、CSV修正へ戻れるようにする |
| 主要UI要素 | 行番号、エラーコード、理由、対象標準カラム、warning / error filter、再アップロード導線 |
| 呼び出すAPI | `GET /organizations/{organization_id}/stores/{store_id}/csv-imports/{import_id}/errors`、`POST /organizations/{organization_id}/stores/{store_id}/csv-imports/{import_id}/validate` |
| 作成されるDBレコード | `audit_logs(event_type=csv_import_validated)`。正本DBは更新しない |

UI方針:

- エラー値を無制限に表示しない
- `password`、`cookie`、`token`、`customer_*` など禁止情報疑いは値をマスクし、import全体を停止する
- ファイル全体エラーと行単位エラーを分けて表示する

### 5.11 Category mapping

| 項目 | 内容 |
|---|---|
| 目的 | Common Menu Model側カテゴリと外部サイト側カテゴリを対応付ける |
| 主要UI要素 | Commonカテゴリ一覧、外部サイトカテゴリ一覧、未対応badge、confidence、保存確認、同期停止理由 |
| 呼び出すAPI | `GET /organizations/{organization_id}/stores/{store_id}/category-mappings`、`POST /organizations/{organization_id}/stores/{store_id}/category-mappings`、`PATCH /organizations/{organization_id}/stores/{store_id}/category-mappings/{mapping_id}` |
| 作成されるDBレコード | `category_mappings`、`audit_logs(event_type=category_mapping_updated)` |

UI方針:

- AIや推測だけでカテゴリを確定しない
- 外部サイトのoption valueは保存せず、ラベル中心で表示する
- 未対応カテゴリがある場合、Sync preview / sync job作成を停止する

### 5.12 Sync preview

| 項目 | 内容 |
|---|---|
| 目的 | 外部サイト同期候補作成前に、対象差分と安全停止要因を確認する |
| 主要UI要素 | 対象店舗、対象外部サイト、対象menu item、変更前/後、status変更、価格差分、未対応カテゴリ、mapping version、required extension version、auto_submit表示、同期候補作成ボタン |
| 呼び出すAPI | `POST /organizations/{organization_id}/stores/{store_id}/external-sync-preview`、`POST /organizations/{organization_id}/stores/{store_id}/sync-jobs` |
| 作成されるDBレコード | sync job作成時に `sync_jobs(auto_submit_enabled=false)`、`audit_logs(event_type=sync_job_created)`。必要に応じて `guardrail_events` |

UI方針:

- 同期前確認を必須にする
- 未対応カテゴリ、critical DOM diff、identity mismatch、mapping未公開はブロック表示にする
- 「外部サイトへ自動保存しません」「外部サイト管理画面で最終確認が必要です」を状態表示として出す

### 5.13 Sync job list

| 項目 | 内容 |
|---|---|
| 目的 | 店舗ごとの同期ジョブ状態を確認する |
| 主要UI要素 | job id、target site、job_type、status、started_by、created_at、finished_at、blocked reason、auto_submit=false badge |
| 呼び出すAPI | `GET /organizations/{organization_id}/stores/{store_id}/sync-jobs/{sync_job_id}` は詳細用。list APIはMVP APIで追加検討 |
| 作成されるDBレコード | 閲覧のみではなし |

UI方針:

- statusは `pending` / `running` / `waiting_user_review` / `completed` / `failed` / `cancelled` / `blocked_by_safety_check`
- `blocked_by_safety_check` は理由コードを一覧に出す
- 自動保存済みのように誤解される表現を使わない

### 5.14 Sync job detail/logs

| 項目 | 内容 |
|---|---|
| 目的 | 同期ジョブの対象、状態、ログ、停止理由を確認する |
| 主要UI要素 | job summary、mapping version、route、status timeline、log list、guardrail event、execute requestボタン |
| 呼び出すAPI | `GET /organizations/{organization_id}/stores/{store_id}/sync-jobs/{sync_job_id}`、`GET /organizations/{organization_id}/stores/{store_id}/sync-jobs/{sync_job_id}/logs`、`GET /organizations/{organization_id}/stores/{store_id}/sync-jobs/{sync_job_id}/preview`、`POST /organizations/{organization_id}/stores/{store_id}/sync-jobs/{sync_job_id}/execute-request` |
| 作成されるDBレコード | `sync_job_logs`、`audit_logs(event_type=sync_execute_requested)`、必要に応じて `guardrail_events` |

UI方針:

- ログには値そのものではなく、event type、件数、hash、score、reason codeを表示する
- Cookie / Session / Token / 生DOM / input value は表示しない
- execute requestは外部サイト保存・公開ではなく、入力補助依頼であることを表示する

### 5.15 Rollback preview

| 項目 | 内容 |
|---|---|
| 目的 | 過去versionを元に戻す前に、現在状態との差分を確認する |
| 主要UI要素 | version selector、現在値、rollback後候補、差分、影響するsync候補、rollback確定ボタン |
| 呼び出すAPI | `GET /organizations/{organization_id}/stores/{store_id}/menu-items/{item_id}/versions`、`GET /organizations/{organization_id}/stores/{store_id}/menu-items/{item_id}/versions/{version_id}`、`POST /organizations/{organization_id}/stores/{store_id}/menu-items/{item_id}/rollback-preview`、`POST /organizations/{organization_id}/stores/{store_id}/menu-items/{item_id}/rollback` |
| 作成されるDBレコード | rollback確定時に `menu_item_versions(change_type=rollback)`、`menu_item_rollbacks`、`audit_logs(event_type=menu_item_rollback_created)` |

UI方針:

- 過去versionを直接編集しない
- rollbackは新しいversionとして作成する
- rollback後に外部サイトへ反映する場合もSync previewを通す

### 5.16 Audit log view

| 項目 | 内容 |
|---|---|
| 目的 | 誰が、いつ、どの店舗で、何をしたかを確認する |
| 主要UI要素 | event_type filter、user filter、store filter、target type/id、result、reason code、created_at |
| 呼び出すAPI | audit log read API |
| 作成されるDBレコード | 閲覧のみではなし |

UI方針:

- 値そのものではなく、対象ID、version、結果、理由ラベルを表示する
- PIIや認証情報をdetailsに表示しない
- viewerは閲覧できるが、契約範囲外のstoreログは表示しない

---

## 6. 人間確認ポイント

以下は必ず人間確認を挟む。

- 新規メニュー作成確定前
- 価格変更確定前
- 税区分変更確定前
- `publish_status=hidden` への変更前
- `publish_status=deleted` への変更前
- CSV import commit前
- エラー行を除外して正常行だけ取り込む前
- 未対応カテゴリがある場合
- category mapping保存前
- sync job作成前
- sync execute request前
- rollback実行前
- 外部サイト管理画面で保存・公開する前

---

## 7. 保存 / 公開 / 削除に関する確認UI

### 7.1 保存

- Admin UI上の保存は、Common Menu Modelの保存である
- 保存前に差分previewを表示する
- 確定後に `menu_item_versions` を作成する

### 7.2 公開

- MVPでは外部サイトへの自動公開を扱わない
- `publish_status=enabled` は「掲載対象」を意味する
- 外部サイト側で公開されるかは、外部サイト管理画面上でユーザーが確認する

### 7.3 削除

- 物理削除は行わない
- 通常の販売終了は `hidden`
- 長期不要・誤作成は `deleted` の論理削除候補
- 外部サイトの削除ボタンはMVPでは押さない

確認UIでは、`hidden` と `deleted` の違いを明示する。

---

## 8. status管理UI

### 8.1 店舗

`stores.status`:

```txt
active
inactive
deleted
```

### 8.2 セクション

`menu_sections.status`:

```txt
active
hidden
deleted
```

### 8.3 メニュー項目

`menu_items.publish_status`:

```txt
enabled
hidden
deleted
```

UI表示:

| status | 表示 | 操作方針 |
|---|---|---|
| `enabled` | 掲載対象 | 通常表示 |
| `hidden` | 非公開 / 販売終了 | 同期対象にする場合は確認必須 |
| `deleted` | 論理削除 | owner/adminのみ変更可能。通常一覧から除外 |

---

## 9. seasonal menu管理UI

季節メニューは `sale_start_date` / `sale_end_date` で扱う。

主要UI:

- 販売開始日
- 販売終了日
- 期間未指定
- 期間終了済みbadge
- `hidden` 変更候補
- 季節メニューfilter

方針:

- 期間終了時に自動削除しない
- 期間終了済みは `hidden` 候補として表示する
- `sale_end_date < sale_start_date` はvalidation error
- 外部サイト側に期間UIがない場合、Target Adapter側で無視する

---

## 10. import previewとcommitのUI分離

CSV importは以下の画面遷移にする。

```txt
upload
  ↓
validate
  ↓
preview
  ↓
human review
  ↓
commit
```

preview段階:

- `menu_items` を更新しない
- `menu_item_versions` を作らない
- 新規/更新/非公開化/削除候補を表示する
- エラー行とwarningを表示する

commit段階:

- owner/adminのみ実行できる
- `menu_items` を作成/更新する
- `menu_item_versions(change_type=import)` を作成する
- `audit_logs(event_type=csv_import_committed)` を作成する

---

## 11. category mapping未設定時の停止UI

未対応カテゴリがある場合、外部サイト同期へ進めない。

停止UIに表示する項目:

- 未対応のCommonカテゴリ名
- 対象menu item件数
- 対象外部サイト
- 対応候補の外部サイトカテゴリ
- Category mapping画面への導線
- `unmapped_category` reason code

方針:

- 未対応カテゴリを自動確定しない
- operatorはlimited権限の場合のみmapping保存できる
- viewerは停止理由のみ確認できる

---

## 12. sync前確認UI

sync前確認UIは `external-sync-preview` と `sync-jobs/{id}/preview` の結果を表示する。

表示内容:

- 対象店舗
- 対象外部サイト
- 対象menu item / version
- 変更前/変更後
- 価格差分
- status変更
- category mapping状態
- mapping version
- required extension version
- identity check状態
- safety stop候補
- `auto_submit_enabled=false`

停止条件:

- 未対応カテゴリ
- mapping version未公開
- required extension version不一致
- store identity mismatch
- critical DOM diff
- prohibited data detected
- `auto_submit_enabled=true` が検出された場合

---

## 13. auto_submit_enabled=false の表示方針

MVPでは `auto_submit_enabled` は常に `false` である。

対象:

- `store_site_accounts.auto_submit_enabled`
- `sync_jobs.auto_submit_enabled`
- `mapping_versions.mapping_json.submit.autoSubmit`
- `mapping_versions.mapping_json.safety.autoSubmit`
- `mapping_versions.safety_json.auto_submit_enabled`

UI方針:

- Store detail、Sync preview、Sync job detailで「自動保存/自動公開なし」と表示する
- ユーザーがtrueへ変更できるUIを作らない
- APIやmappingにtrueが混入した場合は `auto_submit_not_allowed` として停止する

---

## 14. エラー表示方針

エラーは機械処理用 `code` と人間向けmessageを分ける。

代表コード:

```txt
unauthorized
forbidden
not_found
validation_error
required_field_missing
invalid_price
invalid_tax_policy
invalid_status
unmapped_category
version_conflict
safety_stop
auto_submit_not_allowed
prohibited_data_detected
```

UI方針:

- 画面上部に要約、対象行・対象項目に詳細を表示する
- CSV行エラーは行番号と標準カラムで表示する
- sync停止はreason codeと解消導線を表示する
- 認証情報、Cookie、Session、Token、生DOM、input value はエラー詳細に表示しない

---

## 15. PIIを表示・保存しない方針

管理画面は以下を表示・保存しない。

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
customer_name
customer_phone
customer_email
personal_note
```

例外的に、店舗識別に必要な店舗名、住所、電話番号、管理画面URL、外部店舗IDは目的を限定して表示・保存する。

保存先は以下に限定する。

- `stores`
- `store_site_accounts`
- `store_site_identity_checks`
- `audit_logs` には対象IDと理由ラベル中心で保存

---

## 16. MVPで作る画面

- Login / Account
- Organization switch
- Store list
- Store detail
- Menu sections
- Menu item list
- Menu item edit
- CSV import upload
- CSV import preview
- Import validation errors
- Category mapping
- Sync preview
- Sync job list
- Sync job detail/logs
- Rollback preview
- Audit log view

---

## 17. MVPで作らない画面

- 外部サイト管理画面の埋め込み
- 外部サイト管理画面の解析UI
- 外部サイトの自動保存UI
- 外部サイトの自動公開UI
- 外部サイトの削除実行UI
- Cookie / Session / Token 管理UI
- 生DOM viewer
- input value viewer
- 画像アップロード一括管理
- アレルゲン自動判定UI
- AIカテゴリ自動確定UI
- 複数店舗一括編集
- 高度なDOM diff可視化
- Chrome拡張本体の設定画面

---

## 18. Phase後送り

- Chrome拡張MVP画面との詳細連携
- DOM diff visualization
- mapping JSON publish workflow
- CSV column mapping learning
- 複数店舗一括更新
- 複数店舗一括同期
- 多言語メニュー
- コース料理
- 複数価格、サイズ別価格、時価
- 画像アップロード補助
- アレルゲン外部サイト反映
- AIカテゴリ候補
- CSVテンプレート生成UI
- 自動保存・自動公開の限定解禁

---

## 19. TODO

- [ ] Sync job list APIの正式エンドポイントを `docs/14_api-mvp-design.md` に追加する
- [ ] CSV import session / batch をDBテーブル化するか決める
- [ ] `sync_jobs.summary_json` のUI表示schemaを定義する
- [ ] `audit_logs.details_json` の表示可能フィールドを定義する
- [ ] 価格差分warningの閾値を決める
- [ ] Category mappingのlimited権限条件を定義する
- [ ] Menu item editの保存前preview APIを作るか、client差分表示にするか決める
- [ ] Store detailで表示するidentity check項目のマスク粒度を決める
- [ ] `deleted` の保持期間と物理削除条件をセキュリティポリシーと整合させる
- [ ] MVP UIの画面遷移図を別途作成する
