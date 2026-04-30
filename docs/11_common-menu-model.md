# Common Menu Model

## 1. 目的

Common Menu Model は、CSV、自社DB、自社サイト、外部グルメサイトなど、どの入力元から来たメニュー情報も一度変換するための共通データモデルである。

本システムでは、入力元や反映先ごとの形式差を Common Menu Model に集約し、履歴管理、差分確認、カテゴリ対応、安全停止、外部サイト入力補助を一貫して扱う。

```txt
Source
  ↓
Common Menu Model
  ↓
Target
```

---

## 2. 外部サイト同士を直接変換しない理由

外部サイト同士を直接変換すると、サイト追加のたびに変換組み合わせが増える。

```txt
Tabelog -> Hotpepper
Tabelog -> Gurunavi
Hotpepper -> Tabelog
Hotpepper -> Gurunavi
...
```

この方式では以下の問題が起きる。

- サイト追加ごとに N x (N-1) の変換が必要になる
- 価格、税区分、カテゴリ、公開状態の正規化ルールが分散する
- 履歴や rollback の基準がサイトごとにぶれる
- 外部サイト固有DOMの変更が別サイトへの変換にも波及する
- どの値が正本なのか追跡しづらい

そのため、外部サイトを正本にする場合でも、必ず一度 Common Menu Model に変換して保存し、その後 Target Adapter で反映先形式へ変換する。

---

## 3. モデル全体

Common Menu Model は、DB上では主に以下で表現する。

- `menus`
- `menu_sections`
- `menu_items`
- `menu_item_versions`
- `menu_item_rollbacks`
- `store_menu_sources`
- `category_mappings`
- `raw_source_json`

論理モデルは以下の単位で扱う。

```txt
menu
  └─ menu_section[]
       └─ menu_item[]
```

MVPでは1店舗に1つの標準メニューを想定してよい。ただし、将来のランチ/ディナー/コース/店舗別メニュー分岐に備え、`menus` と `menu_sections` を分ける。

---

## 4. menu_section

`menu_section` はメニュー内の分類・表示グループを表す。

例:

- おすすめ
- 前菜
- メイン
- ドリンク
- ランチ
- 季節限定

### 推奨フィールド

| フィールド | 必須 | 説明 |
|---|---:|---|
| `id` | yes | システム内ID |
| `menu_id` | yes | 所属するメニュー |
| `name` | yes | セクション名 |
| `description` | no | セクション説明 |
| `sort_order` | no | 表示順 |
| `status` | yes | `active` / `hidden` / `deleted` |

### 方針

- 外部サイト側カテゴリと完全一致しなくてよい
- Target変換時に `category_mappings` で外部サイト側カテゴリへ対応させる
- セクション自体が外部サイトに存在しない場合は、Target Adapter 側で無視またはカテゴリへ丸める

---

## 5. menu_item

`menu_item` は飲食店メニューの1商品を表す。

### 推奨フィールド

| フィールド | 必須 | 説明 |
|---|---:|---|
| `id` | yes | システム内ID |
| `menu_id` | yes | 所属メニュー |
| `section_id` | no | 所属セクション |
| `name` | yes | メニュー名 |
| `description` | no | 説明文 |
| `price.amount` | yes for MVP | 金額。整数円を基本とする |
| `price.currency` | yes | MVPでは `JPY` |
| `tax_policy` | yes | 税込/税抜/不明 |
| `category_name` | no | 共通カテゴリ名 |
| `allergens` | no | アレルゲン情報 |
| `images` | no | 画像メタデータ |
| `status` | yes | `enabled` / `hidden` / `deleted` |
| `seasonal_availability` | no | 販売期間 |
| `source_metadata` | yes | 入力元情報 |
| `raw_source_json` | no | サイト固有情報の退避先 |

---

## 6. price

価格は Common Menu Model では値と通貨を分ける。

```json
{
  "amount": 1200,
  "currency": "JPY"
}
```

### 方針

- MVPでは整数円のみを標準とする
- 桁区切り、通貨記号、税込/税抜表記は Source Adapter で正規化する
- 価格不明、時価、無料、複数価格は Phase 後送りまたは `raw_source_json` に退避する
- 大きな価格差分は human review の対象にする

---

## 7. tax_policy

税区分はDB上の `tax_type` と対応する。

```txt
tax_included
tax_excluded
tax_unknown
```

### 方針

- 入力元に税込/税抜が明示されていれば反映する
- 明示されていない場合は `tax_unknown` とする
- Target側が税込固定などの場合は Target Adapter で変換方針を持つ
- 税計算そのものをMVPで自動補正しない

---

## 8. description

説明文は任意項目。

### 方針

- 改行、絵文字、HTML、文字数制限は Target Adapter で調整する
- 外部サイト管理画面から読み取る場合、input value を保存してはいけない制約に注意する
- Common Menu Model に保存できる説明文は、ユーザーがCSV/Admin等から取り込むことを明示的に確定した値に限る

---

## 9. allergens

アレルゲン情報は任意項目。

例:

```json
[
  {"key": "wheat", "label": "小麦"},
  {"key": "egg", "label": "卵"}
]
```

### 方針

- MVPでは保存設計のみ。外部サイト入力補助の対象外
- アレルゲン表記は重大情報のため、自動推定だけで確定しない
- 表示や外部反映前に人間確認を必須にする

---

## 10. images

画像は任意項目。

例:

```json
[
  {
    "image_id": "img_xxx",
    "role": "primary",
    "alt_text": "メニュー画像",
    "sort_order": 0
  }
]
```

### 方針

- MVPでは画像アップロード補助は対象外
- 外部サイト上の画像URLや画像本体は検証段階で保存しない
- 自社DBで管理する画像のみ、将来の画像アップロード補助対象にする

---

## 11. status

公開状態はDB上の `publish_status` と対応する。

```txt
enabled
hidden
deleted
```

### 方針

- `enabled`: 掲載対象
- `hidden`: 非公開・販売終了・季節終了
- `deleted`: 論理削除。MVPでは外部サイトの削除操作に使わない

季節終了は原則 `hidden` とする。外部サイトの削除ボタンはMVPでは押さない。

---

## 12. seasonal availability

季節・期間限定販売は以下で表す。

```json
{
  "sale_start_date": "2026-06-01",
  "sale_end_date": "2026-08-31"
}
```

### 方針

- 日付は `YYYY-MM-DD`
- 期間未指定は常時販売扱い
- 期間終了時は自動削除ではなく `hidden` 候補として扱う
- 外部サイト側に期間UIがない場合は Target Adapter が無視する

---

## 13. source metadata

`source_metadata` は、その値がどこから来たかを追跡するための情報。

例:

```json
{
  "source_type": "csv",
  "source_id": "source_xxx",
  "source_row_number": 12,
  "imported_at": "2026-04-30T00:00:00Z",
  "adapter": "csv_source_adapter",
  "adapter_version": "0.1.0"
}
```

### 保存してよいもの

- source type
- source id
- CSV行番号
- adapter名
- adapter version
- import timestamp
- 外部サイト名
- mapping version

### 保存してはいけないもの

- 外部サイトのログインID
- パスワード
- Cookie
- Session
- Token
- CSRF token
- Authorization header
- input value の生データ
- hidden value
- 生DOM全文 / outerHTML
- LocalStorage / IndexedDB

---

## 14. 必須項目

MVPにおける `menu_item` の必須項目。

| 項目 | 理由 |
|---|---|
| `name` | メニューとして識別する最小情報 |
| `price.amount` | Hotpepper等の主要入力対象 |
| `price.currency` | 金額の解釈に必要。MVPは `JPY` |
| `tax_policy` | 税込/税抜/不明の差分確認に必要 |
| `status` | 掲載対象か非公開かを判断するため |
| `source_metadata` | 取り込み元と履歴追跡に必要 |

`category_name` はMVPでは実運用上ほぼ必須だが、未対応カテゴリ検出・停止のため、モデル上は未確定状態を許容する。

---

## 15. 任意項目

- `menu_section`
- `description`
- `category_name`
- `allergens`
- `images`
- `sale_start_date`
- `sale_end_date`
- `sort_order`
- `raw_source_json`

任意項目が不足していても、必須項目が揃っていれば Common Menu Model として保存できる。ただし、Target反映時に required field が満たせない場合は safety stop とする。

---

## 16. サイト固有情報の逃がし方

共通化できない情報は `raw_source_json` に退避する。

例:

```json
{
  "source_site": "hotpepper",
  "site_specific": {
    "course_flag": true,
    "display_badge_label": "おすすめ",
    "site_category_label": "料理"
  }
}
```

### 方針

- `raw_source_json` は任意項目
- 共通モデルに昇格できる項目は、後で正式フィールド化する
- Target Adapter は必要に応じて `raw_source_json` を参照してよい
- `raw_source_json` に認証情報、Cookie、Session、Token、生DOM、input value、hidden valueを入れてはいけない

---

## 17. raw_source_json の扱い

`raw_source_json` は、入力元の情報をそのまま無制限に保存する場所ではない。

保存できるもの:

- CSVの元列名と正規化後の対応
- 外部サイト固有のカテゴリラベル
- 共通化前の税区分ラベル
- 表示バッジ等の非機密メタデータ
- adapterが判断に使った非機密な補助情報

保存できないもの:

- ログインID / パスワード
- Cookie / Session / Token / CSRF token
- Authorization header
- input value の生データ
- hidden input value
- 生DOM全文 / outerHTML
- 顧客情報
- 個人情報を含む内部メモ
- 外部サイト管理画面のスクリーンショットや画像URL

`raw_source_json` はDBでは `JSONB` を想定する。D1移行時はTEXT JSONに置換し、アプリケーション側でvalidationを行う。

---

## 18. Versioning 方針

`menu_items` は現在状態、`menu_item_versions` は追記型履歴とする。

```txt
menu_items = 現在の最新版
menu_item_versions = 過去を含む全変更履歴
```

更新時は以下を行う。

1. 現在状態との差分を計算
2. `menu_item_versions` に新しいversionを追加
3. `menu_items.current_version_id` を新versionへ更新
4. `changed_fields_json` に変更フィールド名と概要を記録

`menu_item_versions` は原則更新しない。誤りがあった場合も、修正versionを追加する。

---

## 19. Rollback 方針

rollback は過去versionを直接復元しない。

過去versionを元に新しいversionを作り、以下のように記録する。

```txt
change_type = rollback
```

`menu_item_rollbacks` には以下を記録する。

- `from_version_id`: rollbackの元にした過去version
- `to_version_id`: rollbackとして新規作成したversion
- `reason`: 理由
- `created_by_user_id`

外部サイトへ再反映する場合も、保存・公開は人間確認後に行う。

---

## 20. CSV import との関係

CSV import は Source Adapter の一種。

```txt
CSV
  ↓
csv_source_adapter
  ↓
Common Menu Model
```

### 方針

- CSV列名は店舗ごと・提供元ごとに揺れる前提
- CSV取り込み前に列マッピングを行う
- 必須項目不足は取り込み前レビューで止める
- 元CSVの全内容を無条件保存しない
- 保存する場合も `raw_source_json` には必要最小限の非機密情報のみ入れる
- 取り込み確定時に `menu_item_versions.change_type = import` を作る

---

## 21. 自社DB正本との関係

自社DBを正本にする場合、Admin Webで編集した値が Common Menu Model の現在状態になる。

```txt
Admin Web / Internal DB
  ↓
Common Menu Model
  ↓
Target Adapter
  ↓
External Site
```

### 方針

- Admin Webでの変更は `menu_items` と `menu_item_versions` に保存する
- 外部サイト反映前に差分プレビューを出す
- Chrome拡張MVPでは入力補助まで行い、保存・公開は人間が行う
- `sync_jobs` と `sync_job_logs` には値ではなく結果、hash、score、理由ラベルを記録する

---

## 22. 外部サイト正本との関係

外部サイトを正本にする場合でも、サイトAからサイトBへ直接変換しない。

```txt
External Site A
  ↓
source_adapter
  ↓
Common Menu Model
  ↓
target_adapter
  ↓
External Site B
```

### 方針

- 外部サイト管理画面から取得してよいのは、許可された構造情報とユーザーが確認したメニュー情報のみ
- 認証情報、Cookie、Session、Token、生DOM、input value は保存しない
- 外部サイト固有の値は `raw_source_json` に最小限退避する
- Target反映時は `mapping_versions` と `category_mappings` を使う
- 店舗識別不一致、required field missing、critical DOM diff では停止する

---

## 23. category mapping との関係

Common Menu Model 側のカテゴリと外部サイト側カテゴリは別物として扱う。

```txt
common.category_name
  ↓
category_mappings
  ↓
site_store_categories
```

### 方針

- `category_mappings` は店舗単位で管理する
- 外部サイト側カテゴリは `site_store_categories` に保存する
- select option の value は保存せず、ラベル中心で扱う
- 未対応カテゴリがある場合は自動入力を停止する
- AIや推測でカテゴリを決める場合も、人間確認なしで確定しない

---

## 24. 未対応項目の扱い

未対応項目は3つに分類する。

| 分類 | 扱い |
|---|---|
| 共通化予定 | TODOとして残し、後で正式フィールド化 |
| サイト固有 | `raw_source_json` に非機密情報のみ退避 |
| MVP対象外 | 保存または反映せず、Phase後送り |

未対応項目がTarget側のrequired fieldに該当する場合は、入力補助を停止する。

---

## 25. MVPで扱う範囲

MVPで扱う Common Menu Model の範囲。

- `menu_section.name`
- `menu_item.name`
- `menu_item.description`
- `price.amount`
- `price.currency = JPY`
- `tax_policy`
- `category_name`
- `status`
- `sale_start_date`
- `sale_end_date`
- `sort_order`
- `source_metadata`
- `raw_source_json` の最小利用

MVPの外部サイト反映では、まず `name / price / category / description` を中心にする。`status` と販売期間は実画面検証後に対応可否を判断する。

---

## 26. Phase後送りにする範囲

- 画像アップロード補助
- アレルゲンの外部サイト反映
- コース料理
- 複数価格、サイズ別価格、時価
- 多言語メニュー
- 複数店舗一括更新
- AIによるカテゴリ候補の自動確定
- 外部サイト保存・公開の自動化
- iframe / shadow DOM など特殊UIを前提にした高度な抽出

自動保存・自動公開の解禁はMVPでは扱わない。

---

## 27. TODO

- [ ] `docs/01_system-overview.md` から本ドキュメントへの参照を追加する
- [ ] `docs/03_database-design.md` と `database/schema-draft.sql` のフィールド名差分を整理する
- [ ] CSV import 用の列マッピング仕様を別ドキュメント化する
- [ ] allergens / images のDB表現を確定する
- [ ] 複数価格、時価、サイズ別価格の扱いを決める
- [ ] `raw_source_json` のJSON schemaを定義する
- [ ] `source_metadata` の必須キーを確定する
- [ ] category mapping の未対応時UIを管理画面MVP設計へ反映する
