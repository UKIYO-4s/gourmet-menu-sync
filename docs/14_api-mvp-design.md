# API MVP Design

## 1. 目的

API MVP は、Menu Sync System の自社DB正本、CSV import、Common Menu Model、同期ジョブ、監査ログを接続するためのAPI境界を定義する。

MVPでは外部サイト管理画面の解析、自動保存、自動公開は扱わない。APIは、管理画面と将来のChrome拡張MVPが安全に連携できるよう、認可、validation、preview、履歴、ログの責務を明確にする。

---

## 2. API設計の基本方針

- REST風のエンドポイントを基本案とする
- 実装言語、フレームワーク、DB実装はまだ固定しない
- すべての更新は organization / store スコープを検査する
- preview と commit を分離する
- `menu_item_versions` は追記型で作成する
- rollback は過去versionを直接復元せず、新versionを作る
- 外部サイト同士を直接変換しない
- CSVは必ず Common Menu Model へ変換する
- `sync_jobs.auto_submit_enabled=false` を維持する
- 認証情報、Cookie、Session、Token、生DOM、input value は保存しない

---

## 3. 認証・認可の前提

Admin Web と将来のChrome拡張は同一API認証基盤を使う。

### 認証

- APIリクエストは認証済みユーザーに紐づく
- アクセストークンは短期有効期限を前提にする
- APIは外部サイトのログインID、パスワード、Cookie、Session、Tokenを保存しない
- 認証方式はMVP設計段階では未確定。自前認証/OIDC等は別途決定する

### 認可

認可は以下の順で検査する。

```txt
authenticated user
  ↓
organization membership
  ↓
store permission
  ↓
role permission
  ↓
resource ownership
```

---

## 4. organization / store スコープ検査

すべての店舗関連APIは、対象 `store_id` がユーザーの所属organizationまたは許可されたstoreに属することを確認する。

### 検査対象

- `organization_id`
- `store_id`
- `menu_id`
- `menu_item_id`
- `store_site_account_id`
- `mapping_version_id`
- `sync_job_id`
- `audit_log_id`

### 方針

- URLに `organization_id` または `store_id` を含める
- body内のIDとURLスコープが矛盾する場合は `403` または `409`
- storeをまたぐ一括操作はMVP対象外
- viewerは更新系APIを実行できない

---

## 5. owner / admin / operator / viewer の権限制御

| 操作 | owner | admin | operator | viewer |
|---|---:|---:|---:|---:|
| 店舗閲覧 | yes | yes | yes | yes |
| メニュー閲覧 | yes | yes | yes | yes |
| メニュー作成/編集 | yes | yes | yes | no |
| 非公開化候補作成 | yes | yes | yes | no |
| `deleted` への変更 | yes | yes | no | no |
| CSV preview | yes | yes | yes | no |
| CSV commit | yes | yes | no | no |
| rollback | yes | yes | no | no |
| category mapping編集 | yes | yes | limited | no |
| sync job作成 | yes | yes | limited | no |
| audit log閲覧 | yes | yes | limited | yes |

`limited` は店舗単位の権限と運用設定に従う。

---

## 6. メニュー管理API

### menu_sections

```txt
GET    /organizations/{organization_id}/stores/{store_id}/menu-sections
POST   /organizations/{organization_id}/stores/{store_id}/menu-sections
PATCH  /organizations/{organization_id}/stores/{store_id}/menu-sections/{section_id}
```

方針:

- 物理削除ではなく `status=hidden` または `status=deleted`
- 並び順は `sort_order`
- セクション変更は audit log 対象

### menu_items

```txt
GET    /organizations/{organization_id}/stores/{store_id}/menu-items
GET    /organizations/{organization_id}/stores/{store_id}/menu-items/{item_id}
POST   /organizations/{organization_id}/stores/{store_id}/menu-items
PATCH  /organizations/{organization_id}/stores/{store_id}/menu-items/{item_id}
POST   /organizations/{organization_id}/stores/{store_id}/menu-items/{item_id}/hide
POST   /organizations/{organization_id}/stores/{store_id}/menu-items/{item_id}/delete-request
```

方針:

- `POST` / `PATCH` 確定時に `menu_item_versions` を作成する
- `hide` は `publish_status=hidden`
- `delete-request` は論理削除候補。物理削除しない
- 価格、税区分、カテゴリ、販売期間は validation 対象

### menu_item_versions

```txt
GET /organizations/{organization_id}/stores/{store_id}/menu-items/{item_id}/versions
GET /organizations/{organization_id}/stores/{store_id}/menu-items/{item_id}/versions/{version_id}
```

方針:

- 追記型履歴
- 直接更新APIは作らない
- rollbackは専用APIを使う

---

## 7. CSV import API

CSV import API は upload / preview / validate / commit を分ける。

### upload

```txt
POST /organizations/{organization_id}/stores/{store_id}/csv-imports
```

役割:

- CSVファイルを受け取る
- ファイル単位 validation を行う
- import session / batch 候補を作る
- ただし `menu_items` / `menu_item_versions` は更新しない

### preview

```txt
GET  /organizations/{organization_id}/stores/{store_id}/csv-imports/{import_id}/preview
POST /organizations/{organization_id}/stores/{store_id}/csv-imports/{import_id}/preview
```

役割:

- カラム名の揺れ対応結果を表示
- Common Menu Model 変換候補を表示
- 新規/更新/非公開化/削除候補/エラー行/warningを表示
- 既存 `menu_items` との差分を表示

### validate

```txt
POST /organizations/{organization_id}/stores/{store_id}/csv-imports/{import_id}/validate
```

役割:

- 必須カラム検査
- 行単位 validation
- 価格、税区分、status、日付、重複、未対応カテゴリの検査
- 保存禁止情報らしきカラム名を検出

### commit

```txt
POST /organizations/{organization_id}/stores/{store_id}/csv-imports/{import_id}/commit
```

役割:

- ユーザーが preview と validation を確認した後に実行
- `menu_items` を作成/更新
- `menu_item_versions` を `change_type=import` で作成
- `audit_logs` に `csv_import_confirmed` を記録
- 必要に応じて同期候補を作る

### error rows

```txt
GET /organizations/{organization_id}/stores/{store_id}/csv-imports/{import_id}/errors
```

方針:

- 行番号、標準化エラー種別、理由ラベルを返す
- エラー行の値を無制限に返さない
- 個人情報や認証情報が疑われる値は返さない

---

## 8. import preview と本登録の分離

preview段階ではDBの正本を更新しない。

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
  ↓
menu_items / menu_item_versions
```

### 分離する理由

- CSV列マッピングの誤判定を防ぐ
- 削除/非公開化を人間が確認できる
- 価格差分や未対応カテゴリを確認できる
- エラー行を除外または修正できる
- `menu_item_versions` を確定操作にだけ作る

---

## 9. Common Menu Model 変換API

内部APIとして、入力データを Common Menu Model 候補へ変換する境界を定義する。

```txt
POST /organizations/{organization_id}/stores/{store_id}/common-menu/transform
```

入力元候補:

- CSV import session
- Admin Web form
- 将来の外部サイト読み取り結果

方針:

- 変換結果は候補であり、commit前に validation / preview を通す
- 外部サイト同士を直接変換しない
- `raw_source_json` には非機密情報のみ入れる
- Cookie、Session、Token、生DOM、input value は受け付けない

---

## 10. category mapping API

```txt
GET   /organizations/{organization_id}/stores/{store_id}/category-mappings
POST  /organizations/{organization_id}/stores/{store_id}/category-mappings
PATCH /organizations/{organization_id}/stores/{store_id}/category-mappings/{mapping_id}
```

方針:

- Common Menu Model 側カテゴリと外部サイト側カテゴリを対応付ける
- 店舗単位で管理する
- 未対応カテゴリがある場合は外部サイト同期前に停止
- 外部サイト option value は保存せず、ラベル中心で扱う
- 更新時は audit log に `category_mapping_updated` を残す

---

## 11. sync_jobs API

### create

```txt
POST /organizations/{organization_id}/stores/{store_id}/sync-jobs
```

役割:

- 自社DB上の変更確定後、外部サイト同期候補として作成
- `auto_submit_enabled=false` を強制する
- 対象menu item version、mapping version、routeを紐づける

### preview

```txt
GET /organizations/{organization_id}/stores/{store_id}/sync-jobs/{sync_job_id}/preview
```

役割:

- 対象メニュー差分
- 未対応カテゴリ
- 価格差分
- mapping version
- required extension version
- safety stop候補

### execute_request

```txt
POST /organizations/{organization_id}/stores/{store_id}/sync-jobs/{sync_job_id}/execute-request
```

役割:

- 将来のChrome拡張MVPに入力補助リクエストを渡すための状態遷移
- 自動保存・自動公開はしない
- `status=waiting_user_review` など、人間確認前提の状態にする

### status

```txt
GET /organizations/{organization_id}/stores/{store_id}/sync-jobs/{sync_job_id}
```

### logs

```txt
GET /organizations/{organization_id}/stores/{store_id}/sync-jobs/{sync_job_id}/logs
```

方針:

- logsには値そのものではなく、event type、理由ラベル、score、hash、件数を保存する
- Cookie、Session、Token、生DOM、input value は保存しない

---

## 12. audit_logs に残す操作

APIは以下を audit log 対象にする。

- login
- store selected
- menu item created
- menu item updated
- menu item hidden
- menu item delete requested
- menu item rollback created
- csv import uploaded
- csv import previewed
- csv import validated
- csv import committed
- category mapping updated
- sync candidate created
- sync job created
- sync execute requested
- safety stop acknowledged

audit logには値そのものではなく、対象ID、version、result、reason code、timestampを中心に保存する。

---

## 13. rollback API

```txt
POST /organizations/{organization_id}/stores/{store_id}/menu-items/{item_id}/rollback-preview
POST /organizations/{organization_id}/stores/{store_id}/menu-items/{item_id}/rollback
```

方針:

- rollback-preview で現在状態との差分を表示する
- rollback確定時に過去versionを元に新しいversionを作る
- `change_type=rollback`
- `menu_item_rollbacks.from_version_id / to_version_id` を記録する
- rollback後の外部サイト反映は別途 sync job で扱う

---

## 14. 外部サイト同期前確認API

```txt
POST /organizations/{organization_id}/stores/{store_id}/external-sync-preview
```

役割:

- 外部サイト同期前に、対象メニューと差分を確認する
- 未対応カテゴリ、安全停止候補、価格差分を確認する
- mapping version / required extension version を確認する
- sync job作成前の人間確認に使う

MVPではこのAPIは外部サイトへ保存・公開しない。

---

## 15. mapping_versions 取得API

```txt
GET /mapping-versions?site={site_key}&page={page_key}
GET /mapping-versions/{mapping_version_id}
```

方針:

- `status=published` のみを通常配信する
- `required_extension_version` を返す
- `submit.autoSubmit=false` / `auto_submit_enabled=false` をvalidationする
- 拡張側が必要な場合に備え、将来APIとして設計する

---

## 16. Chrome拡張MVPと接続する将来API

将来のChrome拡張MVP向けに以下を想定する。

```txt
GET  /extension/me
GET  /extension/stores
GET  /extension/mapping-versions?site={site_key}&page={page_key}
GET  /extension/sync-jobs/{sync_job_id}
POST /extension/sync-jobs/{sync_job_id}/report
POST /extension/dom-snapshots
POST /extension/safety-stops
```

MVP設計時点の方針:

- host_permissionsは必要サイトに限定する
- 拡張は外部サイトの認証情報を送らない
- DOM snapshotはサニタイズ済み構造情報のみ
- input value、生DOM、hidden valueは受け取らない
- 保存・公開・削除クリック結果をAPIで要求しない

---

## 17. エラーレスポンス方針

エラーは機械処理可能な `code` と、人間向けの `message` を分ける。

例:

```json
{
  "error": {
    "code": "required_field_missing",
    "message": "Required field is missing.",
    "details": {
      "field": "item_name"
    }
  }
}
```

### 代表コード

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

エラー詳細に認証情報、Cookie、Session、Token、生DOM、input value を含めない。

---

## 18. バリデーション方針

### 共通

- organization / store scope
- role permission
- required fields
- enum values
- date range
- price format
- category mapping
- version conflict
- prohibited data

### CSV import

- 必須カラム
- カラム名揺れの確信度
- 行単位validation
- エラー行
- 禁止カラム名

### sync job

- mapping version exists
- mapping status is published
- required extension version
- `auto_submit_enabled=false`
- required target fields are resolvable
- store identity check is required before execution

---

## 19. 保存禁止情報

APIは以下を保存しない。

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

API request body、error response、logs、audit logs、sync job logs、raw_source_json、summary_json、details_json に混入させない。

---

## 20. MVPで作るAPI

- organization / store read API
- menu section CRUD
- menu item CRUD
- menu item version read
- CSV import upload / preview / validate / commit / errors
- Common Menu Model transform boundary
- category mapping CRUD
- sync job create / preview / execute_request / status / logs
- audit log read
- rollback preview / rollback
- external sync preview
- mapping version read

---

## 21. MVPで作らないAPI

- 外部サイトの自動保存API
- 外部サイトの自動公開API
- 外部サイトの削除API
- 外部サイト認証情報保存API
- Cookie / Session / Token 受信API
- 生DOM保存API
- input value保存API
- 画像アップロード実行API
- 複数店舗一括更新API
- AI自動確定API

---

## 22. Phase後送り

- Chrome拡張MVP実装用APIの詳細化
- DOM diff visualization API
- mapping JSON publish workflow API
- CSV column mapping learning API
- 複数店舗一括同期API
- 画像アップロード補助API
- アレルゲン外部反映API
- AIカテゴリ候補API
- 自動保存・自動公開の限定解禁

---

## 23. TODO

- [ ] APIレスポンスの標準 envelope を定義する
- [ ] `sync_jobs.summary_json` のschemaを定義する
- [ ] `audit_logs.details_json` のschemaを定義する
- [ ] CSV import session / batch をDBに持つか決める
- [ ] OpenAPI化するか検討する
- [ ] 認証方式（自前/OIDC）を決める
- [ ] APIフレームワークを決める
- [ ] D1採用時のJSON validation責務を整理する
- [ ] Chrome拡張MVP向けAPIの詳細をPhase 2で更新する
