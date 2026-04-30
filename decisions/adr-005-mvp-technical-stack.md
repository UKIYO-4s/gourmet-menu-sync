# ADR-005: MVP Phase 0 の仮技術スタックを固定する

- Status: Accepted (Provisional)
- Date: 2026-04-30
- 関連: `docs/21_technical-stack-decision.md`, `docs/22_implementation-issue-breakdown.md`, `docs/23_mvp-implementation-readiness-check.md`, `database/schema-draft.sql`, `database/erd-notes.md`

---

## Context

Menu Sync System はMVP Phase 0開始前の段階にあり、実装基盤を作るにはDB・API・管理画面・hosting・loggingの仮決定が必要である。

`docs/23_mvp-implementation-readiness-check.md` では、現時点の総合判定を `Conditional GO` としている。外部サイト実接続とChrome拡張MVP実接続はHOLDだが、CSV import、Internal Menu Admin、Common Menu Model API、Category Mapping UI/API、Sync Preview、Sync Job Logs、Audit Logs、Error Handling / Safe Logging、Rollback Preview は内部MVPとして実装開始可能である。

`docs/21_technical-stack-decision.md` では、MVP初期の第一候補を `Cloudflare Pages + Astro + Cloudflare Workers + Hono + Cloudflare D1` としている。ただし、認証/権限管理が重くなる場合は `Supabase Auth + PostgreSQL` 案も比較対象に残している。

`database/schema-draft.sql` はPostgreSQL寄りの論理DDLである。D1を採用する場合は、JSONB、UUID、enum、timestamp、default制約、CHECK制約、外部キー制約の扱いをD1/SQLite向けに調整する必要がある。

MVPでは以下を引き続き守る。

- 外部サイト管理画面の解析はしない
- Chrome拡張MVP実接続はまだしない
- 自動保存 / 自動公開 / 自動削除はしない
- `auto_submit_enabled=false` を維持する
- Cookie / Session / Token / 生DOM / input value は扱わない
- 認証情報、外部サイトログイン情報、外部サイト管理画面スクリーンショットは保存しない

---

## Decision

MVP Phase 0開始前の仮技術スタックとして、Cloudflare中心構成を採用する。

この決定はPhase 0開始のための仮固定であり、本番認証方式、外部サイト実接続、Chrome拡張実接続、自動保存/自動公開/自動削除の解禁を意味しない。

---

## 採用する仮技術スタック

| 領域 | 仮採用 |
|---|---|
| DB | Cloudflare D1 |
| API | Cloudflare Workers + Hono |
| 管理画面 | Astro + React islands 必要箇所のみ |
| Hosting | Cloudflare Pages |
| Chrome拡張 | Manifest V3。ただし実接続はHOLD |
| Logging | DB logs + devlog。SentryはPhase後送り |

補足:

- DB logs は `sync_job_logs`、`audit_logs`、必要に応じたsafe error log候補を指す
- devlogには技術判断、STOP/HOLD検出、復旧方針を残す
- Sentryを導入する場合は、保存禁止情報のscrub方針を先に決める
- React islands はCSV preview、menu item edit、category mapping、sync previewなど状態管理が必要な画面に限定する

---

## 認証方式の扱い

MVP初期は本番認証方式を固定しない。

Phase 0では認証境界を抽象化し、APIとAdmin UIが後から認証providerを差し替えられるようにする。

候補として残すもの:

- Cloudflare Access
- Supabase Auth
- Clerk

方針:

- 独自認証は避ける
- Phase 0では `authenticated user`、`organization membership`、`store permission`、`role permission` を受け取る境界を作る
- Phase 2開始前に本番認証方式を確定する
- 認証情報、Cookie、Session、TokenはアプリDBやログへ保存しない

---

## D1採用時の注意

`database/schema-draft.sql` はPostgreSQL寄りの論理DDLである。

D1採用時は以下を前提にする。

| PostgreSQL寄り要素 | D1向け調整 |
|---|---|
| `JSONB` | `TEXT` に保存し、アプリケーション側でJSON validationする |
| UUID | `TEXT` IDとして扱い、生成責務をAPI側に寄せる |
| enum / CHECK | D1で表現できる範囲はDB制約、複雑なものはAPI validationで補完する |
| `TIMESTAMPTZ` | ISO8601 `TEXT` として扱う |
| `BOOLEAN` | `INTEGER` 0/1 として扱う |
| `DEFAULT now()` | API側またはD1互換のdefaultへ調整する |
| PostgreSQL固有構文 | D1/SQLite互換のmigrationへ変換する |

本番前に再確認すること:

- migration管理方式
- local / preview / production のD1環境分離
- seed / fixture の扱い
- schema変更時のrollback方針
- PostgreSQLへ移行する場合の互換性
- `auto_submit_enabled=false` のDB/API両方での強制
- 保存禁止情報をDBに入れないvalidation

---

## Consequences

### Pros

- Cloudflare Pages / Workers / D1 に寄せることで、MVP初期の運用境界を小さくできる
- Astroで管理画面MVPを軽く開始できる
- Workers + HonoでREST API境界を薄く作れる
- Chrome拡張MVPから将来APIやremote JSON mappingを取得しやすい
- 外部サイト解析HOLD中でも内部MVPを進められる
- 個人または小規模チームでの保守負荷を抑えやすい

### Cons

- `schema-draft.sql` をそのまま使えず、D1向け変換が必要
- PostgreSQLのJSONB、enum、timestamp、制約に依存した設計はAPI validationで補完が必要
- 認証方式をPhase 0で固定しないため、認証境界の抽象化が必要
- Cloudflare D1からPostgreSQLへ移行する場合、型とmigrationの再整理が必要
- SentryをPhase後送りにするため、初期の技術例外監視はDB logs/devlog/provider logs中心になる

### Risks

- D1の制約差分により、DBで守るべきvalidationがAPI側へ漏れる
- 認証方式未確定のまま実装が進むと、後でUI/API境界の修正が大きくなる
- React islandsの範囲が膨らむと、Astro採用の軽さが薄れる
- logging設計が曖昧なままだと、`sync_job_logs`、`audit_logs`、error log候補の責務が混ざる
- 保存禁止情報のscrub方針が未実装だと、ログやdevlogに危険な情報が混入する

### Mitigations

- Phase 0でD1向けschema変換ルールを文書化する
- Phase 1でDB制約とAPI validationの責務分担を明確にする
- Phase 0では認証provider依存を直接UI/APIに埋め込まず、user context境界を作る
- Phase 2開始前に本番認証方式を確定する
- React islandsは状態管理が必要な画面に限定する
- `sync_job_logs` は技術ログ、`audit_logs` はユーザー操作監査として分ける
- devlog、DB logs、error responseのすべてでCookie / Session / Token / 生DOM / input valueを記録しない

---

## まだ決めないこと

以下はこのADRでは決めない。

- 外部サイト実接続
- Chrome拡張実接続
- 自動保存 / 自動公開 / 自動削除
- 本番認証方式
- Sentry導入
- Hotpepper / 食べログ / ぐるなび実画面解析
- 外部サイトカテゴリ取得方式
- DOM差分閾値
- mapping JSON publish workflow

---

## Phase 0で確認すること

Phase 0で確認すること。

1. Cloudflare D1で開始する前提に問題がないか
2. D1向けschema変換ルールをどう管理するか
3. Workers + Honoのrouting構成
4. Astro + React islandsの画面構成
5. Cloudflare Pagesのpreview / production分離
6. 認証境界の抽象化方法
7. Cloudflare Access / Supabase Auth / Clerk の比較観点
8. `sync_job_logs` / `audit_logs` / error log候補の責務分担
9. devlog更新ルール
10. 保存禁止情報を扱わないlint/check/review観点
11. `auto_submit_enabled=false` のDB/API/UIでの表示・強制方法
12. Sentry導入をPhase後送りにして問題ないか

---

## Related Files

- `docs/21_technical-stack-decision.md`
- `docs/22_implementation-issue-breakdown.md`
- `docs/23_mvp-implementation-readiness-check.md`
- `database/schema-draft.sql`
- `database/erd-notes.md`
- `decisions/adr-003-no-auto-submit-in-mvp.md`
