# Failure and Countermeasures

## 1. Purpose

このドキュメントは、飲食店メニュー同期システムを本番運用する際に起こりうる障害と、その対策を整理するための仕様書である。

本システムは外部グルメサイトの管理画面DOMに依存するため、通常のWebアプリよりも以下のリスクが高い。

- 外部サイトのDOM変更
- 店舗選択ミス
- カテゴリ不一致
- 価格変換ミス
- 保存・公開ボタンの誤操作
- ログへの機密情報混入
- 外部サイト側の制限・規約リスク

MVPでは、すべての障害を完全に防ぐのではなく、危険な状態では処理を止めることを優先する。

---

## 2. Safety Policy

MVPでは以下を必須ルールとする。

- auto_fill_enabled は true
- auto_submit_enabled は false
- 保存・公開は人間が実行する
- 店舗識別チェックに失敗した場合は自動入力しない
- DOM一致スコアが低い場合は自動入力しない
- 未対応カテゴリがある場合は自動入力しない
- 価格差分が大きい場合は確認を必須にする
- 生DOM全文は保存しない
- ログにはパスワード、Cookie、セッション、入力済みvalueを保存しない
- すべての同期処理は sync_jobs / sync_job_logs に記録する

---

## Failure 1: Wrong Store Selected

### Description

拡張機能側で選択している店舗と、ブラウザで開いている外部サイト管理画面の店舗が一致しない。

### Example

- 拡張機能では「A店」を選択
- 実際の管理画面は「B店」
- A店のメニューをB店に入力してしまう

### Impact

- 別店舗のメニューが上書きされる
- 価格・商品情報の誤掲載
- クライアントへの重大な信頼低下

### Detection

- 管理画面上の店舗名を読み取る
- 電話番号を読み取る
- 住所を読み取る
- 管理画面URLまたは外部店舗IDを照合する

### Countermeasures

- store_site_identity_checks を必須にする
- 一致しない場合は自動入力を停止する
- 拡張機能UIに現在選択中の店舗名を大きく表示する
- 入力前に確認ダイアログを表示する

### Related Tables

- stores
- store_site_accounts
- store_site_identity_checks
- sync_jobs
- sync_job_logs

---

## Failure 2: DOM Changed and Fields Are Misdetected

### Description

外部サイトの管理画面DOMが変更され、以前のselectorやlabelで入力欄を正しく検出できなくなる。

### Example

- 商品名欄のselectorが変わる
- 価格欄のname属性が変わる
- 説明欄と備考欄を誤認する

### Impact

- 商品名欄に価格が入る
- 説明欄に商品名が入る
- 非公開項目を公開扱いにしてしまう

### Detection

- DOMスナップショットのhash比較
- fieldHashの差分確認
- match_scoreの低下
- 必須フィールド未検出

### Countermeasures

- match_scoreが閾値以下なら停止
- criticalなDOM差分がある場合は停止
- mapping_versionsを更新する
- 更新前後のDOM差分をdom_diffsに保存する

### Related Tables

- mapping_versions
- dom_snapshots
- dom_diffs
- sync_jobs
- sync_job_logs

---

## Failure 3: Category Mapping Mismatch

### Description

自社DBや取り込み元のカテゴリと、外部サイト側のカテゴリが一致しない。

### Example

- 自社DBの「アルコール」を外部サイトの「料理」に入れてしまう
- 「季節限定」を「通常メニュー」に入れてしまう
- 「ランチ」を「ディナー」に入れてしまう

### Impact

- 商品が誤ったカテゴリに表示される
- ユーザーがメニューを見つけにくくなる
- 店舗側の運用ルールとズレる

### Detection

- category_mappings に存在しないカテゴリを検出
- confidence_score が低いカテゴリを検出
- 外部サイト側カテゴリ一覧との差分を検出

### Countermeasures

- 未対応カテゴリは自動入力しない
- 初回セットアップ時にカテゴリ対応表を作る
- 店舗ごとにcategory_mappingsを保存する
- confidence_scoreが低い場合は人間確認を必須にする

### Related Tables

- site_store_categories
- category_mappings
- store_mapping_overrides

---

## Failure 4: Price Conversion Error

### Description

価格の表記、税込・税抜、カンマ、円表記、コース料金などの変換に失敗する。

### Example

- 1,200円を1円として扱う
- 税込価格を税抜欄へ入力する
- 1人前価格とコース総額を間違える

### Impact

- 誤価格掲載
- 店舗の売上損失
- 顧客トラブル

### Detection

- priceの数値バリデーション
- 前回価格との差分チェック
- 上限・下限チェック
- original_price_textとの比較

### Countermeasures

- priceはINTEGERで保存する
- original_price_textをraw_source_jsonに保存する
- tax_typeを必須にする
- 価格差分が大きい場合は確認必須にする

### Related Tables

- menu_items
- menu_item_versions
- transform_rules
- sync_job_logs

---

## Failure 5: Wrong Save or Publish Button Clicked

### Description

保存、確認、公開、公開申請、下書き保存などのボタンを誤認して押してしまう。

### Example

- 下書き保存のつもりが公開された
- 確認画面で止まるべきところを公開申請した
- 保存ボタンではなく削除ボタンを押した

### Impact

- 誤公開
- 意図しない掲載変更
- 復旧作業が必要になる

### Detection

- ボタン文言のmatch_score
- 危険ボタン文言の検出
- auto_submit_enabledの状態確認

### Countermeasures

- MVPではauto_submit_enabled=false
- 公開系ボタンは危険操作として扱う
- 自動クリック対象から除外する
- 保存前プレビューを必須にする

### Related Tables

- mapping_versions
- store_mapping_overrides
- sync_jobs

---

## Failure 6: Extension Version Mismatch

### Description

古いChrome拡張機能が新しいmapping JSONを読み込み、想定外の挙動をする。

### Impact

- 自動入力に失敗する
- 一部フィールドが反映されない
- 安全チェックが正しく動作しない

### Detection

- mapping JSON の required_extension_version を確認
- 実行中の extension_version と比較する

### Countermeasures

- 古い拡張機能では実行停止
- アップデート案内を表示
- sync_jobsにextension_versionを保存する

### Related Tables

- mapping_versions
- sync_jobs

---

## Failure 7: PII or Sensitive Data Leaked into Logs

### Description

DOMスナップショットやログに、個人情報・認証情報・セッション情報が混入する。

### Impact

- 情報漏洩
- 法務・セキュリティリスク
- クライアント信頼低下

### Detection

- email / phone / address らしき文字列検出
- password field検出
- hidden value検出
- cookie/session文字列検出

### Countermeasures

- 生DOM全文は保存しない
- input valueは保存しない
- password/cookie/sessionは保存禁止
- ログ保存前にマスク処理を行う
- ログ保存期間を設定する

### Related Tables

- dom_snapshots
- dom_diffs
- sync_job_logs

---

## Failure 8: External Site Account Locked or Restricted

### Description

短時間の大量操作や外部サイト側のBot判定により、アカウントが制限される。

### Impact

- 管理画面にログインできなくなる
- 更新作業が停止する
- 外部サイトから警告される

### Detection

- ログイン制限画面
- CAPTCHA表示
- エラー文言検出
- 操作失敗回数の増加

### Countermeasures

- 自動保存は禁止
- 操作間隔を制限する
- 大量更新時は分割する
- ユーザー操作を必ず挟む
- サイトごとの利用規約を確認する

### Related Tables

- store_site_accounts
- sync_jobs
- sync_job_logs

---

## Failure 9: Rollback Incomplete

### Description

内部DBでは過去バージョンに戻せても、外部サイト側では完全に復元できない。

### Example

- 画像が戻らない
- 外部サイト側の商品IDが変わっている
- カテゴリが削除されている
- 手動修正と競合する

### Impact

- 内部DBと外部サイトが不一致になる
- 復旧作業が複雑になる

### Detection

- ロールバック前後の差分チェック
- external_item_idの存在確認
- 外部サイト現在状態の再取得

### Countermeasures

- ロールバックも新規バージョンとして作成する
- 外部サイト反映前に差分プレビューを出す
- external_item_idを保持する
- 画像URL・元画像情報を保存する

### Related Tables

- menu_item_versions
- menu_item_rollbacks
- sync_jobs
- sync_job_logs

---

## Failure 10: Seasonal Menu Deletion Mistake

### Description

季節限定・期間限定メニューを終了する際、削除・非公開・販売終了の扱いを間違える。

### Impact

- 販売中の商品が非公開になる
- 終了商品が掲載され続ける
- 復元できない削除が発生する

### Detection

- sale_end_dateの確認
- status変更前後の差分確認
- 対象商品数の確認

### Countermeasures

- 初期は削除ではなく非公開を標準にする
- 自動削除は禁止
- 終了処理は差分プレビュー必須
- 外部サイト別の終了処理ルールを持つ

### Related Tables

- menu_items
- menu_item_versions
- transform_rules
- sync_jobs

---

## Test Design Notes

このドキュメントの各Failureは、後続のテスト設計に変換する。

例：

- Wrong Store Selected → 店舗識別チェックテスト
- DOM Changed → DOM差分検知テスト
- Category Mapping Mismatch → カテゴリ未対応時の停止テスト
- Price Conversion Error → 価格バリデーションテスト
- Wrong Save Button → auto_submit禁止テスト
