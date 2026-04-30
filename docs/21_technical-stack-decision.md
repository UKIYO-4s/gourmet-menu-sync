# Technical Stack Decision

## 1. 技術選定の目的

このドキュメントは、Menu Sync System のMVP実装に向けて、DB・API・管理画面・認証・Chrome拡張・ホスティング・ログ/監視の技術スタック候補を比較し、初期推奨構成を決めるためのものである。

この文書は比較と初期判断に留める。実装コード、実装ディレクトリ、外部サイト管理画面解析は作らない。

---

## 2. MVPの前提

現時点のMVP前提。

- 外部サイト解析HOLD
- Chrome拡張MVP実接続HOLD
- 自動保存 / 自動公開 / 自動削除STOP
- `auto_submit_enabled=false` 維持
- Cookie / Session / Token / 生DOM / input value は扱わない
- まずはCSV import / Internal Menu Admin / Sync Preview / Logs を作る
- `database/schema-draft.sql` はPostgreSQL寄りの論理DDLである
- D1採用時は `JSONB -> TEXT JSON`、`TIMESTAMPTZ -> TEXT`、`BOOLEAN -> INTEGER` の変換を前提にする

---

## 3. DB候補

| 候補 | 概要 | 向いている点 | 注意点 |
|---|---|---|---|
| PostgreSQL | 標準的なRDB。現行DDLと相性がよい | JSONB、制約、履歴、監査ログを素直に扱える | ホスティング、運用、バックアップを別途決める必要がある |
| Cloudflare D1 | Cloudflare Workers / Pagesと統合しやすいSQLite系serverless DB | 小規模MVP、低運用、Cloudflare完結に向く | 現行DDLの `JSONB` / `TIMESTAMPTZ` / `BOOLEAN` / JSON path制約は変換が必要 |
| Supabase PostgreSQL | Auth / Postgres / Storage / Edge FunctionsがまとまったBaaS | 認証・権限・Postgresをまとめて進めやすい | Cloudflare中心構成よりサービス境界が増える |
| Neon PostgreSQL | Serverless Postgres | 現行DDLとの相性、branching、Postgres互換性 | 認証や管理画面hostingは別途組み合わせる |

初期評価:

- DB仕様を優先するなら PostgreSQL / Supabase / Neon
- 運用コストとCloudflare完結を優先するなら D1
- 現行DDLをそのまま活かすなら PostgreSQL系
- MVPの軽さを優先するなら D1

---

## 4. API候補

| 候補 | 概要 | Pros | Cons |
|---|---|---|---|
| Cloudflare Workers | Edge上のserverless実行環境 | D1 / Pagesとの統合、低運用、Chrome拡張から呼びやすい | Node.js互換前提のライブラリは注意 |
| Hono | Workers等で動く軽量Web framework | REST APIを薄く実装しやすい、型を持たせやすい | 大規模フルスタック機能はNext.jsほど多くない |
| Next.js API Routes | Next.js内でAPIを持てる | UI/API一体で開発しやすい | Cloudflare Workers/D1中心構成とは分離判断が必要 |
| Node.js/Express | 一般的なNode API | 学習コストが低く、ライブラリが豊富 | サーバ運用または別hostingが必要 |

初期評価:

- Cloudflare構成なら Workers + Hono が自然
- Supabase + Next.js案なら Next.js Route Handlers / API Routes が自然
- Expressは汎用だが、MVPの低運用方針とはややズレる

---

## 5. 管理画面候補

| 候補 | 概要 | Pros | Cons |
|---|---|---|---|
| Astro | 静的/軽量サイトに強いWeb framework | 管理画面MVPを軽く作れる、Cloudflare Pagesと相性がよい | 複雑な状態管理はReact island等を併用する |
| Next.js | フルスタックReact framework | 認証、管理画面、APIを一体化しやすい | MVPが重くなりやすい |
| React SPA | Vite等で作るSPA | UIだけに集中しやすい、API分離が明確 | 認証、ルーティング、SEO不要画面でも基盤設計が必要 |

初期評価:

- Cloudflare Pages + Workers + D1なら Astro が第一候補
- Supabase Auth + PostgreSQLなら Next.js も有力
- React SPAは将来的に複雑な管理画面へ寄せる場合の候補

---

## 6. 認証候補

| 候補 | 概要 | Pros | Cons |
|---|---|---|---|
| Supabase Auth | Supabaseの認証基盤 | Postgres / RLS / Authをまとめやすい | D1中心構成ではDBとAuthが分かれる |
| Clerk | 認証・ユーザー管理SaaS | 組織管理やUI部品が強い | 外部SaaS依存とコスト確認が必要 |
| Auth.js | Web認証ライブラリ | 自前DBや複数providerと組み合わせやすい | 実装責務が増える |
| 独自認証 | 自前で実装 | 自由度は高い | MVPでは避ける。セキュリティ・運用負荷が高い |

方針:

- 独自認証は避ける
- owner / admin / operator / viewer の認可はアプリDB側で管理する
- 認証providerは、DB構成と管理画面構成を決めた後に確定する
- 認証情報、Cookie、Session、Tokenをアプリログへ保存しない

---

## 7. Chrome拡張MVP候補

Chrome拡張MVPはHOLD中だが、技術前提は以下にする。

| 要素 | 方針 |
|---|---|
| Manifest | Manifest V3 |
| DOM連携 | content script |
| Background処理 | service worker |
| mapping取得 | remote JSON mapping取得 |
| API接続 | Admin Web/APIと同じ認証基盤 |
| 保存禁止 | Cookie / Session / Token / 生DOM / input value は送信しない |
| 自動操作 | 保存 / 公開 / 削除は自動実行しない |

HOLD理由:

- Hotpepper / 食べログ / ぐるなびの実画面検証待ち
- DOM差分閾値、store identity、category取得方式が未確定

---

## 8. ホスティング候補

| 候補 | 向いている構成 | Pros | Cons |
|---|---|---|---|
| Cloudflare Pages | Astro / React / Workers / D1 | Cloudflare Workers/D1との一体運用、preview deploy | Authを別途決める必要がある |
| Vercel | Next.js | Next.jsとの相性がよい | D1/Workers中心構成とは分離する |
| Supabase | Supabase Auth / PostgreSQL / Edge Functions | DB/Authをまとめやすい | 管理画面hostingは別途選ぶことが多い |

初期評価:

- Cloudflare構成なら Cloudflare Pages
- Supabase + Next.jsなら VercelまたはCloudflare Pagesのどちらかを比較
- Supabase単体はDB/Auth基盤として使い、UI hostingは別にする想定

---

## 9. ログ/監視候補

| 候補 | 用途 | Pros | Cons |
|---|---|---|---|
| DB logs | `sync_job_logs` / `audit_logs` / `guardrail_events` | MVP設計と直結、監査しやすい | アプリ例外監視には不足 |
| Cloudflare Logs | Workers / Pages運用ログ | Cloudflare構成と相性がよい | アプリ監査ログとは分離が必要 |
| Supabase logs | Supabase API / DB / Auth周辺 | Supabase構成なら見やすい | Cloudflare中心構成では分散する |
| Sentry | アプリ例外監視 | trace / error調査に強い | 保存禁止情報のscrub設定が必須 |

MVP方針:

- 業務監査: DB logs
- 技術例外: hosting provider logs + Sentry候補
- エラーログにも保存禁止情報を残さない
- `request_id` / `trace_id` の発行方式は実装前に決める

---

## 10. 比較観点

| 観点 | 重視理由 |
|---|---|
| 開発速度 | MVPではCSV import / Admin UI / Sync Previewを早く形にする必要がある |
| 運用コスト | 小規模運用から始める前提 |
| 権限管理 | owner / admin / operator / viewer、organization / store scopeが重要 |
| DB移行しやすさ | D1採用時も将来PostgreSQLへ戻せる余地を残す |
| Chrome拡張との相性 | 拡張からAPI / mapping JSONを安全に取得する |
| 将来の横展開 | 複数店舗、複数外部サイト、複数organizationに拡張する |
| 個人/小規模チームでの保守性 | 運用負荷と認知負荷を抑える |

---

## 11. 推奨構成案

### 案A: Cloudflare Pages + Workers + D1 + Astro

```txt
Admin UI: Astro on Cloudflare Pages
API: Cloudflare Workers + Hono
DB: Cloudflare D1
Auth: Supabase Auth / Clerk / Auth.js のいずれかを別途比較
Logs: DB logs + Cloudflare Logs + Sentry候補
```

### 案B: Supabase + Next.js

```txt
Admin UI: Next.js
API: Next.js Route Handlers / API Routes
DB: Supabase PostgreSQL
Auth: Supabase Auth
Hosting: Vercel or Cloudflare Pages
Logs: DB logs + Supabase logs + Sentry候補
```

### 案C: Neon PostgreSQL + Hono + Astro

```txt
Admin UI: Astro
API: Hono on Cloudflare Workers or Node runtime
DB: Neon PostgreSQL
Auth: Clerk / Auth.js / Supabase Authを比較
Hosting: Cloudflare Pages
Logs: DB logs + platform logs + Sentry候補
```

---

## 12. 各案のPros/Cons

| 案 | Pros | Cons |
|---|---|---|
| 案A | Cloudflareに寄せて低運用。Pages / Workers / D1の接続が単純。Astroで軽い管理画面を作れる | D1向けにDDL変換が必要。認証/権限管理を別途慎重に設計する必要がある |
| 案B | Supabase Auth + PostgreSQLで認証とDBがまとまる。現行DDLと相性がよい | Next.js中心になりMVPが重くなりやすい。Cloudflare Workers/D1構成とは別路線 |
| 案C | PostgreSQL互換を維持しつつCloudflare Pages/Astroを使える。DB移行負荷が少ない | Auth、API hosting、DBの境界が増え、初期構成がやや複雑 |

---

## 13. 初期推奨

初期推奨は案A。

```txt
Cloudflare Pages + Astro + Cloudflare Workers + Hono + Cloudflare D1
```

ただし、認証/権限管理が重くなる場合は、案Bの `Supabase Auth + Supabase PostgreSQL + Next.js` を比較対象として残す。

---

## 14. なぜその構成を選ぶか

案Aを第一候補にする理由。

- MVPでまず作る範囲が、CSV import、Internal Menu Admin、Sync Preview、Logsであり、重いサーバ運用を避けたい
- Cloudflare Pages / Workers / D1 に寄せるとhostingとAPIとDBの運用境界が少ない
- Astroは管理画面MVPを軽く始めやすい
- Chrome拡張MVPからWorkers API / mapping JSONを取得しやすい
- D1は小規模・店舗単位のMVPに向く
- 外部サイト解析HOLD中でも内部機能を進められる

D1採用時の前提:

- `JSONB` は `TEXT` に置換し、アプリケーション側でJSON validationを強制する
- `TIMESTAMPTZ` は ISO8601 `TEXT` に置換する
- `BOOLEAN` は `INTEGER` 0/1 に置換する
- JSON pathを使うDB制約は、API validationとmapping publish前validationで補完する
- PostgreSQL移行を見越し、SQLとschema命名はPostgreSQL互換を意識する

---

## 15. 採用しないものと理由

| 採用しないもの | 理由 |
|---|---|
| 独自認証 | MVPでは避ける。セキュリティ・運用負荷が高い |
| Node.js/Express単独サーバ | 運用境界が増え、Cloudflare中心MVPの低運用方針とズレる |
| React SPA単独 | API / auth / routing / hostingを個別に組む必要があり、初期判断が増える |
| PostgreSQL自前運用 | MVPではDB運用負荷を避ける |
| 外部サイト解析先行 | 現在HOLD。内部MVPを先に固める |
| 自動保存 / 自動公開 / 自動削除機能 | MVPではSTOP |

---

## 16. 実装前に決めること

実装前に決めること。

1. DBをD1で始めるか、Supabase PostgreSQLで始めるか
2. 認証をSupabase Auth / Clerk / Auth.jsのどれにするか
3. owner / admin / operator / viewer の認可実装方式
4. organization / store scope検査の共通middleware設計
5. `request_id` / `trace_id` の発行方式
6. `error_logs` 独立テーブルを作るか
7. CSV import session / batch / import job のDB方針
8. sync job target itemsを正規化するか
9. D1採用時のschema変換ルール
10. local development / preview / production の環境分離

---

## 17. Phase後送り

Phase後送り。

- Chrome拡張MVP実接続
- Hotpepper / 食べログ / ぐるなび実画面解析
- DOM差分閾値の実測
- 外部サイトカテゴリ取得実装
- category mapping versions
- store mapping overrides
- 複数店舗一括同期
- Slack / メール通知
- 高度な監視基盤
- 自動保存 / 自動公開の限定解禁検討
- PostgreSQLへの移行またはD1からの移行検証

---

## 18. TODO

- [ ] 案Aで進めるか最終決定する
- [ ] 認証方式を選ぶ
- [ ] D1向けschema変換ルールを別ドキュメント化する
- [ ] D1で不足する制約をAPI validationで補完する一覧を作る
- [ ] API frameworkとしてHonoを採用するか決める
- [ ] 管理画面をAstroで始めるか決める
- [ ] `error_logs` テーブル要否を決める
- [ ] `request_id` / `trace_id` の仕様を決める
- [ ] hosting preview環境の運用を決める
- [ ] Sentry導入時のPII scrub設定方針を決める

---

## 19. 参考情報

- Cloudflare D1: serverless SQL database with SQLite semantics and Workers / Pages integration
- Cloudflare Pages: full-stack deployment platform with Pages Functions and Workers integration
- Hono: lightweight framework commonly used with Cloudflare Workers
- Supabase: Postgres, Auth, Storage, Realtime, Edge Functions
- Neon: serverless Postgres
- Next.js API Routes / Route Handlers: Next.js内でAPIを構成する選択肢
- Astro on Cloudflare: AstroをCloudflare Pages / Workersへdeployする選択肢
