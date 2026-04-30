# Hotpepper メニュー編集画面 検証結果

> このファイルはテンプレート。コピーしてファイル名の `YYYY-MM-DD` を実日付に置き換えて使う。
>
> **記録禁止**: ログイン情報 / Cookie / Session / Token / 生DOM全文 / input value / 個人情報を含むスクリーンショット。
> 店舗名・担当者名・電話番号・住所など個人特定可能な値は **検証用の仮名（例: STORE_A / PHONE_A / ADDR_A）** に置換すること。

---

## 0. メタ情報

- 検証日:
- 検証者:
- 対象サイト: Hotpepper
- 対象画面:
  - [ ] メニュー編集（追加）
  - [ ] メニュー編集（既存編集）
  - [ ] メニュー一覧（補助）
- URL pattern（クエリ・パスのID部分はマスク）:
- 画面タイプ:
  - [ ] detail_page
  - [ ] modal
  - [ ] inline_edit
  - [ ] unknown
- 関連ファイル:
  - `experiments/phase1-dom-detection-plan.md`
  - `experiments/phase1-dom-detection-checklist.md`
  - `configs/mapping-samples/hotpepper-menu-edit.sample.json`

---

## 1. 店舗識別情報の検出可否

| 項目 | 検出可 | 取得手段（selector / aria / nearby） | 値の安定性 | 仮名 |
|---|---|---|---|---|
| 店舗名 | ☐ |  |  | STORE_A |
| 住所 | ☐ |  |  | ADDR_A |
| 電話番号 | ☐ |  |  | PHONE_A |
| 管理画面URL内の店舗識別子 | ☐ |  |  | STOREID_A |
| 外部サイト内店舗ID（DOM上） | ☐ |  |  | EXTID_A |

判定:

- [ ] 5項目中4項目以上で検出可
- [ ] 切替時に値が追従する
- [ ] 不一致時に停止判定が成立する

備考:

---

## 2. menu_name 検出結果

| 観点 | 結果 | メモ |
|---|---|---|
| selector ヒット（1次） | ☐ |  |
| name 属性 | ☐ |  |
| id 属性 | ☐ |  |
| label 一致 | ☐ |  |
| aria-label | ☐ |  |
| placeholder | ☐ |  |
| nearby text | ☐ |  |
| required 属性 | ☐ |  |
| maxLength | ☐ |  |
| match_score | ☐ ≥ 0.80 |  |
| field_hash 取得 | ☐ |  |

備考:

---

## 3. price 検出結果

| 観点 | 結果 | メモ |
|---|---|---|
| selector ヒット | ☐ |  |
| type=number か | ☐ |  |
| label 一致 | ☐ |  |
| 税区分の指定方法 | ☐ |  |
| 単位表記 | ☐ |  |
| 桁区切りの扱い | ☐ |  |
| 上下限 | ☐ |  |
| match_score | ☐ ≥ 0.85 |  |
| field_hash 取得 | ☐ |  |

備考:

---

## 4. category 検出結果

| 観点 | 結果 | メモ |
|---|---|---|
| 入力方式 | ☐ | select / ラジオ / モーダル / 検索 |
| label 一致 | ☐ |  |
| option ラベル取得（value は保存しない） | ☐ |  |
| 階層構造 | ☐ |  |
| 未対応カテゴリの存在 | ☐ |  |
| `category_mappings` に記述可能 | ☐ |  |
| match_score | ☐ ≥ 0.80 |  |

備考:

---

## 5. description 検出結果

| 観点 | 結果 | メモ |
|---|---|---|
| input か textarea か | ☐ |  |
| label 一致 | ☐ |  |
| placeholder | ☐ |  |
| 最大文字数 | ☐ |  |
| 改行可否 | ☐ |  |
| match_score | ☐ ≥ 0.70 |  |
| 任意フィールド扱いで OK | ☐ |  |

備考:

---

## 6. status 検出結果

| 観点 | 結果 | メモ |
|---|---|---|
| 切替UIの存在 | ☐ | select / ラジオ / トグル |
| ラベル文言 | ☐ | 公開 / 公開申請 / 掲載中 / 非公開 / 下書き |
| 「販売終了」表現 | ☐ |  |
| MVP標準 = hidden で運用可能 | ☐ |  |
| 「削除」操作は **行わなかった** | ☐ |  |

備考:

---

## 7. sale_start_date / sale_end_date 検出結果

| 観点 | 結果 | メモ |
|---|---|---|
| 期間設定UIの存在 | ☐ |  |
| 入力方式 | ☐ | date input / カレンダー / 分割 |
| フォーマット | ☐ | YYYY-MM-DD / YYYY/MM/DD |
| 期間外の自動非表示 | ☐ |  |
| 期間未指定時のデフォルト | ☐ |  |
| mapping JSON に追加すべきか | ☐ |  |

備考:

---

## 8. 保存 / 公開ボタンの検出結果

| ボタン | 文言 | selectorHint | autoClick | danger | 検出 |
|---|---|---|---|---|---|
| 保存 |  |  | false | false | ☐ |
| 公開 |  |  | false | true | ☐ |
| 下書き保存 |  |  | false | true | ☐ |
| 削除 |  |  | false | true | ☐ |
| キャンセル |  |  | false | false | ☐ |

確認:

- [ ] danger 系ボタンが mapping の `buttons` に明示できる
- [ ] 全ボタンで `autoClick: false` が成立
- [ ] 確認ダイアログ（モーダル / JS confirm）の挙動を記録した
- [ ] **本検証中、保存・公開・削除ボタンは押していない**

---

## 9. prohibited_actions 確認

`docs/09_security-policy.md` 準拠。すべて満たす必要あり。

- [ ] ログイン情報 / Cookie / Session / Token を保存していない
- [ ] 生DOM全文 / outerHTML を保存していない
- [ ] input value（password / text / textarea すべて）を保存していない
- [ ] hidden input の value を保存していない
- [ ] 保存ボタン・公開ボタン・削除ボタンを押していない
- [ ] フォーム送信を発火させていない（Enter 含む）
- [ ] 個人情報を含むスクリーンショットを保存していない
- [ ] 店舗名・担当者名・電話・住所は仮名に置換した
- [ ] LocalStorage / IndexedDB をエクスポートしていない
- [ ] 短時間連続アクセス（Bot 判定誘発）をしていない

違反があった場合は本検証を **SECURITY-STOP** とし、該当データを直ちに削除する。

---

## 10. DOM 差分検知への影響

`docs/06_dom-diff-design.md`。

| 差分種別 | 観察 / 再現結果 | severity 想定 | 備考 |
|---|---|---|---|
| field_added | ☐ |  |  |
| field_removed | ☐ | critical |  |
| selector_changed | ☐ | critical |  |
| label_changed | ☐ | warning |  |
| button_changed | ☐ | critical |  |
| layout_changed | ☐ | critical |  |
| hash_changed | ☐ |  |  |

field_hash / page_hash の安定性:

- [ ] 同一画面の再取得で field_hash が一致
- [ ] 1日後の再取得で page_hash が安定
- [ ] フィールド追加 / 削除では page_hash が変化

備考:

---

## 11. mapping sample への反映事項

`configs/mapping-samples/hotpepper-menu-edit.sample.json`

- [ ] `url_patterns` の更新
- [ ] `fields.name` の selectors / labels / placeholders / minMatchScore
- [ ] `fields.price` の selectors / format
- [ ] `fields.category` の入力方式 / useStoreCategoryMapping
- [ ] `fields.description` の labels / placeholders
- [ ] `buttons.save` / `buttons.publish` の文言候補
- [ ] `safety.minPageMatchScore` の現実値
- [ ] `required_extension_version` の確認
- [ ] `submit.autoSubmit: false` の維持（ADR-003）

具体的な変更案:

```diff
（diff を貼る場合は selector / label の文字列のみ。値や個人情報は載せない）
```

---

## 12. docs への反映事項

該当があれば記載。

- [ ] `docs/04_chrome-extension-design.md` —
- [ ] `docs/05_mapping-json-design.md` —
- [ ] `docs/06_dom-diff-design.md` —
- [ ] `docs/03_database-design.md` — field_hash / page_hash / identity 5項目の保存粒度
- [ ] `docs/09_security-policy.md` — マスク運用 / 禁止情報の追記候補
- [ ] ADR が必要な変更かどうか

---

## 13. 判定（GO / HOLD / STOP）

`experiments/phase1-dom-detection-checklist.md` 21章。

- [ ] **GO** — 成功条件すべて満たす（plan 13章）。Chrome拡張MVP着手可
- [ ] **HOLD** — 一部 NG（match_score 校正待ち / hash 不安定 等）。再検証
- [ ] **STOP** — 失敗条件のいずれかに該当（plan 14章）。設計差し戻し
- [ ] **SECURITY-STOP** — 禁止情報の漏洩 / 規約抵触の懸念。即時中断

判定理由:

```
判定:
理由:
影響:
次タスク:
関連ファイル:
```

---

## 14. 次アクション

- [ ]
- [ ]
- [ ]

---

## 15. スクリーンショット参照（マスク済みのみ）

- `experiments/screenshots/hotpepper/<file>.png` — （何の画面か簡潔に。個人情報を映さない）

---

## 16. 備考 / 気付き
