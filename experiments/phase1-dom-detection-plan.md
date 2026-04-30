# Phase 1: DOM検出 検証計画

Chrome拡張MVP実装前のDOM検出検証。
仮ターゲット: ホットペッパー（Hotpepper）のメニュー編集画面。

関連: `docs/04_chrome-extension-design.md` / `docs/05_mapping-json-design.md` / `docs/06_dom-diff-design.md` / `docs/09_security-policy.md`

---

## 1. 検証目的

- Hotpepperのメニュー編集画面のDOM構造を観察し、自動入力に使えるアンカー（selector / label / placeholder / nearby text）を特定する
- mapping JSON 仕様（`docs/05_mapping-json-design.md`）が現実のDOMと整合するか確認する
- match_score の初期仮基準が現実的かを評価する
- field_hash / page_hash の安定性（差分検知の感度）を確認する
- Chrome拡張MVPに入る前に、必要十分な情報だけが取得・送信できることを検証する
- **ログイン情報 / Cookie / 入力済み value / 生DOM全文を一切扱わない** 運用を検証段階から徹底する

---

## 2. 検証対象画面

| 種別 | 画面 | 状態 |
|---|---|---|
| 一次 | Hotpepper管理画面: メニュー編集（追加） | 必須 |
| 二次 | Hotpepper管理画面: メニュー編集（既存編集） | 必須 |
| 補助 | Hotpepper管理画面: メニュー一覧 | 任意 |
| 比較 | 食べログ管理画面（参考のみ） | 任意 |

サイト識別子: `site_key = "hotpepper"`, `page = "menu_edit"`

---

## 3. 事前準備

- 検証用 Hotpepper アカウントの利用許諾を確認（規約抵触の有無）
- 検証用店舗1件を選定（実店舗で本番データを変更しない）
- ブラウザは通常使用しているプロファイルとは別の検証用 Chrome プロファイルを使用
- DevTools Console / Elements / Network パネルを使用
- 検証は人間操作のみ（拡張機能本体はまだ作らない、最低限の調査スクリプトのみ）
- スクリーンショット保存先: `experiments/screenshots/hotpepper/`（マスク済みのみ保存）
- DOM抽出スクリプトは検証PCローカル実行のみ。サーバー送信しない
- **絶対にやらないこと:** ログイン情報の保存 / Cookie取得 / 入力済み value の保存 / 生DOM全文のダンプ / 保存ボタンクリック

---

## 4. 手動で確認する項目

- [ ] メニュー編集画面のURLパターン（パスに store_id 等が入るか）
- [ ] 入力欄のラベル文言（「メニュー名 / 商品名 / 料理名」のどれか）
- [ ] 価格欄の単位表記（円 / 税込 / 税抜の併記方法）
- [ ] カテゴリ選択方式（select / ラジオ / モーダル / インクリメンタル検索）
- [ ] 説明欄が input か textarea か、最大文字数
- [ ] 画像アップロード欄の有無と挙動（MVP対象外だが記録）
- [ ] 保存ボタンの文言・色・配置・確認画面の有無
- [ ] 公開 / 下書き / 非公開 切替の有無
- [ ] 確認ダイアログ（JSアラート / モーダル）の挙動
- [ ] iframe / shadow DOM の有無
- [ ] SPA か MPA か、フォーム送信方式
- [ ] 店舗識別情報（店舗名・住所・電話番号）が画面上どこに表示されるか
- [ ] 編集前後でURLが変わるか、変わらない場合は state 保持方法

---

## 5. DOMスキャンで取得する構造情報

`docs/03_database-design.md` / `docs/06_dom-diff-design.md` に従う。

各フィールドごとに以下を取得：

```txt
tag                 -- input / textarea / select / button
type                -- text / number / password など
name                -- name 属性
id                  -- id 属性
label               -- 関連 label テキスト
ariaLabel           -- aria-label
placeholder         -- placeholder
nearText            -- 近接テキスト（左/上のラベル風文字列）
selectorHint        -- 安定selector候補
fieldHash           -- 上記情報から計算したハッシュ
required            -- required属性
maxLength           -- maxlength属性
options             -- selectの場合の選択肢ラベルのみ（valueは保存しない）
```

ページ単位で：

```txt
url_pattern
page_title
form_count
detected_field_count
button_candidates  -- text + role のみ
page_hash
```

---

## 6. 取得してはいけない情報

`docs/09_security-policy.md` に従う。

- 入力済みの value（password / text / textarea いずれも）
- Cookie / セッション / トークン / Authorization ヘッダ
- hidden input の value
- 個人情報を含む生DOM全文
- 店舗担当者名・問い合わせ先メール・内部メモ
- アップロード済み画像の本体データ（URL も検証段階では保存しない）
- ローカルストレージ / IndexedDB の中身

検証スクリプトでは取得対象を allowlist 方式で限定する。

---

## 7. store identity 検証項目

`docs/04_chrome-extension-design.md` 5.4 / Failure 1 に対応。

管理画面から拾うべき項目：

- [ ] 店舗名（ヘッダーやサイドバー等の表示文字列）
- [ ] 住所
- [ ] 電話番号
- [ ] 管理画面URL内の店舗識別子（path / query）
- [ ] 外部サイト内店舗ID（DOM上に出ていれば）

検証手順：

1. 検証用店舗A・店舗Bの管理画面を開く
2. 上記5項目をDOMから取得
3. 拡張側で選択中の店舗情報と一致するかを擬似的に判定
4. 不一致パターンで「停止」する判定が成立することを確認

---

## 8. menu_name / price / category / description 検出基準

| フィールド | 必須 | 一次selector候補 | label候補 | placeholder候補 | minMatchScore |
|---|---|---|---|---|---|
| name | ✅ | `input[name*='name']`, `input[name*='menu']` | メニュー名 / 商品名 / 料理名 | メニュー名を入力 | 0.80 |
| price | ✅ | `input[name*='price']`, `input[type='number']` | 価格 / 金額 / 税込 / 税抜 | 例: 1200 / 円 | 0.85 |
| category | ✅ | `select[name*='category']`, `select[name*='genre']` | カテゴリ / ジャンル / 分類 | （selectのため通常なし） | 0.80 |
| description | ⛔（任意） | `textarea[name*='desc']`, `textarea[name*='comment']` | 説明 / 紹介文 / PR文 | 商品の説明 | 0.70 |

判定方針：

- 1次は selector / name / id（高信頼）
- 2次は label / aria-label
- 3次は placeholder / nearby text
- どれも `minMatchScore` 未満 → そのフィールドはスキップ
- `required: true` のフィールドが解決しなければ **入力全体を中止**

---

## 9. match_score 初期仮基準

仮の重み付け（検証で校正する）：

```txt
selector ヒット      : +0.50
name 完全一致        : +0.20
id 完全一致          : +0.15
label 完全一致       : +0.20
label 部分一致       : +0.10
aria-label 一致      : +0.10
placeholder 部分一致 : +0.05
nearby text 一致     : +0.05
type 期待一致        : +0.05
```

- フィールド単位 `minMatchScore`: 上表参照
- ページ単位 `minPageMatchScore`: 0.75
- 候補が複数あり、1位と2位のスコア差が 0.05 以下の場合は **停止**（重要フィールドの曖昧解決を許さない）

---

## 10. field_hash / page_hash の検証方針

### 10.1 field_hash

入力対象としたい：`tag + type + name + id + label + placeholder + nearbyKeywords` を canonical 化して SHA-256。

検証：

- [ ] 同一画面を別タブ・別時間に開いてハッシュが一致すること
- [ ] 些細な遅延読み込み（広告・通知バッジ）でハッシュが揺れないこと
- [ ] フィールドの並び替えのみで値が変わらないこと（順序非依存）

### 10.2 page_hash

各 field_hash の集合 + ページ構造シグネチャ（フォーム数 / required数）から算出。

検証：

- [ ] 1日間隔・1週間隔で再取得し、安定すること
- [ ] サイト側の小規模変更（コピー差し替え等）でも維持されること
- [ ] フィールド追加・削除では必ず変化すること

---

## 11. critical diff の再現方法

`docs/06_dom-diff-design.md` の重要度 `critical` を意図的に発生させて検知できるか確認する。

再現手段（DevTools 上で一時的に行う、サーバー側は変更しない）：

- [ ] `field_removed`: 必須フィールド（name 入力欄）の `name` 属性を削除
- [ ] `selector_changed`: `input[name='menu_name']` の name を別名に書き換え
- [ ] `button_changed`: 「保存」ボタン文言を「公開」に書き換え
- [ ] `layout_changed`: フォーム構造（フィールド順）を入れ替え

期待される挙動：

- match_score 低下 → ページ単位 `minPageMatchScore` を下回る
- `stopIfDomChanged: true` により入力中止
- diff レコードに `severity = critical` が記録される

---

## 12. warning diff の再現方法

- [ ] `label_changed`: 「価格」を「金額」に変更
- [ ] `placeholder_changed`: placeholder の文言だけ変更
- [ ] selector 候補のうち 2次・3次のみが変化（1次は維持）
- [ ] 任意フィールド（description）の追加・削除

期待される挙動：

- フィールド単位 match_score は閾値以上を維持
- diff レコードに `severity = warning` が記録される
- 入力は継続するが、UIにアラート表示される

---

## 13. 成功条件

- [ ] Hotpepperのメニュー編集画面で `name / price / category / description` の入力欄を 4/4 検出できる
- [ ] 各フィールドの match_score が初期仮基準を満たす
- [ ] field_hash が同一画面の再取得で一致する
- [ ] page_hash が小規模UI変更でも安定する
- [ ] critical diff を意図的に発生させたとき、判定上「停止」する
- [ ] warning diff では入力継続しつつアラートが出せると確認できる
- [ ] 取得情報が allowlist の範囲内に収まり、禁止情報を含まない
- [ ] store identity 不一致で停止判定が成立する

---

## 14. 失敗条件

- 主要フィールドのうち 1つでも match_score 算出が困難（selector / label / placeholder の手がかりが極端に乏しい）
- DOM が iframe や shadow DOM に深くネストし、安定 selector が得られない
- field_hash が同一画面の再取得で揺れる
- page_hash が無関係な要素変化で大きく変動する
- 取得情報に value / Cookie / hidden 値などが混入していた
- DOM 構造が SPA で動的すぎて、ロード完了判定が難しい

失敗条件に1つでも該当した場合は **Chrome拡張MVPの実装に進まず、設計を見直す**。

---

## 15. 検証ログの残し方

ログ保管場所: `experiments/logs/phase1/YYYY-MM-DD-<topic>.md`

各ログに含める：

- 日時 / 検証者
- 対象URL（クエリのうち個人特定可能なものはマスク）
- 観察した DOM 構造の要約（selector / label / placeholder / nearby）
- 取得した field_hash / page_hash（ハッシュ値のみ。元データは載せない）
- 算出した match_score
- 確認した critical / warning diff のシナリオと結果
- スクリーンショット参照（マスク済みのみ）
- 気付き・mapping JSON への反映候補

禁止事項：

- 入力済み value のログ記載
- Cookie / トークン / セッション ID
- 個人情報・店舗担当者名・連絡先
- 生DOM全文の貼り付け

---

## 16. devlog への記録ルール

`devlog/` に日次〜週次のサマリを残す。

- ファイル名: `devlog/YYYY-MM-DD-phase1-dom-detection.md`
- 内容:
  - その日に検証した範囲
  - 主要な気付き 3〜5件
  - mapping JSON 仕様への反映候補
  - 次の検証で確認したい項目
- `experiments/logs/` の詳細ログへリンクする
- 機密情報は記載しない（experiments と同じ allowlist を適用）
- 仕様変更が必要になった場合は、関連 docs / ADR への反映を「TODO」として記録する

---

## 17. 次に作る Chrome拡張MVP の範囲

本検証で得られた知見を踏まえて、Chrome拡張MVPは以下に限定する（`docs/04_chrome-extension-design.md` と整合）。

含む：

- Manifest V3 最小構成（host_permissions は Hotpepper のみ）
- popup でのログイン / 組織 / 店舗選択
- mapping JSON 取得（API or ローカルJSON 直読み）
- scanner: 4フィールド（name / price / category / description）の検出のみ
- matcher: 本ドキュメント 9 章の仮基準を実装
- identity-checker: 店舗名・住所・電話・URL の4点照合
- executor: 入力イベント発火までで停止（保存ボタンに触れない）
- reporter: field_hash / page_hash / match_score / 結果サマリのみ送信
- sanitizer: allowlist による情報フィルタ

含まない（明示的に除外）：

- 自動保存 / 自動公開（ADR-003）
- 画像アップロード
- iframe / shadow DOM 横断
- 食べログ・ぐるなび等の他サイト
- カテゴリの自動生成・AI判断
- ロールバックUI
- 複数店舗一括処理

---

## TODO

- [ ] 実際の Hotpepper メニュー編集画面で観察した結果を反映し、9章の重み付けを校正
- [ ] field_hash の canonical 化アルゴリズムを `docs/06_dom-diff-design.md` に正式化
- [ ] 検証用調査スクリプト（DevTools Console 用 snippet）を `experiments/scripts/` に整備
