# CSV Import Design

## 1. 目的

CSV import は、飲食店メニューCSVを Common Menu Model に変換し、`menu_items` と `menu_item_versions` へ安全に取り込むための仕様である。

CSVをそのまま正本として扱わず、必ず以下の流れにする。

```txt
CSV
  ↓
csv_source_adapter
  ↓
Common Menu Model
  ↓
menu_items / menu_item_versions
```

外部サイトへ反映する場合も、CSVから外部サイトへ直接変換しない。Common Menu Model へ取り込んだ後、Target Adapter と Mapping JSON を経由する。

---

## 2. 対象ユースケース

MVPで想定するCSV importのユースケース。

- 既存メニュー台帳CSVから初期メニューを作成する
- 店舗担当者が編集したCSVでメニューを一括更新する
- 季節メニューの開始・終了日をCSVで取り込む
- 自社DBを正本にする前の暫定移行データとしてCSVを取り込む
- 外部サイト反映前に、CSV由来の値を差分プレビューする

対象外:

- CSVを外部サイトへ直接投入する処理
- 認証情報、Cookie、Session、Token等を含むCSVの取り込み
- 顧客情報や担当者個人情報を含むCSVの取り込み
- 大量画像アップロード

---

## 3. 入力CSVの標準カラム

標準カラムは以下とする。実CSVの列名は揺れる前提で、取り込み前にカラムマッピングを行う。

| 標準カラム | Common Menu Model | 説明 |
|---|---|---|
| `section_name` | `menu_section.name` | セクション名 |
| `item_name` | `menu_item.name` | メニュー名 |
| `description` | `menu_item.description` | 説明文 |
| `price` | `price.amount` | 価格 |
| `currency` | `price.currency` | 通貨。MVPは `JPY` |
| `tax_policy` | `tax_policy` | `tax_included` / `tax_excluded` / `tax_unknown` |
| `category_name` | `category_name` | 共通カテゴリ名 |
| `status` | `status` | `enabled` / `hidden` / `deleted` |
| `sale_start_date` | `seasonal_availability.sale_start_date` | 販売開始日 |
| `sale_end_date` | `seasonal_availability.sale_end_date` | 販売終了日 |
| `sort_order` | `sort_order` | 表示順 |
| `allergens` | `allergens` | アレルゲン情報 |
| `image_url` | `images` | 画像URL |
| `external_id` | `source_metadata.external_id` | 入力元側ID |
| `source_note` | `raw_source_json.source_note` | 非機密の補足 |

---

## 4. 必須カラム

MVPの必須カラム。

| カラム | 理由 |
|---|---|
| `item_name` | メニュー識別に必須 |
| `price` | 外部サイト反映の主要対象 |
| `tax_policy` | 税込/税抜/不明の差分確認に必要 |
| `status` | 掲載対象/非公開を判断するため |

`currency` は省略時に `JPY` として扱う。`category_name` はモデル上は未確定を許すが、外部サイト反映では未対応カテゴリとして停止対象になる。

---

## 5. 任意カラム

- `section_name`
- `description`
- `currency`
- `category_name`
- `sale_start_date`
- `sale_end_date`
- `sort_order`
- `allergens`
- `image_url`
- `external_id`
- `source_note`

任意カラムが空でも取り込み自体は可能。ただし、Target反映に必要な項目が不足する場合は、sync job作成前または入力補助前に停止する。

---

## 6. カラム名の揺れ対応

CSV列名は店舗、管理会社、既存台帳により揺れる。

### 揺れ候補

| 標準カラム | 許容する列名例 |
|---|---|
| `section_name` | セクション, 分類, 大分類, グループ |
| `item_name` | メニュー名, 商品名, 料理名, 品名, name |
| `description` | 説明, 紹介文, PR文, コメント |
| `price` | 価格, 金額, 税込価格, 税抜価格, price |
| `tax_policy` | 税区分, 税込/税抜, tax, tax_type |
| `category_name` | カテゴリ, カテゴリー, ジャンル, category |
| `status` | 状態, 公開状態, 掲載状態, status |
| `sale_start_date` | 販売開始日, 掲載開始日, start_date |
| `sale_end_date` | 販売終了日, 掲載終了日, end_date |
| `sort_order` | 並び順, 表示順, sort |
| `allergens` | アレルゲン, allergen, allergens |
| `image_url` | 画像URL, image_url, photo_url |

### 方針

- 初回取り込み時はカラム対応表を preview に出す
- 確信度が低い列マッピングは自動確定しない
- 必須カラムが未対応の場合は import validation で停止する
- カラム対応表は将来 `transform_rules` または店舗別設定として保存する

---

## 7. 価格表記の正規化

価格は `price.amount` へ整数円として正規化する。

### 入力例

| 入力 | 正規化 |
|---|---:|
| `1200` | `1200` |
| `1,200` | `1200` |
| `¥1200` | `1200` |
| `1200円` | `1200` |
| `税込1200円` | `1200` + `tax_policy=tax_included` 候補 |
| `税抜1200円` | `1200` + `tax_policy=tax_excluded` 候補 |

### validation

- 数値化できない場合は行エラー
- 負数は行エラー
- 空欄は必須項目エラー
- `時価`、`ASK`、`-` はMVPでは取り込み保留
- 複数価格（例: S 500 / M 700）はPhase後送り

価格差分が既存値から大きい場合は import preview で警告する。

---

## 8. 税込/税抜/不明の扱い

`tax_policy` は Common Menu Model の `tax_policy` として以下へ正規化する。

```txt
tax_included
tax_excluded
tax_unknown
```

### 入力例

| 入力 | 正規化 |
|---|---|
| 税込 | `tax_included` |
| 内税 | `tax_included` |
| 税抜 | `tax_excluded` |
| 外税 | `tax_excluded` |
| 不明 | `tax_unknown` |
| 空欄 | `tax_unknown` または validation warning |

価格列名に `税込価格` / `税抜価格` のような情報が含まれる場合は、`tax_policy` の候補として扱う。ただし、CSV内の明示列と矛盾する場合は import validation で警告し、人間確認を必須にする。

---

## 9. カテゴリ / セクションの扱い

`section_name` はメニュー内の表示グループ、`category_name` は Common Menu Model 側カテゴリとして扱う。

### 方針

- `section_name` が空の場合は `default` セクションへ入れる
- `category_name` が空でも取り込みは可能
- 外部サイト反映時に `category_mappings` が未定義なら停止する
- 外部サイト側カテゴリへ直接変換しない
- CSV由来カテゴリは Common Menu Model 側カテゴリとして保存する

`category_mappings` は以下の変換を担う。

```txt
common.category_name
  ↓
category_mappings
  ↓
site_store_categories
```

---

## 10. 季節メニューの開始日 / 終了日

CSVでは以下を標準カラムとする。

- `sale_start_date`
- `sale_end_date`

### 日付形式

MVPで受け入れる形式。

- `YYYY-MM-DD`
- `YYYY/MM/DD`

### validation

- `sale_end_date < sale_start_date` は行エラー
- 空欄は未指定として扱う
- 期間終了済みの場合、`status=hidden` 候補として preview に出す
- 自動削除にはしない

---

## 11. 公開 / 非公開 / 削除 / 季節終了の扱い

CSVの `status` は Common Menu Model の `status` / DBの `publish_status` に正規化する。

```txt
enabled
hidden
deleted
```

### 入力例

| 入力 | 正規化 |
|---|---|
| 公開 | `enabled` |
| 掲載 | `enabled` |
| 表示 | `enabled` |
| 非公開 | `hidden` |
| 下書き | `hidden` |
| 販売終了 | `hidden` |
| 季節終了 | `hidden` |
| 削除 | `deleted` |

### 方針

- 季節終了は `hidden`
- 削除は論理削除の候補として preview に出す
- CSV import だけで外部サイトの削除ボタンは押さない
- `deleted` への変更は import preview で明示し、人間確認を必須にする

---

## 12. アレルゲン情報

`allergens` は任意カラム。

### 入力例

```txt
小麦,卵,乳
```

### 方針

- カンマ区切り、スラッシュ区切り、全角区切りを正規化候補にする
- MVPでは保存設計と preview まで
- 外部サイト反映はPhase後送り
- アレルゲンは重大情報のため、自動推定だけで確定しない
- 未知のアレルゲン表記は warning として人間確認を必須にする

---

## 13. 画像URLの扱い

`image_url` は任意カラム。

### 方針

- MVPではURL文字列を取り込み候補として preview するのみ
- 画像ダウンロード、再アップロード、外部サイトへの画像投入は行わない
- 顧客情報や認証付きURLを含む画像URLは保存しない
- 外部サイト管理画面上の画像URLは保存しない

画像の本格対応は Phase 後送り。

---

## 14. 重複判定

CSV行を既存 `menu_items` に対応付けるため、以下の順で重複候補を判定する。

1. `external_id` が既存 `source_metadata.external_id` と一致
2. 同一 `section_name` + `item_name` が一致
3. `item_name` + `price.amount` が一致
4. 類似名による候補提示

### 方針

- 自動マージはしない
- 一意に決まらない場合は import preview で候補提示する
- 既存項目を上書きする場合は差分を明示する
- 重複の可能性が高い新規行は warning とする

---

## 15. 差分判定

既存 `menu_items` とCSV由来 Common Menu Model 候補を比較する。

### 差分種別

- `created`: 新規作成
- `updated`: 既存項目更新
- `hidden`: 非公開化
- `deleted`: 論理削除候補
- `unchanged`: 変更なし
- `warning`: 人間確認が必要
- `error`: 取り込み不可

### 比較対象

- `name`
- `description`
- `price.amount`
- `tax_policy`
- `category_name`
- `status`
- `sale_start_date`
- `sale_end_date`
- `sort_order`
- `allergens`
- `image_url`

---

## 16. import preview

import preview は取り込み確定前に必ず表示する。

### 表示する内容

- 総行数
- 新規件数
- 更新件数
- 非公開化件数
- 削除候補件数
- エラー行数
- warning件数
- 必須カラム対応状況
- カラム名の揺れ対応結果
- 価格正規化結果
- 税区分正規化結果
- 未対応カテゴリ
- 大きな価格差分

### 表示してはいけない内容

- 認証情報
- Cookie / Session / Token
- 生DOM
- input value
- 個人情報

CSVの内容自体にも個人情報を含めない。含まれていた場合は import を中断し、該当CSVを管理対象にしない。

---

## 17. import validation

import validation は取り込み確定前に実行する。

### ファイル単位 validation

- CSVとして読める
- 文字コードが扱える
- ヘッダー行が存在する
- 必須カラムが対応付け済み
- 行数がMVP上限以内
- 禁止カラム名が含まれていない

### 行単位 validation

- `item_name` が空でない
- `price` が正規化できる
- `tax_policy` が正規化できる
- `status` が正規化できる
- `sale_end_date >= sale_start_date`
- 削除候補は明示確認が必要
- 未知のアレルゲンは warning
- 不正な画像URLは warning または error

### 禁止カラム名例

- `password`
- `cookie`
- `session`
- `token`
- `csrf`
- `authorization`
- `secret`
- `private_key`
- `raw_dom`
- `outer_html`

---

## 18. エラー行の扱い

エラー行は取り込み対象から除外する。

### 方針

- エラー理由を行番号単位で表示する
- エラー行の値をログへ無制限に保存しない
- エラーがある状態で正常行だけ取り込むかはMVPでは人間確認必須
- 必須カラム欠落などファイル全体に関わるエラーは import 全体を停止する
- エラー行修正後の再アップロードを基本フローにする

---

## 19. menu_item_versions の作成タイミング

`menu_item_versions` はユーザーが import preview を確認し、取り込みを確定したタイミングで作成する。

### 作成ルール

- 新規作成: `change_type = import`
- 既存更新: `change_type = import`
- 非公開化: `change_type = hide` または `import`
- 論理削除候補: `change_type = delete_request` または `import`

preview段階では `menu_items` / `menu_item_versions` を更新しない。

---

## 20. rollback との関係

CSV import の結果を戻す場合も、過去versionを直接復元しない。

rollback は以下の流れにする。

```txt
1. rollback対象の import version を選択
2. 現在状態との差分を表示
3. ユーザーが rollback を確定
4. 過去versionを元に新しい menu_item_version を作成
5. change_type = rollback
6. menu_item_rollbacks に from_version_id / to_version_id を記録
```

rollback後に外部サイトへ反映する場合も、保存・公開は人間確認後に行う。

---

## 21. raw_source_json の扱い

CSV import における `raw_source_json` は、CSVの全内容を無条件に保存する場所ではない。

### 保存してよいもの

- 元カラム名と標準カラムの対応
- CSV行番号
- 正規化前の非機密ラベル
- adapter version
- import batch id
- warning reason code

### 保存しないもの

- CSVファイル全文
- 認証情報
- Cookie / Session / Token / CSRF token
- Authorization header
- 生DOM / outerHTML
- input value
- 顧客情報
- 担当者個人情報
- 内部メモ

DB上では `JSONB` を想定する。D1移行時はTEXT JSONに置換し、アプリケーション側でvalidationする。

---

## 22. 保存禁止情報

CSV import では以下を扱わない。

```txt
login_id
password
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

CSVにこれらが含まれる場合は import を中断し、ユーザーへCSV修正を求める。

---

## 23. MVPで扱う範囲

MVPで扱う範囲。

- CSVアップロード前提の設計
- ヘッダー行ありCSV
- 1店舗単位
- `item_name`
- `price`
- `tax_policy`
- `category_name`
- `section_name`
- `description`
- `status`
- `sale_start_date`
- `sale_end_date`
- `sort_order`
- import preview
- import validation
- `menu_item_versions.change_type = import`
- rollback設計

MVPではCSV import後、外部サイト反映候補を作るところまでを主眼にする。Chrome拡張MVP実装にはまだ入らない。

---

## 24. Phase後送り

- 複数価格、サイズ別価格、時価
- コース料理
- 多言語CSV
- 複数店舗一括CSV
- 画像ダウンロード / 画像アップロード
- アレルゲンの外部サイト自動反映
- CSVテンプレート生成UI
- CSV列マッピングの学習UI
- AIによるカテゴリ自動確定
- 外部サイト保存・公開の自動化

---

## 25. TODO

- [ ] CSV標準テンプレートを `configs/` 配下に作るか検討
- [ ] カラムマッピング設定を `transform_rules` に保存するJSON schemaを定義
- [ ] import preview のUI項目を管理画面MVP設計へ反映
- [ ] エラー行レポートの保存粒度を `docs/09_security-policy.md` と整合
- [ ] `raw_source_json` に保存可能なCSVメタデータのschemaを定義
- [ ] `docs/03_database-design.md` と `database/schema-draft.sql` に import batch の必要性を検討
- [ ] 大きな価格差分の閾値を定義
