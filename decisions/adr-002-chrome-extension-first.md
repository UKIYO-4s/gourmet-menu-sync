# ADR-002: 外部サイト連携は Chrome 拡張を一次手段とする

- Status: Accepted
- Date: 2026-04-30
- 関連: `docs/00_master-spec.md` 第5.3章, `docs/04_chrome-extension-design.md`

---

## Context

外部グルメサイト（食べログ・ホットペッパー・ぐるなび等）には、メニュー編集用の公開 API が原則存在しない。
連携手段の候補は次の3つ：

1. サーバーサイドでのヘッドレスブラウザ運用（Playwright 等）
2. Chrome 拡張による content scripts 経由の入力補助
3. 公式パートナーAPI（多くのサイトで利用不可）

サーバーサイドでの自動操作は、認証情報の保管・規約抵触・Bot 判定リスクが高い。

## Decision

MVP 以降の主要連携手段は **Chrome 拡張**（Manifest V3, content scripts）とする。
Playwright 等のサーバーサイド自動化は **テスト用途に限定** し、本番運用では使わない。

理由：

- ユーザーが既にログイン済みの管理画面で動作するため認証情報を保存しなくてよい
- ユーザー操作の延長線上での動作になり、規約抵触リスクが下がる
- 拡張機能側で **保存ボタンを押さない** ことで、誤公開を構造的に防げる
- 即時更新が必要な部分は mapping JSON として API 配信、本体ロジックは Chrome Web Store 経由で配布、と分離できる

## Consequences

### Positive

- 認証情報・Cookie・セッションをサーバーで保持しなくてよい
- 規約抵触リスクが大幅に低い
- ユーザーが「自分の画面」で操作している実感を保てる

### Negative

- Chrome Web Store の審査サイクルに依存する（mapping JSON 分離で緩和）
- ユーザー環境（拡張機能のバージョン）に動作が左右される
- iframe・SPA・遅延読み込み等の DOM の癖に対処する必要がある

## Alternatives Considered

- サーバーサイドのヘッドレスブラウザ → 規約・Bot判定・認証保管リスクで却下
- 公式パートナーAPI → 利用不可サイトが多く、現時点では選択肢にならない
