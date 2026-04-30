# MVP Scope

## 1. MVPの目的

MVPの目的は、飲食店メニュー情報を一元管理し、Chrome拡張機能によって外部サイト管理画面へ安全に自動入力できる最小構成を作ることである。

MVPでは「完全自動更新」ではなく「安全な入力補助」を目標とする。

---

## 2. MVPで実装すること

### 2.1 アカウント・組織管理

- organization作成
- user作成
- organization_usersによる権限管理
- stores作成
- store_usersによる店舗権限管理

### 2.2 メニュー管理

- メニュー登録
- メニュー編集
- メニュー削除ではなく非公開化
- メニュー履歴保存
- メニューの現在状態とバージョン履歴の分離
- ロールバック候補表示

### 2.3 Common Menu Model

- name
- description
- price
- tax_type
- category
- status
- image_url
- sale_start_date
- sale_end_date
- sort_order
- raw_source_json

### 2.4 外部サービス管理

- external_sites登録
- store_site_accounts作成
- 管理画面URL保存
- 店舗識別情報保存
- 外部サービスごとの有効/無効管理

### 2.5 Chrome拡張

- ログイン済みユーザーの店舗選択
- 外部管理画面DOMスキャン
- 店舗識別チェック
- mapping JSON取得
- match_score計算
- 入力欄への自動入力
- 保存前停止
- DOMスナップショット送信
- エラー表示

### 2.6 DOM差分検知

- DOMスナップショット保存
- 前回スナップショットとの差分検知
- critical/warning/info分類
- critical時の自動入力停止

### 2.7 カテゴリマッピング

- 外部サイト管理画面からカテゴリ一覧を取得
- site_store_categories保存
- 自社カテゴリとの対応付け
- 未対応カテゴリ検出

### 2.8 同期ログ

- sync_jobs作成
- sync_job_logs保存
- 実行ユーザー
- 対象店舗
- 対象外部サイト
- 使用マッピングバージョン
- 成功/失敗
- エラー内容

---

## 3. MVPでやらないこと

MVPでは以下を実装しない。

```txt
外部サイトへの完全自動保存
外部サイトへの完全自動公開
ログイン情報保存
Cookie保存
CAPTCHA回避
画像アップロード完全自動化
全外部サイト一括対応
AIによる完全自動カテゴリ判断
生DOM全文保存
外部サイトへの大量一括操作
```

---

## 4. 初期対応優先度

### Priority 1

- ホットペッパーのメニュー編集画面
- CSV to Common Menu Model
- Common Menu Model to ホットペッパー入力補助

### Priority 2

- 食べログ管理画面の読み取り
- 食べログ to Common Menu Model

### Priority 3

- ぐるなび
- Googleビジネスプロフィール
- 自社サイト連携

---

## 5. MVPの安全条件

以下を満たさない場合は自動入力しない。

- 店舗識別が一致している
- required_extension_versionを満たしている
- mapping versionがpublishedである
- required fieldsがすべて見つかる
- page match scoreが閾値以上
- price fieldが一意に特定できる
- 未対応カテゴリがない
- critical DOM diffがない

---

## 6. MVP完了条件

MVP完了の定義：

```txt
1店舗分のメニューを管理画面で登録できる
メニュー更新履歴が残る
ホットペッパー管理画面でChrome拡張がDOMをスキャンできる
店舗識別チェックができる
マッピングJSONに従って入力欄を検出できる
保存せずに自動入力で止まる
同期ログが残る
DOM差分が検出できる
```

---

## 7. 成功指標

- 手入力時間を50%以上削減
- 誤保存ゼロ
- 店舗選択ミスによる入力ゼロ
- DOM変更時に自動停止できる
- 同期履歴を追跡できる
