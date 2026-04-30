# Chrome Extension Design

## 1. 目的

Chrome拡張機能は、外部グルメサイトの管理画面に対して、メニュー情報の入力補助を行う。

MVPでは自動保存・自動公開は行わず、入力後に人間が確認して保存する。

---

## 2. 基本動作

```txt
1. ユーザーが外部サイト管理画面を開く
2. 拡張機能が現在URLを確認
3. ユーザーがorganization/storeを選択
4. APIからstore_site_accountを取得
5. 管理画面上の店舗識別情報を読み取る
6. store_site_identity_checksと照合
7. APIからmapping JSONを取得
8. DOMスキャンを実行
9. match_scoreを計算
10. 安全条件を満たせば自動入力
11. 保存前に停止
12. 結果をAPIへ送信
```

---

## 3. MVPで禁止する操作

```txt
保存ボタンの自動クリック
公開ボタンの自動クリック
公開申請ボタンの自動クリック
ログイン情報の保存
Cookieの保存
セッション情報の保存
CAPTCHA回避
生DOM全文の送信
ユーザーに見えない状態での自動操作
```

---

## 4. 推奨構成

```txt
extension/
  manifest.json
  src/
    popup/
      index.html
      popup.ts
    sidepanel/
      index.html
      sidepanel.ts
    background/
      service-worker.ts
    content/
      scanner.ts
      matcher.ts
      executor.ts
      reporter.ts
      identity-checker.ts
    core/
      api-client.ts
      mapping-loader.ts
      validation.ts
      sanitizer.ts
      logger.ts
```

---

## 5. 各モジュール責務

### 5.1 scanner.ts

DOMから入力補助に必要な構造情報を抽出する。

抽出対象：

- input
- textarea
- select
- button
- label
- aria-label
- placeholder
- nearby text
- form structure

抽出しないもの：

- 入力済みvalue
- password
- cookie
- session
- token

---

### 5.2 matcher.ts

mapping JSONとDOMスキャン結果を比較し、どの入力欄にどの値を入れるか判定する。

判定要素：

- selector一致
- label一致
- placeholder一致
- name/id一致
- aria-label一致
- nearby text一致
- field type一致

結果として `match_score` を算出する。

---

### 5.3 executor.ts

安全条件を満たした場合のみ、実際に入力欄へ値を反映する。

やること：

- input value set
- textarea value set
- select option select
- change/input event dispatch
- 反映後の軽い検証

やらないこと：

- save click
- publish click
- delete click

---

### 5.4 identity-checker.ts

現在開いている管理画面が、選択中の店舗と一致するか確認する。

確認対象：

- 店舗名
- 電話番号
- 住所
- 管理画面URL
- 外部店舗ID

一致しない場合、自動入力を停止する。

---

### 5.5 reporter.ts

実行結果、警告、DOMスナップショット、エラーをAPIへ送信する。

---

### 5.6 sanitizer.ts

送信前のDOMスナップショットから、機密情報や個人情報になりうる値を除去・マスクする。

---

## 6. manifest permissions

MVPで必要最小限の権限にする。

例：

```json
{
  "manifest_version": 3,
  "name": "Menu Sync Assistant",
  "version": "0.1.0",
  "permissions": ["storage", "activeTab", "scripting"],
  "host_permissions": [
    "https://*.hotpepper.jp/*",
    "https://*.tabelog.com/*",
    "https://*.gnavi.co.jp/*"
  ],
  "background": {
    "service_worker": "src/background/service-worker.js"
  },
  "content_scripts": [
    {
      "matches": ["https://*.hotpepper.jp/*", "https://*.tabelog.com/*"],
      "js": ["src/content/index.js"]
    }
  ]
}
```

---

## 7. 安全停止条件

以下の場合は入力を行わない。

- ユーザー未ログイン
- 店舗未選択
- 店舗識別不一致
- mapping JSON取得失敗
- required_extension_version未満
- required field missing
- minPageMatchScore未満
- critical DOM diffあり
- 未対応カテゴリあり
- auto_fill_enabled=false

---

## 8. 入力後のUI

入力完了後は、拡張機能UIに以下を表示する。

```txt
対象店舗
対象サイト
入力したメニュー数
スキップしたメニュー数
警告数
未対応カテゴリ
価格差分アラート
保存は手動で行う旨
```

---

## 9. Playwrightとの関係

Playwrightは本番の主操作ではなく、以下の用途で使用する。

- 開発時のDOM検証
- テスト自動化
- 管理画面モックに対するE2Eテスト
- selector候補の検証

本番運用はChrome拡張のcontent scriptを中心とする。
