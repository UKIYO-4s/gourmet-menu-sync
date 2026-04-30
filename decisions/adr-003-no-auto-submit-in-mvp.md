# ADR-003: MVPでは自動保存・自動公開を行わない

- Status: Accepted
- Date: 2026-04-30
- 関連: `docs/00_master-spec.md` 第3.1章 / 第16章, `docs/02_mvp-scope.md`, `docs/04_chrome-extension-design.md`

---

## Context

外部グルメサイトの管理画面は、DOM変更・ボタン文言変更・確認画面追加・公開フローの差異などが発生する可能性が高い。
また、外部サイトの利用規約・Bot 判定リスクもある。
誤公開・誤保存のインパクトは事業的に大きい（誤価格掲載・別店舗への上書き等）。

## Decision

MVP では **自動入力までで停止** し、保存・公開は人間が実行する。

```txt
auto_fill_enabled  = true
auto_submit_enabled = false   # MVPでは true にしない
```

mapping JSON 側でも `submit.autoSubmit: false` を強制する。

## Consequences

### Positive

- 誤公開リスクを構造的に下げられる
- 利用規約・Bot 判定リスクを下げられる
- 価格・カテゴリ・店舗の誤りを保存前に確認できる
- 初期導入時のユーザー心理的ハードルを下げられる

### Negative

- 完全自動化ではない（保存操作が人間に残る）
- 大量更新時の作業量は減らない

## Alternatives Considered

- MVP から自動保存を解禁する → 誤公開リスクが大きすぎるため却下
- サイトごとに段階的に自動保存を解禁する → Phase 5 以降で再検討（`docs/10_development-roadmap.md`）

## Notes

- 拡張機能・API・mapping JSON の各層でこのポリシーを多重に強制する
- Phase 5 で限定解禁を検討する場合は本 ADR を Superseded として更新する
