# Phase 1: DOM検出 検証チェックリスト

Hotpepperメニュー編集画面の実画面を見ながら、上から順にチェックする運用ドキュメント。

参照：

- `experiments/phase1-dom-detection-plan.md`
- `docs/06_dom-diff-design.md`
- `docs/07_sync-flow.md`
- `docs/09_security-policy.md`
- `docs/10_development-roadmap.md`
- `configs/mapping-samples/hotpepper-menu-edit.sample.json`

注意：

- ログイン情報 / Cookie / Session / Token を保存しない
- 生DOM全文を保存しない
- input value を保存しない
- 保存ボタン・公開ボタンは押さない
- 自動保存・自動公開は MVP 範囲外（ADR-003）
- 本検証段階では実装コードは書かない（観察と記録のみ）

---

## 0. 検証ヘッダ（毎回記入）

- 検証日時:
- 検証者:
- 対象URL（マスク後）:
- ブラウザ/OS:
- mapping JSON バージョン: `configs/mapping-samples/hotpepper-menu-edit.sample.json` の `version`
- 検証目的:

---

## 1. 検証前チェック

- [ ] 検証用 Hotpepper アカウントを使用しているか（本番店舗ではない）
- [ ] 検証用 Chrome プロファイルか（個人プロファイルではない）
- [ ] DevTools の Network パネルが「Preserve log」かつ録画中
- [ ] スクリーンショット保存先 `experiments/screenshots/hotpepper/` を確認済み
- [ ] 観察スクリプトはローカルのみで実行（外部送信しない）
- [ ] 本日のログファイル `experiments/logs/phase1/YYYY-MM-DD-*.md` を作成済み
- [ ] devlog テンプレ `devlog/YYYY-MM-DD-phase1-dom-detection.md` を準備済み

---

## 2. ログイン・画面遷移時の注意

- [ ] ログインID / パスワードをログ・スクリーンショットに残していない
- [ ] 「パスワードを保存しますか？」ダイアログを **拒否** している
- [ ] Cookie / LocalStorage / IndexedDB をエクスポートしていない
- [ ] 認証ヘッダ（Authorization / Set-Cookie）を保存していない
- [ ] 二段階認証コードを記録していない
- [ ] 操作ログを取得する場合は遷移URLのみ（クエリの個人ID部分はマスク）

---

## 3. 保存してはいけない情報チェック（毎回確認）

`docs/09_security-policy.md` 準拠。

- [ ] input の `value`（password / text / textarea すべて）
- [ ] Cookie / Session / CSRF トークン
- [ ] Authorization ヘッダ
- [ ] hidden input の `value`
- [ ] 個人情報（電話番号・メール・住所）の生値
- [ ] 店舗担当者名・問い合わせ文面・内部メモ
- [ ] アップロード済み画像本体・画像URL
- [ ] 生DOM全文 / outerHTML ダンプ
- [ ] LocalStorage / IndexedDB の中身

→ 上記が記録物に含まれていれば **即削除し、検証を一時中断**。

---

## 4. 店舗識別チェック（store identity）

`docs/04_chrome-extension-design.md` 5.4 / Failure 1。

- [ ] 管理画面ヘッダー等から店舗名を取得できる
- [ ] 住所を取得できる
- [ ] 電話番号を取得できる
- [ ] URL内の店舗識別子（path/query）を抽出できる
- [ ] 外部サイト内店舗ID（DOM上に出ていれば）を取得できる
- [ ] 店舗A → 店舗B に切替時、上記5項目すべてが追従して変化する
- [ ] 拡張で選択中の店舗情報と「不一致」を作ったとき、停止判定が成立する
- [ ] 一致時のみ次工程に進む設計が現実的（実画面で破綻しない）

---

## 5. URL pattern チェック

- [ ] メニュー編集（追加）画面の URL パターンを記録
- [ ] メニュー編集（既存編集）画面の URL パターンを記録
- [ ] mapping JSON の `url_patterns` に正規表現として書ける
- [ ] SPA 遷移で URL が変わらない箇所がないか確認
- [ ] クエリ・パスに含まれる ID が個人特定可能かをマスクポリシーに反映

---

## 6. menu_name フィールド検出チェック

| 観点 | 結果 | メモ |
|---|---|---|
| selector ヒット（1次） | ☐ | `input[name='menu_name']` 等 |
| name 属性 | ☐ |  |
| id 属性 | ☐ |  |
| label 一致 | ☐ | メニュー名 / 商品名 / 料理名 |
| aria-label | ☐ |  |
| placeholder | ☐ |  |
| nearby text | ☐ |  |
| required 属性 | ☐ |  |
| maxLength | ☐ |  |
| match_score | ☐ ≥ 0.80 |  |
| field_hash 取得 | ☐ |  |

---

## 7. price フィールド検出チェック

| 観点 | 結果 | メモ |
|---|---|---|
| selector ヒット | ☐ | `input[name='price']` 等 |
| type=number か | ☐ |  |
| label 一致 | ☐ | 価格 / 金額 / 税込 / 税抜 |
| 税区分の指定方法 | ☐ | ラジオ / チェック / 別欄 |
| 単位表記 | ☐ | 円 / 税込 など |
| 桁区切りの扱い | ☐ | 1,200 を許すか |
| 上下限 | ☐ |  |
| match_score | ☐ ≥ 0.85 |  |
| field_hash 取得 | ☐ |  |

---

## 8. category フィールド検出チェック

| 観点 | 結果 | メモ |
|---|---|---|
| 入力方式 | ☐ | select / ラジオ / モーダル / 検索 |
| label 一致 | ☐ | カテゴリ / ジャンル / 分類 |
| select の場合 option ラベルのみ取得 | ☐ | value は保存しない |
| 階層構造あり/なし | ☐ |  |
| 未対応カテゴリの存在 | ☐ |  |
| `category_mappings` に書ける | ☐ |  |
| match_score | ☐ ≥ 0.80 |  |

---

## 9. description フィールド検出チェック

| 観点 | 結果 | メモ |
|---|---|---|
| input か textarea か | ☐ |  |
| label 一致 | ☐ | 説明 / 紹介文 / PR文 / コメント |
| placeholder | ☐ |  |
| 最大文字数 | ☐ |  |
| 改行可否 | ☐ |  |
| match_score | ☐ ≥ 0.70 |  |
| 任意フィールド扱いで OK | ☐ |  |

---

## 10. status フィールド検出チェック

公開 / 下書き / 非公開（販売終了） の切替欄。

- [ ] 切替UIの存在を確認（select / ラジオ / トグル）
- [ ] ラベル文言を記録（公開 / 公開申請 / 掲載中 / 非公開 / 下書き 等）
- [ ] 「販売終了」を表現する手段を記録
- [ ] MVP標準は **hidden（非公開）**：`enabled` / `hidden` / `deleted` のうち hidden を使う
- [ ] 「削除」相当の操作は本検証では絶対に行わない

---

## 11. sale_start_date / sale_end_date 検出チェック

- [ ] 期間設定UIの存在
- [ ] 入力方式（date input / カレンダー / セパレートUI）
- [ ] フォーマット（YYYY-MM-DD / YYYY/MM/DD）
- [ ] 期間外の自動非表示挙動の有無
- [ ] 期間未指定時のデフォルト挙動
- [ ] mapping JSON `fields.sale_start_date / sale_end_date` を追加すべきか判断

---

## 12. ボタン検出チェック

| ボタン | 文言候補 | autoClick | danger | 結果 |
|---|---|---|---|---|
| 保存 | 保存 / 変更を保存 / 更新する | false | false | ☐ |
| 公開 | 公開 / 公開申請 / 掲載する | false | true | ☐ |
| 下書き保存 | 下書き保存 | false | true | ☐ |
| 削除 | 削除 / 削除する | false | true | ☐ |
| キャンセル | キャンセル / 戻る | false | false | ☐ |

- [ ] danger 系ボタンが mapping の `buttons` に明示されている
- [ ] `autoClick: false` がすべてのボタンで成立している
- [ ] 確認ダイアログ（モーダル / JS confirm）の挙動を記録

---

## 13. prohibited_actions チェック（必ず守る）

`docs/09_security-policy.md`。

- [ ] 保存ボタンを **押していない**
- [ ] 公開ボタンを **押していない**
- [ ] 削除ボタンを **押していない**
- [ ] フォーム送信を **発火させていない**（Enter キー含む）
- [ ] 認証情報をコピー / スクショしていない
- [ ] 自動入力スクリプトを実画面で走らせていない（観察のみ）
- [ ] 短時間連続アクセス（Bot 判定誘発）をしていない

---

## 14. DOM差分チェック

`docs/06_dom-diff-design.md` の差分種別ごとに観察。

- [ ] field_added の発生有無
- [ ] field_removed の発生有無
- [ ] selector_changed の発生有無
- [ ] label_changed の発生有無
- [ ] button_changed の発生有無
- [ ] layout_changed の発生有無
- [ ] hash_changed の発生有無
- [ ] 各差分のサンプルを記録（マスク後）

---

## 15. match_score 判定チェック

`experiments/phase1-dom-detection-plan.md` 9章。

- [ ] フィールド単位 score ≥ 各 `minMatchScore`
- [ ] ページ単位 score ≥ `minPageMatchScore` (0.75)
- [ ] 1位と2位のスコア差が **0.05 を超える**（曖昧解決を許さない）
- [ ] required field がすべて解決している
- [ ] スコア未達フィールドは入力対象から除外できる

→ 1つでも NG なら入力中止判定が成立すること。

---

## 16. critical diff 停止チェック

`docs/06_dom-diff-design.md` / `docs/07_sync-flow.md`。

DevTools 上で一時的に DOM を書き換えて再現：

- [ ] 必須フィールドの `name` 属性削除 → 停止
- [ ] 「保存」ボタン文言を「公開」に書換 → 停止
- [ ] フォーム構造の大幅変更 → 停止
- [ ] page_hash が変化したことを確認
- [ ] `severity = critical` で記録される設計が成立する

期待：`stopIfDomChanged: true` により入力に進まない。

---

## 17. warning diff レビュー要求チェック

- [ ] 「価格」→「金額」の label 変更で warning が出る
- [ ] placeholder 文言のみの変更で warning が出る
- [ ] 任意フィールドの追加・削除で warning が出る
- [ ] warning 時、入力は継続するが UI に注意喚起が出る設計が成立
- [ ] warning が積み上がっても自動で critical に昇格しない（人間判断に委ねる）

---

## 18. sync_job_logs に残すべきイベント

`docs/03_database-design.md` / `docs/07_sync-flow.md`。

- [ ] mapping JSON の取得（version / required_extension_version）
- [ ] DOM スキャン開始 / 完了
- [ ] 検出フィールド数 / 解決フィールド数 / スキップ数
- [ ] field 単位 match_score
- [ ] page 単位 match_score
- [ ] field_hash / page_hash
- [ ] critical / warning diff の検知
- [ ] 入力中止判定とその理由
- [ ] 入力実行（実画面では発火させないが、本番設計上のイベントとして列挙）
- [ ] 検証完了

→ 値そのものは残さない。`raw_source_json` 相当の生データ・value はログに入れない。

---

## 19. audit_logs に残すべきイベント

監査用途。誰が / いつ / どの店舗 / どのサイト / どの操作。

- [ ] ユーザーログイン
- [ ] 組織 / 店舗の選択
- [ ] mapping JSON のバージョン取得
- [ ] 店舗識別チェックの結果（一致 / 不一致）
- [ ] 入力中止判定（理由ラベル）
- [ ] critical diff の検知
- [ ] 設定変更（auto_fill_enabled / auto_submit_enabled）
- [ ] エクスポート / 出力操作

→ 個人情報は識別子（user_id / store_id）のみ。生値は残さない。

---

## 20. 検証結果の記録フォーマット

ログ保管: `experiments/logs/phase1/YYYY-MM-DD-<topic>.md`

```markdown
# Phase1 検証ログ — <topic>

## 概要
- 日時:
- 検証者:
- 対象URL（マスク後）:
- mapping JSON version:

## 観察結果
- フィールド検出（name/price/category/description/status/period）
- match_score（フィールド / ページ）
- field_hash / page_hash（ハッシュ値のみ）
- ボタン検出
- 店舗識別5項目

## 差分
- critical: <再現シナリオと結果>
- warning: <再現シナリオと結果>

## 安全条件
- prohibited_actions: 全項目満たした / 違反あり
- 保存対象に禁止情報なし

## スクリーンショット
- experiments/screenshots/hotpepper/<file>.png（マスク済み）

## 気付き / mapping JSON への反映候補

## 次回確認したい項目
```

devlog：

```markdown
# devlog/YYYY-MM-DD-phase1-dom-detection.md
- 本日の範囲
- 主要な気付き 3〜5件
- mapping JSON 反映候補
- experiments/logs への参照
```

---

## 21. 次アクション判定

検証終了時、以下のいずれに分類されるか記録する。

| 判定 | 条件 | 次アクション |
|---|---|---|
| GO | 成功条件すべて満たす（plan 13章） | Chrome拡張MVP 着手（plan 17章 範囲） |
| HOLD | 一部 NG（match_score 校正待ち / hash 不安定 等） | 校正・再検証。MVP 着手しない |
| STOP | 失敗条件のいずれかに該当（plan 14章） | 設計差し戻し。`docs/` および ADR を見直す |
| SECURITY-STOP | 禁止情報の漏洩 / 規約抵触の懸念あり | 即時中断。`docs/09_security-policy.md` を更新 |

判定理由：

```txt
判定: <GO / HOLD / STOP / SECURITY-STOP>
理由:
影響:
次タスク:
関連ファイル:
```

---

## TODO

- [ ] 実画面観察後、6〜11章のフィールド表に観察値を充填
- [ ] 12章のボタン文言候補を mapping JSON に反映
- [ ] 16・17章の差分シナリオを再現スクリプト化（DevTools snippet）
- [ ] 20章のテンプレを `experiments/templates/` に切り出すか検討
