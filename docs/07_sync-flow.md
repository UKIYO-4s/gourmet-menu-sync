# Sync Flow

## 1. 目的

このドキュメントは、メニュー情報を取り込み、共通形式へ変換し、外部サイト管理画面へ入力するまでの処理フローを定義する。

---

## 2. Core Concept

本システムでは、外部サイト同士を直接変換しない。

必ず以下の流れにする。

```txt
Source
↓
Common Menu Model
↓
Target
```

---

## 3. Flow 1: Internal DB to External Site

```txt
1. ユーザーがAdmin Webでメニューを更新
2. menu_itemsを更新
3. menu_item_versionsに履歴を作成
4. menu_sync_routesから反映先を確認
5. sync_jobをpendingで作成
6. ユーザーが外部サイト管理画面を開く
7. Chrome拡張が店舗識別情報を照合
8. Chrome拡張がmapping JSONを取得
9. DOMスキャンを実行
10. match_scoreを計算
11. 安全条件を満たした場合のみ自動入力
12. 差分プレビューを表示
13. ユーザーが手動で保存
14. sync_job_logsに結果を記録
15. sync_jobをcompletedまたはfailedに更新
```

---

## 4. Flow 2: External Site to External Site

例：食べログを正本にしてホットペッパーへ反映する場合。

```txt
1. ユーザーが食べログ管理画面を開く
2. Chrome拡張が既存メニューを読み取る
3. tabelog_source_adapterでCommon Menu Modelへ変換
4. menu_itemsへ保存
5. menu_item_versionsへ履歴保存
6. sync_routeからホットペッパーが反映先と判断
7. ユーザーがホットペッパー管理画面を開く
8. hotpepper_target_adapterで入力形式へ変換
9. mapping JSONを取得
10. DOMスキャンを実行
11. 店舗識別情報を照合
12. 自動入力
13. 人間が保存前に確認
14. sync_job_logsへ結果保存
```

---

## 5. Flow 3: CSV Import to External Site

```txt
1. ユーザーがCSVをアップロード
2. csv_source_adapterでCommon Menu Modelへ変換
3. 変換前の元データをraw_source_jsonへ保存
4. 差分プレビューを表示
5. ユーザーが取り込み確定
6. menu_itemsを更新
7. menu_item_versionsへ履歴保存
8. 外部サイトへの同期候補を作成
```

---

## 6. Flow 4: First Store Setup

```txt
1. organizationを作成
2. storeを作成
3. external_siteを選択
4. store_site_accountを作成
5. ユーザーが外部サイト管理画面を開く
6. Chrome拡張がDOMをスキャン
7. 店舗名・住所・電話番号を検出
8. store_site_identity_checksを作成
9. カテゴリ一覧を検出
10. site_store_categoriesへ保存
11. site_store_profileを作成
12. 自社カテゴリとの対応表を作成
13. category_mappingsへ保存
14. 初回セットアップ完了
```

---

## 7. Flow 5: Rollback

```txt
1. ユーザーが戻したいバージョンを選択
2. menu_item_versionsから対象バージョンを取得
3. 現在状態との差分を表示
4. ユーザーがロールバックを確定
5. 過去バージョンを元に新しいmenu_item_versionを作成
6. change_type = rollback として保存
7. menu_itemsを更新
8. menu_item_rollbacksへ記録
9. 必要に応じて外部サイト同期ジョブを作成
10. 外部サイト反映前に差分プレビューを表示
```

---

## 8. Human Review Points

人間確認が必要な箇所：

- CSV取り込み確定前
- 外部サイトへの入力前
- 保存・公開前
- カテゴリ未対応時
- 価格差分が大きい時
- DOM差分がある時
- ロールバック実行前
- 店舗識別が不確実な時

---

## 9. Sync Job Status

```txt
pending
running
waiting_user_review
completed
failed
cancelled
blocked_by_safety_check
```

---

## 10. Sync Job Log Event Types

```txt
job_created
mapping_loaded
store_identity_checked
dom_scanned
dom_diff_detected
fields_matched
auto_fill_started
auto_fill_completed
user_review_required
safety_stop
job_completed
job_failed
```

---

## 11. Related Tables

- menu_items
- menu_item_versions
- menu_sync_routes
- transform_rules
- mapping_versions
- store_site_accounts
- sync_jobs
- sync_job_logs
