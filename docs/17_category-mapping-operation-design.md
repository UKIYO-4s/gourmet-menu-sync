# Category Mapping Operation Design

## 1. category mapping の目的

このドキュメントは、Menu Sync System におけるカテゴリマッピングの運用設計を定義する。

category mapping は、自社DBやCSVで管理する Common Menu Model 側カテゴリと、店舗ごと・外部サイトごとに異なる外部サイトカテゴリを対応付けるための仕組みである。

MVPでは、未マッピングカテゴリがある場合は同期を停止する。自動推測だけでカテゴリを確定せず、人間確認を必須にする。

---

## 2. なぜカテゴリマッピングが必要か

外部サイトごとにカテゴリ体系は異なる。

例:

- 自社DBでは「ドリンク」だが、外部サイトでは「お飲み物」「アルコール」「ソフトドリンク」に分かれる
- CSVでは「季節限定」だが、外部サイトでは「おすすめ」へ入れる運用にしている
- 店舗Aでは「ランチ」を独立カテゴリにするが、店舗Bでは「料理」にまとめる
- 外部サイト側でカテゴリ名が変更・削除される

外部サイト側カテゴリへ直接変換すると、サイト・店舗・入力元ごとの差分が分散する。そのため、必ず Common Menu Model 側カテゴリを基準にし、店舗単位の `category_mappings` で外部サイトカテゴリへ対応させる。

```txt
common.category_name
  ↓
category_mappings
  ↓
site_store_categories
```

---

## 3. 対象となるカテゴリ差分

### 3.1 自社DBカテゴリ

Admin UIで入力する `menu_items.category_name` を Common Menu Model 側カテゴリとして扱う。

例:

- 前菜
- メイン
- ドリンク
- ランチ
- 季節限定

### 3.2 CSVカテゴリ

CSVの `category_name` は、取り込み時に Common Menu Model 側カテゴリへ正規化する。

方針:

- CSVカテゴリを外部サイトカテゴリへ直接変換しない
- import previewで新規カテゴリ、未知カテゴリ、表記ゆれを表示する
- CSV由来カテゴリが未マッピングの場合、sync preview / sync jobで停止する

### 3.3 外部サイトカテゴリ

外部サイト側のカテゴリ候補は `site_store_categories` に保存する。

保存する情報:

- `store_site_account_id`
- `external_site_id`
- `category_key`
- `category_name`
- `parent_category_id`
- `external_category_id`
- `source`
- `status`
- `first_detected_at`
- `last_detected_at`

保存しない情報:

- select option の raw value
- Cookie / Session / Token
- 生DOM
- input value
- hidden value

### 3.4 店舗固有カテゴリ

同じ外部サイトでも、店舗ごとにカテゴリ構成が異なる場合がある。

例:

- 店舗Aは「コース」を使う
- 店舗Bは「宴会」を使う
- 店舗Cは「期間限定」を手動追加している

そのため、外部サイトカテゴリは `store_site_accounts` に紐づく `site_store_categories` として店舗単位で扱う。

---

## 4. category_mappings の役割

`category_mappings` は、Common Menu Model 側カテゴリと外部サイト側カテゴリを対応付ける店舗単位の運用テーブルである。

主要フィールド:

- `store_id`
- `from_source_id`
- `to_source_id`
- `from_category_name`
- `to_category_id`
- `to_category_name`
- `confidence_score`
- `created_by_user_id`
- `created_at`
- `updated_at`

役割:

- 自社DBカテゴリから外部サイトカテゴリへの対応を保持する
- CSV由来カテゴリから外部サイトカテゴリへの対応を保持する
- sync preview / sync job validationで未対応カテゴリを検出する
- Target Adapterが外部サイト入力補助時に参照する
- audit logにより、誰が対応付けを変更したか追跡可能にする

方針:

- MVPでは店舗単位で管理する
- 外部サイト側カテゴリはラベル中心で扱う
- `confidence_score` は人間確認済みなら原則 `1.000`
- 低confidenceの候補は保存しても同期実行前に確認対象にする
- 自動推測だけで `confidence_score=1.000` にしない

---

## 5. store_mapping_overrides の役割

`store_mapping_overrides` は、標準Mapping JSONやサイト共通設定を店舗単位で上書きするための将来テーブル候補である。

現状:

- `docs/05_mapping-json-design.md` ではStore Overrideとして言及されている
- 現行 `database/schema-draft.sql` には未定義
- MVPのカテゴリ対応は `category_mappings` に集約する

想定する役割:

- 店舗ごとのdefault categoryを指定する
- 店舗ごとの税区分・表示ルールなど、カテゴリ以外のtarget変換設定を上書きする
- 標準mapping versionを店舗事情で補正する

MVP方針:

- `store_mapping_overrides` は作らない
- カテゴリ対応は `category_mappings` のみで管理する
- 将来、カテゴリ以外の店舗別上書きが必要になった段階で設計する

---

## 6. 初回店舗セットアップ時のカテゴリ読み込み

初回店舗セットアップでは、外部サイトカテゴリ候補を取得し、`site_store_categories` に保存する。

想定フロー:

```txt
1. organizationを作成
2. storeを作成
3. external_siteを選択
4. store_site_accountを作成
5. 外部サイトカテゴリ候補を取得
6. site_store_categoriesへ保存
7. Commonカテゴリとの対応表を作成
8. category_mappingsへ保存
9. 未マッピングカテゴリがないことを確認
10. sync preview / sync job作成を許可
```

方針:

- 初回セットアップ完了条件にcategory mapping完了を含める
- 外部サイトカテゴリが取得できない場合は「外部サイト解析待ち」として扱う
- 外部サイトカテゴリ取得の具体実装はMVP時点では未確定

---

## 7. 外部サイトカテゴリの取得方針

外部サイトカテゴリの取得方法はMVP設計段階では固定しない。

将来候補:

- Chrome拡張MVPがサニタイズ済みDOM構造からカテゴリラベルを検出する
- 管理者がAdmin UIで手動登録する
- CSVや既存設定からimportする
- 外部サイト公開情報から非認証で取得できる範囲を使う

保存方針:

- `site_store_categories.source` は `detected` / `manual` / `imported`
- option valueや内部IDは保存しないか、保存する場合も非機密IDに限定する
- 生DOM、input value、hidden valueは保存しない
- 店舗識別に必要な情報以外の個人情報は扱わない

停止方針:

- 外部サイトカテゴリが未取得の場合は同期停止
- `site_store_categories.status=hidden` / `deleted` のカテゴリへは同期しない
- カテゴリ一覧にcriticalなDOM差分がある場合は同期停止

---

## 8. ユーザーによる手動マッピング

Admin UIのCategory mapping画面で、ユーザーが手動で対応付けを確定する。

主要UI:

- Commonカテゴリ一覧
- 外部サイトカテゴリ一覧
- 未対応badge
- confidence表示
- 保存前確認
- 同期停止理由
- 対象menu item件数

操作方針:

- owner / admin は作成・更新可能
- operator はlimited権限の場合のみ作成・更新可能
- viewer は閲覧のみ
- 自動候補は提示してもよいが、確定には人間確認を必須にする
- 保存時は `audit_logs(event_type=category_mapping_updated)` を残す

---

## 9. 未マッピングカテゴリの停止条件

未マッピングカテゴリがある場合、外部サイト同期へ進めない。

停止条件:

- `menu_items.category_name` に対応する `category_mappings.from_category_name` がない
- `category_mappings.to_category_id` が存在しない
- `category_mappings.to_category_id` の `site_store_categories.status` が `hidden` / `deleted`
- `category_mappings.to_source_id` が対象外部サイトのsourceではない
- `confidence_score` が運用閾値を下回る
- 外部サイトカテゴリ一覧が未取得

停止時の扱い:

- sync previewで `unmapped_category` を表示
- `sync_jobs.status=blocked_by_safety_check`
- `sync_job_logs(event_type=unmapped_category_detected)`
- `guardrail_events(guardrail_type=category_mapping, reason_code=unmapped_category, must_stop=true)`
- Category mapping画面への導線を表示

---

## 10. 1対1 / 1対多 / 多対1 の扱い

### 10.1 1対1

MVPの標準。

```txt
Common: ドリンク
  ↓
External: ドリンク
```

方針:

- `category_mappings` 1行で表現する
- sync job validationで最優先で扱う

### 10.2 1対多

Commonカテゴリ1つを外部サイト側の複数カテゴリへ分岐するケース。

例:

```txt
Common: ドリンク
  ↓
External: アルコール / ソフトドリンク
```

MVP方針:

- 原則扱わない
- 分岐が必要な場合はCommonカテゴリ側を分ける
- 自動分岐はしない
- Phase後送りとして、ルールベース分岐や補助カテゴリを検討する

### 10.3 多対1

複数Commonカテゴリを外部サイト側の1カテゴリへまとめるケース。

例:

```txt
Common: 前菜
Common: メイン
  ↓
External: 料理
```

MVP方針:

- 許容する
- `from_category_name` ごとに `category_mappings` を作る
- sync previewで「複数Commonカテゴリが同一外部カテゴリへ入る」ことを確認表示する

---

## 11. カテゴリ削除・名称変更時の扱い

### 11.1 外部サイトカテゴリ削除

外部サイト側カテゴリが削除された可能性がある場合:

- `site_store_categories.status=deleted` または `hidden` にする
- 既存 `category_mappings` は物理削除しない
- sync previewで停止する
- ユーザーに再マッピングを求める

### 11.2 外部サイトカテゴリ名称変更

名称変更が検出された場合:

- `site_store_categories.category_name` を更新するか、新規カテゴリとして扱うかを人間確認する
- `category_mappings.to_category_name` との差分をwarning表示する
- 自動で既存mappingを置き換えない

### 11.3 Commonカテゴリ名称変更

Commonカテゴリ名を変更する場合:

- 対象menu item件数を表示する
- 既存 `category_mappings.from_category_name` への影響を表示する
- 変更後カテゴリが未マッピングなら同期停止する
- 変更確定時にaudit logを残す

---

## 12. 季節カテゴリの扱い

季節メニューは、原則 `sale_start_date` / `sale_end_date` と `publish_status` で管理する。

方針:

- 「季節限定」カテゴリは通常カテゴリとして扱う
- 季節終了はカテゴリ削除ではなく `publish_status=hidden` 候補として扱う
- 外部サイト側に季節カテゴリがない場合は、別カテゴリへ手動マッピングする
- 季節カテゴリの自動切り替えはMVPでは行わない
- 期間終了済みメニューがある場合はimport preview / sync previewで確認する

---

## 13. import previewとの関係

CSV import previewでは、CSV由来カテゴリをCommonカテゴリ候補として表示する。

表示内容:

- CSV内カテゴリ一覧
- 新規Commonカテゴリ候補
- 表記ゆれ候補
- 既存Commonカテゴリとの一致候補
- 未マッピングカテゴリ
- 未マッピングカテゴリを含む行数
- 外部サイト同期時の停止予定

方針:

- CSV import自体は `category_name` が空でも可能
- 外部サイト同期では未マッピングカテゴリとして停止する
- CSVカテゴリを外部サイトカテゴリへ直接変換しない
- import commit後に必要なcategory mappingを作る

---

## 14. sync previewとの関係

sync previewでは、対象menu itemのカテゴリ対応状態を必ず表示する。

表示内容:

- 対象menu item / version
- Commonカテゴリ
- 対応する外部サイトカテゴリ
- mapping confidence
- 外部サイトカテゴリstatus
- 未マッピングカテゴリ
- 多対1 mappingの確認
- safety stop候補

方針:

- 未マッピングカテゴリが1件でもあればsync job作成またはexecute requestを停止する
- 低confidenceのmappingは人間確認を要求する
- `site_store_categories.status=hidden` / `deleted` は停止する

---

## 15. sync_jobs停止条件との関係

category mappingはsync job validationの停止条件である。

関連event:

- `category_mapping_checked`
- `unmapped_category_detected`
- `safety_stop`

関連reason code:

- `unmapped_category`
- `target_category_hidden`
- `target_category_deleted`
- `category_mapping_confidence_low`
- `external_site_categories_missing`

停止時に作る記録:

- `sync_job_logs(event_type=unmapped_category_detected)`
- `guardrail_events(guardrail_type=category_mapping, reason_code=unmapped_category, must_stop=true)`
- `audit_logs(event_type=sync_validation_failed, result=blocked)`

---

## 16. audit_logsに残す操作

監査ログに残す操作。

- `category_mapping_created`
- `category_mapping_updated`
- `category_mapping_deleted`
- `category_mapping_reviewed`
- `site_store_categories_imported`
- `site_store_categories_updated`
- `category_mapping_rollback_created`
- `sync_validation_failed`

保存する内容:

- `organization_id`
- `store_id`
- `user_id`
- `event_type`
- `target_type`
- `target_id`
- `result`
- reason code
- from category label
- to category id
- mapping versionまたはcategory mapping version
- timestamp

保存しない内容:

- Cookie / Session / Token
- 生DOM
- input value
- hidden value
- 外部サイトログイン情報
- 個人情報を含む自由入力

---

## 17. versioning方針

現行DDLでは `category_mappings` にversionテーブルはない。

MVP方針:

- `category_mappings` は現在状態として扱う
- 更新時は `audit_logs` に変更操作を残す
- 変更前後の詳細schemaはTODOで定義する
- `created_at` / `updated_at` と `created_by_user_id` を使って最低限の追跡を行う

将来方針:

- `category_mapping_versions` を追加する
- mappingごとにversion number、change_type、from/to、created_byを保存する
- `published` / `deprecated` / `rollback` 状態を持たせる
- sync jobには使用したcategory mapping versionを紐づける

---

## 18. rollback方針

MVPでは、category mappingのrollback専用テーブルは未定義である。

MVP方針:

- rollbackは手動再設定で行う
- 変更履歴は `audit_logs` で追跡する
- rollback実行前に対象menu item件数とsync job影響範囲を表示する
- rollback後もsync preview / sync job validationを通す

将来方針:

- `category_mapping_versions` を追加した後、過去versionを元に新versionを作る
- 過去versionを直接復元しない
- rollback操作は `category_mapping_rollback_created` としてaudit logへ残す

---

## 19. UI上の確認ポイント

人間確認が必要な箇所。

- 初回店舗セットアップで外部サイトカテゴリを保存する前
- Commonカテゴリと外部サイトカテゴリを対応付ける前
- 自動候補を採用する前
- 多対1 mappingを保存する前
- Commonカテゴリ名を変更する前
- 外部サイトカテゴリ削除・名称変更を反映する前
- 季節カテゴリを通常カテゴリへ割り当てる前
- import commit後に新規カテゴリが発生した時
- sync previewで未マッピングカテゴリが検出された時
- category mapping rollback相当の再設定を行う前

UI方針:

- 未マッピングカテゴリは赤系の停止badgeで表示する
- 保存前に対象menu item件数を表示する
- 外部サイト側カテゴリstatusを表示する
- 自動推測候補には「未確定」と表示する
- viewerには保存ボタンを出さない

---

## 20. セキュリティ・プライバシー方針

カテゴリマッピング運用では以下を扱わない。

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

外部サイトカテゴリ取得時も、保存するのはサニタイズ済みカテゴリラベル、hash、非機密ID、status、timestampに限定する。

---

## 21. MVPで扱う範囲

MVPで扱う範囲。

- 店舗単位の `category_mappings`
- 外部サイトカテゴリ候補の `site_store_categories` 保存設計
- Admin UIでの手動マッピング
- CSVカテゴリのimport preview表示
- sync previewでの未マッピング検出
- sync job validationでの停止
- 1対1 mapping
- 多対1 mapping
- 季節カテゴリの手動mapping
- audit log記録
- `store_mapping_overrides` は概念整理のみ

---

## 22. MVPで扱わない範囲

MVPでは扱わない範囲。

- 外部サイトカテゴリ取得の具体実装
- 外部サイト管理画面の解析UI
- 自動推測だけによるmapping確定
- 1対多mappingの自動分岐
- category mapping専用version table
- category mapping rollback専用UI
- 複数店舗一括mapping
- AIカテゴリ自動確定
- 外部サイトoption value保存
- Cookie / Session / Token / 生DOM / input value の保存

---

## 23. Phase後送り

- `category_mapping_versions`
- `store_mapping_overrides`
- 1対多mappingルール
- 複数店舗一括category mapping
- AIカテゴリ候補
- CSVカテゴリ表記ゆれ学習
- 外部サイトカテゴリ変更検出workflow
- category mapping rollback UI
- mapping confidence閾値の運用自動化
- 外部サイトカテゴリ取得実装
- sync jobへのcategory mapping version固定

---

## 24. TODO

- [ ] `category_mapping_versions` を作るか決める
- [ ] `store_mapping_overrides` のDDLを作るか決める
- [ ] `category_mappings` のunique制約方針を決める
- [ ] `confidence_score` の停止閾値を決める
- [ ] 外部サイトカテゴリ取得時に保存可能なJSON schemaを定義する
- [ ] `audit_logs.details_json` に保存可能なcategory mapping差分schemaを定義する
- [ ] 多対1mappingのUI表示文言を定義する
- [ ] 1対多mappingをPhase後続で扱う場合のルール形式を検討する
- [ ] Commonカテゴリ名称変更時の影響範囲previewを設計する
- [ ] `docs/14_api-mvp-design.md` にcategory mapping validation endpointが必要か検討する
