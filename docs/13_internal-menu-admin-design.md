# Internal Menu Admin Design

## 1. 目的

このドキュメントは、飲食店が自社側でメニューを管理するための管理画面と、自社DBを正本にする運用フローを定義する。

自社DB正本フローでは、Admin Webで編集・確定したメニュー情報を Common Menu Model として `menu_items` / `menu_item_versions` に保存し、必要に応じて外部サイト同期候補を作る。

```txt
Admin Web
  ↓
Common Menu Model
  ↓
menu_items / menu_item_versions
  ↓
Target Adapter
  ↓
External Site
```

MVPでは外部サイトへの自動保存・自動公開は扱わない。Chrome拡張MVPへ進む前でも、自社DB正本の設計は外部サイト非依存で進められる。

---

## 2. 対象ユーザー

### 飲食店オーナー

- 店舗全体のメニュー管理方針を決める
- 公開/非公開、価格変更、季節終了、rollbackを承認する
- 外部サイト同期前の最終確認を行う

### 店舗担当者

- 日々のメニュー追加・編集を行う
- CSV import preview を確認する
- 説明文、価格、カテゴリ、販売期間を更新する

### 飲食コンサル

- 複数店舗のメニュー改善を支援する
- カテゴリ整理、価格見直し、外部サイト反映候補を提案する
- 操作権限は契約範囲に限定する

### 運用代行者

- 店舗に代わってメニュー更新作業を行う
- 外部サイト同期前に差分と安全停止理由を確認する
- 保存・公開の最終判断は契約上の運用ルールに従う

---

## 3. 管理画面で扱うメニュー構造

管理画面は Common Menu Model を編集するUIであり、外部サイト固有フォームを直接編集するUIではない。

### menu_section

- セクション名
- 説明
- 表示順
- `active` / `hidden` / `deleted`

### menu_item

- メニュー名
- 所属セクション
- 共通カテゴリ
- 表示順
- 現在version

### price

- 金額
- 通貨。MVPでは `JPY`
- 大きな価格差分は確認対象

### tax_policy

```txt
tax_included
tax_excluded
tax_unknown
```

### description

- 説明文
- 外部サイト反映時の文字数制限は Target Adapter 側で扱う

### allergens

- MVPでは保存設計と表示候補まで
- 自動推定だけで確定しない

### images

- MVPでは画像アップロード補助は作らない
- 自社DB管理画像のメタデータ設計のみ将来対象

### status

DB上の `publish_status` と対応する。

```txt
enabled
hidden
deleted
```

### seasonal availability

- `sale_start_date`
- `sale_end_date`
- 期間終了時は自動削除ではなく `hidden` 候補として扱う

---

## 4. 新規メニュー作成フロー

```txt
1. ユーザーが店舗を選択
2. menu_section を選択または作成
3. menu_item の基本情報を入力
4. price / tax_policy / category / status を入力
5. 任意で description / sale_start_date / sale_end_date を入力
6. 保存前 preview を表示
7. ユーザーが確定
8. menu_items に現在状態を作成
9. menu_item_versions に version_number=1 を作成
10. audit_logs に menu_item_created を記録
11. 必要に応じて外部サイト同期候補を作成
```

保存前 preview では、必須項目不足、未対応カテゴリ、価格異常、販売期間矛盾を表示する。

---

## 5. メニュー編集フロー

```txt
1. ユーザーが既存 menu_item を開く
2. 現在状態と編集内容の差分を表示
3. ユーザーが編集を確定
4. menu_item_versions に新versionを追加
5. menu_items.current_version_id を新versionへ更新
6. menu_items の現在状態を更新
7. audit_logs に menu_item_updated を記録
8. 外部サイト同期候補を再計算
```

`menu_item_versions` は追記型。過去versionを直接編集しない。

---

## 6. 季節メニュー終了フロー

季節メニューの終了は原則 `hidden` として扱う。

```txt
1. sale_end_date が到来したメニューを候補表示
2. ユーザーが終了対象を確認
3. status を hidden にする preview を表示
4. ユーザーが確定
5. menu_item_versions に change_type=hide または update を追加
6. menu_items.publish_status を hidden に更新
7. 必要に応じて外部サイト同期候補を作成
```

自動削除はしない。外部サイトの削除ボタンも押さない。

---

## 7. 非公開化フロー

非公開化は `publish_status = hidden` として扱う。

```txt
1. ユーザーが非公開化を選択
2. 理由入力を任意で受け付ける
3. 影響範囲を preview 表示
4. ユーザーが確定
5. menu_item_versions に change_type=hide を追加
6. menu_items.publish_status を hidden に更新
7. audit_logs に menu_item_hidden を記録
```

外部サイトへ反映する場合は、同期候補を作るだけで、MVPでは保存・公開操作を自動実行しない。

---

## 8. 削除方針

削除は原則、物理削除ではなく status 管理にする。

```txt
enabled -> hidden -> deleted
```

### 方針

- 通常の販売終了は `hidden`
- 誤作成や長期不要メニューは `deleted` 候補
- `deleted` でも履歴は残す
- 外部サイトの削除ボタンはMVPでは押さない
- 物理削除はデータ保持方針と監査要件を別途満たす場合のみ検討する

`deleted` への変更は preview と人間確認を必須にする。

---

## 9. Versioning 方針

`menu_items` は現在状態、`menu_item_versions` は追記型履歴。

更新ごとに以下を記録する。

- version number
- change type
- changed fields
- change summary
- created by user
- created at
- source id

### change_type

```txt
create
update
hide
delete_request
rollback
import
sync
```

管理画面での確定操作は、現在状態更新と同時に必ずversionを作る。

---

## 10. Rollback 方針

rollback は過去versionを直接復元しない。

```txt
1. ユーザーが過去versionを選択
2. 現在状態との差分を表示
3. rollback preview を確認
4. ユーザーが確定
5. 過去versionを元に新しい menu_item_version を作成
6. change_type = rollback
7. menu_item_rollbacks に from_version_id / to_version_id を記録
8. menu_items.current_version_id を新versionへ更新
```

rollback後に外部サイトへ反映する場合も、同期前確認画面を通す。

---

## 11. import preview との関係

CSV import 由来の変更は、確定前に import preview を通す。

管理画面では以下を表示する。

- 新規作成候補
- 更新候補
- 非公開化候補
- 論理削除候補
- エラー行
- warning
- 大きな価格差分
- 未対応カテゴリ

preview段階では `menu_items` / `menu_item_versions` を更新しない。ユーザー確定後に version を作る。

---

## 12. CSV import との関係

CSVはそのまま正本にせず、必ず Common Menu Model に変換する。

```txt
CSV
  ↓
csv_source_adapter
  ↓
Common Menu Model
  ↓
Admin Web preview
  ↓
menu_items / menu_item_versions
```

CSV由来の値も、管理画面上では通常のメニュー編集と同じ履歴管理を受ける。

---

## 13. category mapping との関係

管理画面では Common Menu Model 側カテゴリを扱う。外部サイト側カテゴリへ直接編集しない。

```txt
common.category_name
  ↓
category_mappings
  ↓
site_store_categories
```

### 方針

- 未対応カテゴリがある場合は外部サイト同期前に停止
- category mapping は店舗単位
- 外部サイトの option value は保存せず、ラベル中心で扱う
- AIや推測だけでカテゴリを確定しない

---

## 14. 外部サイト同期前の確認画面

外部サイト同期候補を作る前、または `sync_jobs` 作成前に確認画面を表示する。

### 表示内容

- 対象店舗
- 対象外部サイト
- 反映対象メニュー
- 変更前/変更後の差分
- 価格差分
- status変更
- 未対応カテゴリ
- mapping version
- required extension version
- safety stop候補

### 方針

- MVPでは保存・公開・削除の自動実行をしない
- ユーザーが外部サイト管理画面で最終確認する
- `sync_jobs` には値そのものではなく、対象ID、version、summary、理由ラベルを渡す

---

## 15. 人間確認ポイント

人間確認が必要な箇所。

- 新規メニュー作成確定前
- 価格変更確定前
- 税区分変更確定前
- 非公開化確定前
- `deleted` への変更前
- rollback実行前
- CSV import確定前
- 未対応カテゴリがある場合
- 外部サイト同期候補作成前
- 外部サイト管理画面で保存・公開する前

---

## 16. 権限ごとの操作範囲

### owner

- 全店舗の閲覧・編集
- ユーザー管理
- メニュー作成・編集・非公開化
- rollback
- CSV import確定
- 外部サイト同期候補作成

### admin

- 組織内店舗の閲覧・編集
- メニュー作成・編集・非公開化
- rollback
- CSV import確定
- 外部サイト同期候補作成

### operator

- 許可された店舗の閲覧・編集
- メニュー作成・編集
- 非公開化候補作成
- CSV import preview 作成
- 外部サイト同期候補の下書き作成

### viewer

- 閲覧のみ
- version履歴、sync job、audit logの参照
- 変更確定、rollback、CSV import確定は不可

---

## 17. audit_logs に残す操作

監査ログには、誰が、いつ、どの店舗で、何をしたかを記録する。

### event_type候補

- `menu_item_created`
- `menu_item_updated`
- `menu_item_hidden`
- `menu_item_delete_requested`
- `menu_item_rollback_created`
- `csv_import_previewed`
- `csv_import_confirmed`
- `category_mapping_updated`
- `sync_candidate_created`
- `sync_job_created`
- `safety_stop_acknowledged`

### 保存方針

- 値そのものではなく対象ID、version、結果、理由ラベルを中心に保存する
- 認証情報、Cookie、Session、Token、生DOM、input value は保存しない
- 個人情報を含む自由入力は保存しないか、最小限にする

---

## 18. sync_jobs に渡すタイミング

`sync_jobs` は、自社DB上の変更が確定し、外部サイト同期前確認画面でユーザーが同期候補作成を選んだタイミングで作成する。

### 渡す情報

- store id
- route id
- store_site_account id
- mapping version id
- extension version
- job type
- target menu item ids
- target menu item version ids
- summary

### 渡さない情報

- 外部サイト認証情報
- Cookie / Session / Token
- 生DOM
- input value
- hidden value
- パスワード

`sync_jobs.auto_submit_enabled` は常に `false`。

---

## 19. 保存禁止情報

管理画面と自社DB正本フローでは以下を保存しない。

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

店舗名、住所、電話番号など店舗識別に必要な情報は、目的を限定して保存する。

---

## 20. MVPで作る画面

MVPで作る画面。

- Login
- Store list
- Store detail
- Menu list
- Menu item editor
- Menu section editor
- Menu version history
- CSV import preview
- External sync candidate preview
- Sync job list
- Audit log list

外部サイト連携画面は、同期候補と安全状態の確認までに留める。

---

## 21. MVPで作らない画面

- 外部サイト管理画面の埋め込み
- 外部サイトの自動保存・自動公開UI
- 画像アップロード一括管理
- アレルゲン自動判定UI
- AIカテゴリ自動確定UI
- 複数店舗一括編集
- 高度なDOM diff可視化
- Chrome拡張MVP本体の実装画面

---

## 22. Phase後送り

- 複数店舗一括更新
- 多言語メニュー
- コース料理
- 複数価格、サイズ別価格、時価
- 画像アップロード補助
- アレルゲン外部サイト反映
- ロールバックUIの高度化
- DOM diff可視化
- AIによるカテゴリ候補提案
- 自動保存・自動公開の限定解禁

---

## 23. TODO

- [ ] 管理画面MVPの画面遷移図を作成する
- [ ] `audit_logs.details_json` の保存粒度を定義する
- [ ] `sync_jobs.summary_json` のschemaを定義する
- [ ] CSV import preview と menu editor の共通差分表示を設計する
- [ ] owner / admin / operator / viewer の詳細権限表を作る
- [ ] `deleted` の保持期間と物理削除条件をセキュリティポリシーと整合させる
- [ ] 管理画面で扱う allergens / images のDB表現を確定する
