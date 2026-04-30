# Mapping JSON Design

## 1. 目的

Mapping JSONは、外部サイト管理画面のどの入力欄に、Common Menu Modelのどの値を入力するか定義する設定ファイルである。

JavaScript本体を更新しなくても、selector・label・placeholder・閾値などをAPI経由で即時更新できるようにする。

---

## 2. 基本構造

```json
{
  "site": "hotpepper",
  "page": "menu_edit",
  "version": "2026.04.29-001",
  "status": "published",
  "required_extension_version": "0.1.0",
  "fields": {},
  "buttons": {},
  "safety": {}
}
```

---

## 3. Field Mapping Example

```json
{
  "site": "hotpepper",
  "page": "menu_edit",
  "version": "2026.04.29-001",
  "status": "published",
  "required_extension_version": "0.1.0",
  "fields": {
    "name": {
      "source": "common.name",
      "labels": ["メニュー名", "商品名", "料理名"],
      "selectors": [
        "input[name='menu_name']",
        "input[placeholder*='料理']"
      ],
      "attributes": {
        "type": "text"
      },
      "required": true,
      "minMatchScore": 0.8
    },
    "price": {
      "source": "common.price",
      "labels": ["価格", "金額", "税込"],
      "selectors": [
        "input[name='price']",
        "input[placeholder*='円']"
      ],
      "required": true,
      "minMatchScore": 0.85,
      "format": {
        "type": "integer",
        "suffix": ""
      }
    },
    "description": {
      "source": "common.description",
      "labels": ["説明", "紹介文", "PR文"],
      "selectors": [
        "textarea[name='description']"
      ],
      "required": false,
      "minMatchScore": 0.7
    },
    "category": {
      "source": "common.category",
      "type": "select",
      "useStoreCategoryMapping": true,
      "required": true,
      "minMatchScore": 0.8
    }
  },
  "buttons": {
    "save": {
      "texts": ["保存", "変更を保存", "更新する"],
      "autoClick": false,
      "danger": false
    },
    "publish": {
      "texts": ["公開", "公開申請", "掲載する"],
      "autoClick": false,
      "danger": true
    }
  },
  "safety": {
    "stopIfDomChanged": true,
    "minPageMatchScore": 0.75,
    "autoSubmit": false,
    "stopIfRequiredFieldMissing": true,
    "stopIfStoreIdentityMismatch": true
  }
}
```

---

## 4. Versioning

mapping_versionsで管理する。

status:

```txt
draft
published
deprecated
rollback
```

MVPではpublishedのみ拡張機能に配信する。

---

## 5. 即時更新できるもの

以下はJSON更新だけで対応可能。

- selector候補
- label候補
- placeholder候補
- URL pattern
- minMatchScore
- required設定
- autoSubmit設定
- stop conditions
- button text候補
- field priority

---

## 6. 拡張機能本体更新が必要なもの

以下はChrome Web Store審査が必要。

- DOM解析ロジックの変更
- iframe対応
- shadow DOM対応
- 画像アップロード処理
- 新しい入力方式の追加
- API通信仕様変更
- 権限追加
- UI大幅変更

---

## 7. Store Override

店舗ごとに標準マッピングを上書きする場合は、`store_mapping_overrides` を使う。

例：

```json
{
  "fields": {
    "category": {
      "defaultCategory": "おすすめ",
      "useDetectedStoreCategories": true
    },
    "price": {
      "taxMode": "tax_included"
    }
  }
}
```

---

## 8. Validation Rules

Mapping JSONは配信前に以下を検証する。

- siteが存在する
- pageが存在する
- versionが一意
- required fieldsが定義されている
- minMatchScoreが0〜1
- autoSubmitがMVPではfalse
- dangerous buttonのautoClickがfalse
- required_extension_versionが指定されている

---

## 9. Mapping Resolution Priority

入力欄の特定は以下の優先度で行う。

```txt
1. 明示selector
2. name/id属性
3. label一致
4. aria-label一致
5. placeholder一致
6. nearby text一致
7. field type一致
8. DOM位置関係
```

複数候補がある場合、スコア最大のものを選ぶ。ただし、価格欄など重要フィールドで候補が複数あり、スコア差が小さい場合は停止する。
