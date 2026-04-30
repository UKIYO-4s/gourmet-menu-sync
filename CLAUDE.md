# CLAUDE.md

このリポジトリで作業する Claude Code への指示。

---

## プロジェクト概要

飲食店メニュー同期システム（Menu-sync-system）。
飲食店のメニュー情報を一元管理し、食べログ・ホットペッパー・ぐるなび・Googleビジネスプロフィール・自社サイト等へ Chrome 拡張経由で **入力補助** する。

- 仕様の正本: `docs/00_master-spec.md`
- 全体像: `docs/01_system-overview.md`
- MVP範囲: `docs/02_mvp-scope.md`

---

## 重要ルール（最優先）

1. **MVPでは外部サイトへの自動保存・自動公開を絶対に実装しない**（ADR-003）
   - `auto_fill_enabled = true`
   - `auto_submit_enabled = false`
2. 仕様確認前に実装を始めない。
3. 既存ドキュメントを明示の指示なく削除・上書きしない。
4. 設計判断は `decisions/` に ADR として残す。
5. 不明点は **TODO セクション** として該当ドキュメントに残す。
6. 生DOM全文 / Cookie / セッション / パスワード / hidden値 / 入力済みvalue を保存しない。
7. すべての変更は履歴を残す（メニュー / マッピング / DOM / 同期）。
8. 既存仕様（`docs/00_master-spec.md`）と矛盾する記述を生まない。

---

## 中心思想（5軸）

```txt
source   ：どのデータ元から取り込んだか
version  ：いつ・誰が更新したか
route    ：どこに同期するか
mapping  ：どの入力ルールで変換したか
log      ：何が起きたか
```

---

## ディレクトリ構成

```txt
docs/         設計ドキュメント（00_master-spec.md が正本）
tasks/        バックログとフェーズ別タスク
decisions/    ADR（Architecture Decision Records）
database/     DBスキーマ案 / ER図メモ
configs/
  mapping-samples/    サイト別 mapping JSON
  transform-rules/    値変換ルール
extension/    Chrome拡張（Phase 2 で実装開始）
api/          APIサーバー（Phase 2 で実装開始）
admin/        管理画面（Phase 2 で実装開始）
```

---

## MVP の安全ガード（必須）

```txt
- 自動入力までで停止 / 自動保存は禁止
- 店舗識別チェック必須（不一致なら入力しない）
- 差分プレビュー必須
- 低 match_score 時は停止
- 未対応カテゴリは停止
- 価格差分が大きい場合は停止
- DOM差分が critical なら停止
```

---

## 推奨スタック（暫定 / Phase 1 で確定）

- TypeScript
- Admin UI: Astro または React
- API: Cloudflare Workers または Node.js
- DB: Cloudflare D1 または PostgreSQL（未確定）
- Chrome Extension: Manifest V3
- テスト: Playwright も利用可（ただし本番運用は拡張機能 content scripts が主）

選定は `tasks/00_project-backlog.md` の「オープン論点」を参照。

---

## 出力スタイル

- 設計ドキュメントは Markdown
- マッピング・変換ルールは JSON
- DBスキーマは SQL
- 未確定事項は必ずファイル末尾に `## TODO` セクションを設ける
- 設計判断は `decisions/adr-XXX-*.md` に記録

---

## 参照すべき重要ドキュメント

| 用途 | ファイル |
|---|---|
| 仕様の正本 | `docs/00_master-spec.md` |
| 全体像 | `docs/01_system-overview.md` |
| MVP範囲 | `docs/02_mvp-scope.md` |
| DB | `docs/03_database-design.md` |
| Chrome拡張 | `docs/04_chrome-extension-design.md` |
| マッピングJSON | `docs/05_mapping-json-design.md` |
| 障害と対策 | `docs/08_failure-and-countermeasures.md` |
| バックログ | `tasks/00_project-backlog.md` |
