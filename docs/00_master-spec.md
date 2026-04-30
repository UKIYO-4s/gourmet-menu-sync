# 飲食店メニュー同期システム Master Spec

## 1. システム概要

本システムは、飲食店のメニュー情報を一元管理し、自社サイト・CSV・食べログ・ホットペッパー・ぐるなび・Googleビジネスプロフィールなど、複数のメニュー管理元および掲載先を安全に同期するためのシステムである。

初期MVPでは、外部サイトの管理画面に対して完全自動保存・完全自動公開は行わない。Chrome拡張機能による入力補助を中心とし、保存・公開は人間が確認して実行する。

---

## 2. 中心思想

本システムの設計思想は以下の5つである。

```txt
source
version
route
mapping
log
```

意味：

- source: どこからメニュー情報を取り込むか
- version: どの時点のメニュー・マッピング・DOM状態か
- route: どこからどこへ同期するか
- mapping: 共通形式と外部サイトDOMをどう対応させるか
- log: 何が起きたか、誰が実行したか、成功したか失敗したか

---

## 3. 基本方針

### 3.1 外部サイト同士を直接変換しない

悪い設計：

```txt
食べログ → ホットペッパー
ホットペッパー → ぐるなび
ぐるなび → 食べログ
```

この方式は、外部サービスが増えるほど組み合わせが爆発する。

良い設計：

```txt
Source
↓
Common Menu Model
↓
Target
```

すべてのメニュー情報は一度 `Common Menu Model` に変換し、そこから各ターゲットへ出力する。

---

### 3.2 店舗ごとに正本が違う前提にする

店舗や会社によって、メニューの正本は異なる。

例：

```txt
会社A: 自社サイトを正本にして、食べログ・ホットペッパー・ぐるなびへ反映
会社B: 食べログを正本にして、ホットペッパー・自社サイトへ反映
会社C: CSVを正本にして、複数サイトへ反映
```

そのため `store_menu_sources` と `menu_sync_routes` によって、店舗ごとの正本と同期先を管理する。

---

### 3.3 初期は入力補助に限定する

MVPでは以下を基本とする。

```txt
auto_fill_enabled = true
auto_submit_enabled = false
```

Chrome拡張は入力欄への値の反映までを担当し、保存・公開は人間が行う。

理由：

- 外部サイトDOM変更による誤入力を防ぐ
- 店舗選択ミスによる誤反映を防ぐ
- 利用規約・Bot判定リスクを抑える
- 価格・カテゴリ変換ミスを保存前に止める

---

## 4. 全体アーキテクチャ

```txt
[ユーザー / 飲食コンサル / 運用代行]
        ↓
[Admin Web]
        ↓
[API Server]
        ↓
[Database]
        ↓
[Chrome Extension]
        ↓
[外部グルメサイト管理画面]
        ↓
[DOM Scan / Match / Auto Fill / Report]
```

---

## 5. 主要コンポーネント

### 5.1 Admin Web

- 組織管理
- ユーザー管理
- 店舗管理
- メニュー管理
- メニュー履歴確認
- 外部サービス設定
- カテゴリマッピング
- 同期ルート設定
- DOM差分確認
- 同期ログ確認
- ロールバック操作

### 5.2 API Server

- 認証・認可
- DB操作
- メニューCRUD
- バージョン管理
- マッピングJSON配信
- DOMスナップショット受信
- DOM差分生成
- 同期ジョブ管理
- Chrome拡張との通信

### 5.3 Chrome Extension

- 外部サイト管理画面のDOMスキャン
- 店舗識別情報の照合
- マッピングJSONの取得
- 入力欄の検出
- 自動入力
- 保存前停止
- DOMスナップショット送信
- エラー・警告の表示

### 5.4 Common Menu Model

すべてのソースから取り込まれるメニュー情報の共通表現。

最低限の項目：

```txt
name
description
price
tax_type
category
status
image_url
sale_start_date
sale_end_date
sort_order
raw_source_json
```

共通化できない項目は `raw_source_json` に保存する。

---

## 6. アカウント構造

```txt
organizations
  └ organization_users
      └ users
  └ stores
      └ store_site_accounts
      └ site_store_profiles
      └ site_store_categories
      └ category_mappings
      └ menu_sync_routes
```

飲食コンサルや運用代行会社が大量店舗を扱うため、`1ユーザー = 1店舗` ではなく、`organization -> stores` 構造を採用する。

---

## 7. 初回店舗セットアップ

初回セットアップでは、店舗固有の管理画面情報を学習する。

```txt
1. 店舗作成
2. 外部サービス選択
3. 管理画面URL登録
4. Chrome拡張でDOMスキャン
5. 店舗名・住所・電話番号を検出
6. カテゴリ一覧を検出
7. メニュー構造を検出
8. 価格・税区分の扱いを検出
9. site_store_profileを保存
10. site_store_categoriesを保存
11. category_mappingsを作成
```

---

## 8. バージョン管理

以下は必ず履歴を残す。

- メニュー情報
- メニューセクション
- マッピングJSON
- DOMスナップショット
- DOM差分
- 同期ジョブ
- ロールバック操作

ロールバックは過去データを直接戻すのではなく、過去バージョンを元に新しいバージョンを作成する。

---

## 9. 本番投入時の安全条件

- 店舗識別チェック必須
- DOM一致スコアが低い場合は停止
- 必須項目が見つからない場合は停止
- 未対応カテゴリがある場合は停止
- 価格差分が大きい場合は確認
- auto_submit_enabled=false
- 生DOM全文は保存しない
- 入力済みvalueは保存しない
- すべての実行をsync_jobsに記録する

---

## 10. 推奨フォルダ名

```txt
Menu-sync-system
```

またはプロダクト名としては以下も候補。

```txt
menu-sync-hub
restaurant-menu-sync
menu-bridge
menu-ops-hub
```

現状のローカルフォルダ `/Users/shoeigoto/Desktop/Menu-sync-system` は問題ない。
