# Security Policy

## 1. 目的

このドキュメントは、飲食店メニュー同期システムにおけるセキュリティ・プライバシー・ログ保存方針を定義する。

本システムは外部グルメサイトの管理画面DOMを扱うため、通常のWebアプリ以上にログ設計とデータ保存範囲に注意する必要がある。

---

## 2. 基本方針

```txt
必要最小限のデータだけ取得する
ログイン情報は保存しない
Cookie・Session・Tokenは保存しない
生DOM全文は保存しない
input valueは原則保存しない
危険時は処理を止める
すべての同期処理は監査可能にする
```

---

## 3. 保存してよい情報

### DOM構造情報

- tag
- type
- name
- id
- label
- placeholder
- aria-label
- nearby text
- selector hint
- field hash
- button text
- URL pattern

### 店舗識別情報

- 店舗名
- 電話番号
- 住所
- 管理画面URL
- 外部店舗ID

ただし、店舗識別情報は利用目的を明確にし、必要な範囲に限定する。

### 同期ログ

- 実行ユーザー
- 対象店舗
- 対象サイト
- 使用mapping version
- 実行日時
- 成功/失敗
- 安全停止理由

---

## 4. 保存してはいけない情報

```txt
外部サイトのログインID
外部サイトのパスワード
Cookie
Session
CSRF token
認証token
input valueの生データ
hidden valueの詳細
生DOM全文
問い合わせ内容
顧客情報
個人情報を含む内部メモ
```

---

## 5. DOM Sanitization

Chrome拡張はAPIへ送信する前に必ずサニタイズする。

### 削除対象

- input[type=password]
- hidden input value
- cookie/session/tokenらしき文字列
- value属性
- data属性のうち長大な値

### マスク対象

- メールアドレスらしき文字列
- 電話番号らしき文字列
- 個人名らしき文字列
- 住所らしき文字列

ただし、店舗識別に必要な電話番号・住所は、store_site_identity_checksに限定して保存する。

---

## 6. 認証・認可

### 認証

- Admin WebとChrome拡張は同一API認証基盤を使う
- Chrome拡張はアクセストークンでAPI通信する
- トークンは最小権限・短期有効期限を前提にする

### 認可

ユーザーは所属organizationおよび許可されたstoreのみ操作できる。

role例：

```txt
owner: 全操作可能
admin: 組織内管理可能
operator: 店舗操作可能
viewer: 閲覧のみ
```

---

## 7. Chrome Extension Security

- host_permissionsは必要な外部サイトに限定する
- activeTabを活用し、過剰権限を避ける
- content scriptは対象URLでのみ動作する
- 外部サイトのログイン情報を読み取らない
- ユーザーに見えない自動操作を行わない

---

## 8. Audit Log

以下は監査ログとして保存する。

- ログイン
- 店舗選択
- メニュー作成・更新
- メニューバージョン作成
- ロールバック
- mapping公開
- DOM差分検出
- sync job開始/終了
- safety stop

---

## 9. Data Retention

保存期間は今後決定するが、初期案は以下。

```txt
sync_job_logs: 180日
dom_snapshots: 90日
dom_diffs: 180日
menu_item_versions: 無期限または契約期間中保持
audit logs: 1年
```

---

## 10. 外部サイト規約リスク

外部グルメサイトの管理画面自動操作は、サイトごとの利用規約に抵触する可能性がある。

MVPでは以下の方針を取る。

- 自動保存しない
- 自動公開しない
- ユーザー操作を必ず挟む
- 大量更新を避ける
- サイトごとの規約確認を行う
- ログイン情報を保存しない

---

## 11. Incident Response

障害・情報漏洩疑いが発生した場合：

```txt
1. 該当organizationの同期処理を停止
2. 該当sync_jobsを確認
3. ログの個人情報混入有無を確認
4. 必要に応じてログ削除/マスク
5. 管理者へ通知
6. 再発防止策をmapping/extensionに反映
```
