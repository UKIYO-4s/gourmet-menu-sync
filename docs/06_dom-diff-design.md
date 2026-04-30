# DOM Diff Design

## 1. 目的

このドキュメントは、外部グルメサイト管理画面のDOM構造を検出し、過去の状態との差分を管理するための仕様を定義する。

外部サイトの管理画面は予告なく変更される可能性があるため、DOM変更による誤入力を防ぐには、DOMスナップショットと差分検知が必要である。

---

## 2. 基本方針

- 生DOM全文は保存しない
- 入力補助に必要な構造情報だけ保存する
- input valueは保存しない
- password/cookie/session/tokenは保存しない
- 差分がcriticalの場合は自動入力を停止する

---

## 3. 保存する情報

```txt
tag
type
name
id
label
placeholder
aria-label
nearby text
selector hint
field hash
button text
form structure
page URL pattern
```

---

## 4. 保存しない情報

```txt
input value
password
cookie
session
token
hidden valueの詳細
生DOM全文
個人情報を含む可能性が高いテキスト
```

---

## 5. DOM Snapshot Format

```json
{
  "site": "hotpepper",
  "page": "menu_edit",
  "captured_at": "2026-04-29T10:00:00Z",
  "url_pattern": "/admin/menu/edit",
  "page_hash": "page_hash_xxxxx",
  "fields": [
    {
      "field_key": "name",
      "tag": "input",
      "type": "text",
      "name": "menu_name",
      "id": "menu-name",
      "label": "メニュー名",
      "placeholder": "料理名を入力",
      "aria_label": null,
      "nearby_text": "メニュー名 必須",
      "selector_hint": "input[name='menu_name']",
      "field_hash": "hash_xxxxx"
    }
  ],
  "buttons": [
    {
      "button_key": "save",
      "text": "保存",
      "selector_hint": "button[type='submit']",
      "button_hash": "hash_yyyyy"
    }
  ]
}
```

---

## 6. field_hashの考え方

field_hashは以下を正規化して生成する。

```txt
tag
type
name
id
label
placeholder
aria-label
nearby text
DOM上の相対位置
```

valueは含めない。

---

## 7. Diff Types

```txt
field_added
field_removed
selector_changed
label_changed
placeholder_changed
aria_label_changed
button_changed
required_field_missing
layout_changed
page_hash_changed
store_identity_missing
```

---

## 8. Severity

### info

軽微な変更。

例：

- placeholderの文言変更
- labelの表記ゆれ

### warning

入力精度に影響する可能性がある変更。

例：

- selector変更
- 近接テキスト変更
- ボタン文言変更

### critical

自動入力を停止すべき変更。

例：

- 必須フィールドが見つからない
- 価格欄が特定できない
- 保存ボタン候補が複数ある
- 店舗識別情報が見つからない
- 店舗識別が不一致

---

## 9. Stop Conditions

以下の場合、自動入力を停止する。

```txt
minPageMatchScore未満
required field missing
price field ambiguous
store identity mismatch
critical DOM diff detected
mapping version is deprecated
extension version is below required version
```

---

## 10. DOM Diff Flow

```txt
1. Chrome拡張がDOM構造をスキャン
2. sanitizerで不要情報を削除
3. snapshot_hashを生成
4. APIへ送信
5. APIが前回snapshotと比較
6. dom_diffsを作成
7. severityを判定
8. criticalならmapping更新まで自動入力停止
```

---

## 11. Related Tables

- dom_snapshots
- dom_diffs
- mapping_versions
- site_pages
- sync_jobs
- sync_job_logs

---

## 12. Future TODO

- DOM差分を管理画面で視覚的に表示
- 差分からmapping JSON更新候補を自動生成
- AIによるselector候補提案
- 複数ユーザーからのDOM差分報告を集約
