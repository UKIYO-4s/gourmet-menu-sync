# Menu Sync System

飲食店のメニュー情報を一元管理し、食べログ・ホットペッパー・ぐるなび・自社サイトなどへ反映するためのメニュー同期支援システム。

## 目的

- 店舗ごとのメニュー正本を管理する
- メニュー更新履歴を残す
- Chrome拡張で外部サイト管理画面への入力を補助する
- DOM変更を検知する
- 店舗別カテゴリ・マッピングを学習する
- 初期は自動保存せず、人間確認を必須にする

## 設計思想

- source
- version
- route
- mapping
- log

## MVP方針

初期MVPでは、外部サイトへの自動保存は行わない。
Chrome拡張は入力補助までとし、保存・公開は人間が行う。

## 主要ドキュメント

- docs/00_master-spec.md
- docs/02_mvp-scope.md
- docs/03_database-design.md
- docs/04_chrome-extension-design.md
- docs/08_failure-and-countermeasures.md

## Phase 0 Skeleton

MVP実装に向けたモノレポの最小骨組み。

```txt
apps/
  admin/   Astro + React islands 必要箇所のみ
  api/     Cloudflare Workers + Hono
packages/
  shared/  共通型・定数
  config/  共通 TypeScript 設定
database/
  migrations/  Cloudflare D1 migration 置き場
scripts/       開発補助script置き場
```

### 起動方法

依存関係を入れてから各コマンドを実行する。

```sh
pnpm install
pnpm dev
pnpm build
pnpm typecheck
pnpm lint
pnpm test
```

個別実行:

```sh
pnpm --filter @menusync/admin dev
pnpm --filter @menusync/api dev
```

DB migration / seed コマンド:

```sh
pnpm db:migrate
pnpm db:seed
```

### まだ未実装の範囲

- CSV import の実処理
- Internal Menu Admin の画面・API
- Common Menu Model API
- Category Mapping UI/API
- Sync Preview / Sync Job Logs
- Audit Logs
- Error Handling / Safe Logging
- Rollback Preview
- 本番認証方式
- 本番D1 migration

### 安全制約

- 外部サイト管理画面の解析はしない
- Chrome拡張MVP実接続はしない
- 自動保存 / 自動公開 / 自動削除はしない
- `auto_submit_enabled=false` を維持する
- Cookie / Session / Token / 生DOM / outerHTML / input value は扱わない
- 実データ、認証情報、外部サイト認証情報は保存しない
