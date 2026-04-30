# MVP Implementation Readiness Check

## 1. readiness check の目的

このドキュメントは、Menu Sync System のMVP実装を開始してよいかを判断するためのチェックリストである。

設計・安全制約・技術選定・Issue分解・未決事項を確認し、外部サイト解析待ちでも進められる範囲と、まだ開始してはいけない範囲を分離する。

この文書はチェックリスト作成に留める。実装コード、実装ディレクトリ、外部サイト管理画面解析は作らない。

参照元:

- `docs/09_security-policy.md`
- `docs/10_development-roadmap.md`
- `docs/19_design-consistency-check.md`
- `docs/20_mvp-freeze-and-open-issues.md`
- `docs/21_technical-stack-decision.md`
- `docs/22_implementation-issue-breakdown.md`
- `database/schema-draft.sql`
- `database/erd-notes.md`

---

## 2. 実装開始前提

実装開始前提。

- 判定は現時点では `Conditional GO`
- 外部サイト実接続はHOLD
- Chrome拡張MVP実接続はHOLD
- 自動保存 / 自動公開 / 自動削除はSTOP
- `auto_submit_enabled=false` を維持する
- Cookie / Session / Token / 生DOM / input value は扱わない
- 認証情報、外部サイトログイン情報、外部サイト管理画面スクリーンショットは保存しない
- まずは内部MVPを実装対象にする
- Phase 0開始前にDBエンジン・認証方式・API技術・管理画面技術を仮決定する

Conditional GO の理由:

- CSV import / Internal Menu Admin / Common Menu Model API / Sync Preview は外部サイト実接続なしで実装開始可能
- Category Mapping UI/APIは手動mappingと未設定時停止の範囲なら開始可能
- Sync Job Logs / Audit Logs / Error Handling / Safe Logging は内部運用基盤として開始可能
- 外部サイト実接続、Chrome拡張MVP実接続、自動保存/自動公開/自動削除は引き続きHOLDまたはSTOP

---

## 3. 実装開始してよい範囲

実装開始してよい範囲。

| 領域 | 判定 | 条件 |
|---|---|---|
| CSV import | GO | preview / validation / commitを分離する |
| Internal Menu Admin | GO | status管理、versioning、audit logを守る |
| Common Menu Model API | GO | CSV/Admin入力を共通形式へ変換する |
| Category Mapping UI/API | GO with HOLD | 手動mappingと未設定停止まで。外部サイトカテゴリ取得方式はHOLD |
| Sync Preview | GO with HOLD | 外部サイト反映候補と停止理由表示まで |
| Sync Job Logs | GO | 反映候補jobとevent/log記録まで |
| Audit Logs | GO | ユーザー操作、承認、停止確認を記録する |
| Error Handling / Safe Logging | GO | 保存禁止情報を含まないsafe error/logを作る |
| Rollback Preview | GO | 既存version上書きではなく新version作成方針でpreviewする |

---

## 4. 実装開始してはいけない範囲

実装開始してはいけない範囲。

| 領域 | 判定 | 理由 |
|---|---|---|
| 外部サイト実接続 | HOLD | 実画面解析待ち |
| Chrome拡張MVP実接続 | HOLD | 外部サイト解析とmapping実測待ち |
| 自動保存 | STOP | MVPでは外部サイト保存操作を自動実行しない |
| 自動公開 | STOP | MVPでは外部サイト公開操作を自動実行しない |
| 自動削除 | STOP | MVPでは外部サイト削除操作を自動実行しない |
| 認証情報保存 | STOP | セキュリティ方針で禁止 |
| Cookie / Session / Token保存 | STOP | 保存禁止情報 |
| 生DOM保存 | STOP | 保存禁止情報 |
| input value保存 | STOP | 保存禁止情報 |

---

## 5. 必須チェック項目

実装開始前に確認する必須チェック。

| チェック | 判定 | 確認内容 |
|---|---|---|
| git status clean | required | 実装開始前に未コミット差分がない |
| `docs/11`〜`docs/22` が存在する | required | 設計、freeze、技術選定、Issue分解が揃っている |
| `database/schema-draft.sql` が存在する | required | DB設計の参照元がある |
| `database/erd-notes.md` が存在する | required | ERD補足が参照できる |
| `auto_submit_enabled=false` が維持されている | required | trueを許可しない |
| STOP事項が残っていない | required | 自動保存/自動公開/自動削除や保存禁止情報保存が設計に入っていない |
| HOLD事項が明確に分離されている | required | 外部サイト実接続、Chrome拡張実接続、DOM差分実測が分離されている |
| 実装Phase 0 のIssueが定義済み | required | Repo / tooling setupのIssueが定義されている |

チェック結果記入欄:

| 項目 | OK / NG | メモ |
|---|---|---|
| git status clean |  |  |
| docs/11〜22 |  |  |
| schema-draft.sql |  |  |
| erd-notes.md |  |  |
| auto_submit_enabled=false |  |  |
| STOP事項なし |  |  |
| HOLD事項分離 |  |  |
| Phase 0 Issue定義 |  |  |

---

## 6. 未決事項チェック

Phase 0開始前に仮決定が必要な未決事項。

| 未決事項 | 現状 | Phase 0開始条件 |
|---|---|---|
| DBエンジン | `Cloudflare D1` 第一候補、PostgreSQL系も比較対象 | D1で開始するか、Supabase PostgreSQL等へ寄せるか仮決定する |
| 認証方式 | Supabase Auth / Clerk / Auth.js候補 | 独自認証を避け、MVPの仮providerを決める |
| API技術 | Workers + Hono 第一候補 | Workers + Honoで開始するか仮決定する |
| 管理画面技術 | Astro 第一候補 | Astroで開始するか仮決定する |
| `error_logs` 独立テーブル有無 | OPEN | 独立テーブル化または `sync_job_logs` / `audit_logs` 集約を仮決定する |
| category mapping未設定時のCSV commit方針 | 推奨はcommit可、sync停止 | 推奨案BをMVP方針として仮確定する |

推奨仮決定:

```txt
DB: Cloudflare D1
API: Cloudflare Workers + Hono
Admin UI: Astro on Cloudflare Pages
Auth: Phase 0でSupabase Auth / Clerk / Auth.jsを比較し、Phase 2前に確定
category mapping未設定時: CSV commit可、sync preview / sync job作成は停止
```

---

## 7. GO / HOLD / STOP 判定基準

判定基準。

| 判定 | 意味 | 進め方 |
|---|---|---|
| GO | 設計・安全制約・依存関係が揃っている | 実装Issueへ進める |
| Conditional GO | 開始可能だが、Phase開始前に仮決定または限定条件が必要 | 条件を記録してPhase 0から開始する |
| HOLD | 外部検証や未決事項待ち | 実装せず、UI/APIでは停止理由として扱う |
| STOP | MVPで禁止 | 実装しない。必要になったら設計見直し |

現時点の総合判定:

```txt
Conditional GO
```

理由:

- 内部MVPは設計とIssue分解が揃っている
- 外部サイト実接続はHOLDで分離されている
- 自動保存/自動公開/自動削除はSTOPとして明確
- Phase 0開始前にDBエンジン・認証方式・API技術・管理画面技術の仮決定が必要

---

## 8. Phase 0開始条件

Phase 0を開始する条件。

1. `git status --short` がcleanである
2. `docs/11`〜`docs/23` が存在する
3. `database/schema-draft.sql` が存在する
4. `database/erd-notes.md` が存在する
5. DBエンジンを仮決定している
6. API技術を仮決定している
7. 管理画面技術を仮決定している
8. 認証方式の候補と確定タイミングが決まっている
9. `auto_submit_enabled=false` の維持を実装制約として扱う
10. HOLD/STOP範囲を実装Issueから除外している

---

## 9. Phase 0で作るもの

Phase 0で作るもの。

- Admin UIの最小project skeleton
- Workers APIの最小skeleton
- Hono routingの最小構造
- D1 local schema検証の土台
- test / lint / format commandの土台
- local / preview / production環境分離方針
- safe error envelopeの最小方針
- devlog更新運用

Phase 0のDone:

- 実装基盤が起動または検証できる
- 実装ディレクトリ構成が説明できる
- D1採用時のschema変換作業へ進める
- 保存禁止情報を扱わない前提がREADMEまたはdevlogに記録されている

---

## 10. Phase 0で作らないもの

Phase 0で作らないもの。

- 外部サイト実接続
- Chrome拡張MVP実接続
- Hotpepper / 食べログ / ぐるなび実画面解析
- 外部サイト保存/公開/削除操作
- 外部サイト認証情報保存
- Cookie / Session / Token保存
- 生DOM / outerHTML保存
- input value / hidden value保存
- 実データCSVの本番投入
- sync jobの外部サイト実行
- rollback実行機能

---

## 11. 実装中に必ず残すログ

実装中に必ず残すログ。

| ログ | 内容 | 方針 |
|---|---|---|
| devlog | 日次の作業内容、判断、未決事項、STOP/HOLD検出 | 保存禁止情報を記録しない |
| commit log | 実装単位、設計変更、schema変更 | 1コミット1目的を基本にする |
| issue progress | Issue状態、依存関係、Done確認 | Phase/Issue単位で進捗を残す |

devlogに残すべき内容:

- 採用した技術判断
- schema変換判断
- auth/provider判断
- HOLD/STOPに該当する検出
- エラーと復旧方針
- 次回作業の入口

devlogに残してはいけない内容:

- 認証情報
- Cookie / Session / Token
- 生DOM / outerHTML
- input value
- 個人情報や自由入力欄の全文
- 外部サイト管理画面スクリーンショット

---

## 12. 実装中にエラーが起きた場合の扱い

実装中にエラーが起きた場合の扱い。

1. エラーを隠さず記録する
2. 不明な状態では処理を進めない
3. 自動リトライはMVPでは原則入れない
4. 原因を確認してから手動再実行する
5. 保存禁止情報が混入した可能性がある場合はcritical扱いで停止する
6. organization / store scope不一致は停止する
7. category mapping未設定はsync preview / sync job作成を停止する
8. rollback対象versionが特定できない場合は停止する
9. `auto_submit_enabled=true` が検出された場合は停止する
10. エラーログにもCookie / Session / Token / 生DOM / input valueを残さない

記録先:

- 開発中の作業判断: devlog
- API/業務操作: audit_logs候補
- sync関連event: sync_job_logs候補
- 技術例外: safe error log候補

---

## 13. 次アクション

次アクション。

1. このreadiness checkをレビューする
2. `git status --short` がcleanであることを確認する
3. DBエンジンを仮決定する
4. API技術を仮決定する
5. 管理画面技術を仮決定する
6. 認証方式の候補と確定タイミングを決める
7. `error_logs` 独立テーブル有無を仮決定する
8. category mapping未設定時のCSV commit方針を案Bで仮確定する
9. Phase 0 Issueを開始する
10. 実装開始後はdevlog / commit log / issue progressを残す

---

## 14. TODO

- [ ] DBエンジンを仮決定する
- [ ] 認証方式を仮決定する
- [ ] API技術を仮決定する
- [ ] 管理画面技術を仮決定する
- [ ] `error_logs` 独立テーブル有無を仮決定する
- [ ] category mapping未設定時のCSV commit方針を案Bで仮確定する
- [ ] Phase 0のIssueをGitHub Issueまたはローカルtaskに起こす
- [ ] devlog更新ルールを決める
- [ ] `request_id` / `trace_id` の方針をPhase 0またはPhase 1で決める
- [ ] MVP QA checklistをPhase 11で更新する
