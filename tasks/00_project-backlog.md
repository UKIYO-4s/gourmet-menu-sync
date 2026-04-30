# プロジェクトバックログ

`docs/00_master-spec.md` 第19章「開発フェーズ」と本リポジトリ構成を整理。

進行中タスクは `tasks/01_phase1-design-tasks.md` / `tasks/02_phase2-mvp-tasks.md` で管理。

---

## Phase 1: 設計固め（現在地）

- [x] 仕様書を `docs/` 配下へ分割
- [x] 開発ロードマップ確定 → `docs/10_development-roadmap.md`
- [x] DBスキーマ初版作成 → `database/schema-draft.sql`
- [x] ER図メモ作成 → `database/erd-notes.md`
- [x] Phase1 DOM検出 検証計画 → `experiments/phase1-dom-detection-plan.md`
- [x] 空ファイル復旧（2026-04-30）→ `database/schema-draft.sql` / `database/erd-notes.md` / `configs/mapping-samples/hotpepper-menu-edit.sample.json`
- [ ] Common Menu Model の正式定義（型・必須）→ `docs/01_system-overview.md`
- [ ] DBスキーマ確定（インデックス / FK / JSON 戦略）→ `database/schema-draft.sql` + `docs/03_database-design.md`
- [ ] Chrome拡張の権限・モジュール設計確定 → `docs/04_chrome-extension-design.md`
- [ ] mapping JSON 仕様確定 → `docs/05_mapping-json-design.md`
- [ ] DOMスナップショット / 差分仕様確定 → `docs/06_dom-diff-design.md`
- [ ] 同期フロー確定 → `docs/07_sync-flow.md`
- [ ] セキュリティポリシー確定 → `docs/09_security-policy.md`
- [ ] ADR 本文記入（001〜003）
- [x] ADR-004（mapping JSON のホット更新方針）起票 → `decisions/adr-004-json-mapping-hot-update.md`

---

## Phase 1.5: Hotpepper 実画面検証（次にやる）

- [x] 実画面検証結果ファイル作成 → `experiments/results/hotpepper-menu-edit-2026-04-30.md`
- [x] 実画面検証前の Hotpepper mapping baseline 復旧 → `configs/mapping-samples/hotpepper-menu-edit.sample.json`
- [ ] **Phase1 DOM検出 検証チェックリスト** → `experiments/phase1-dom-detection-checklist.md` を実画面で実行
- [ ] **Hotpepper メニュー編集画面の実画面調査**（追加・既存編集の両方）
  - URL pattern, フィールド構造, ボタン構造, 確認ダイアログ, iframe/SPA挙動
- [ ] **mapping sample の実画面反映** → `configs/mapping-samples/hotpepper-menu-edit.sample.json`
  - 実観察値で selectors / labels / placeholders / minMatchScore を校正
- [ ] field_hash / page_hash の安定性検証（再取得・日次・小規模UI変化）
- [ ] critical / warning diff の再現シナリオ実行
- [ ] store identity 5項目の取得確度評価
- [ ] 検証ログ → `experiments/logs/phase1/`
- [ ] devlog → `devlog/YYYY-MM-DD-phase1-dom-detection.md`
- [ ] 検証結果を踏まえた **docs/04 / docs/05 の整合性更新**
- [ ] 検証結果を踏まえた **docs/03_database-design.md の更新**（field_hash / page_hash / identity 5項目の保存粒度）
- [ ] GO/HOLD/STOP 判定（チェックリスト 21 章）→ Phase 2 へ進む可否を確定

---

## Phase 2: Chrome拡張 MVP 最小プロトタイプ

`extension-mvp/README.md` を実装に落とす段階。

- [x] **Chrome拡張MVP の最小プロトタイプ設計** → `extension-mvp/README.md`
- [ ] Manifest V3 最小構成（host_permissions = Hotpepper のみ）
- [ ] popup / side panel: 組織/店舗選択・状態表示
- [ ] background: API クライアント, mapping ローダ, 状態管理
- [ ] content/scanner: allowlist DOM スキャン
- [ ] content/matcher: mapping JSON との照合・match_score
- [ ] content/identity-checker: 店舗4〜5項目照合
- [ ] content/executor: 入力反映（保存ボタンには触れない）
- [ ] content/reporter: hash/score/判定理由のみ送信
- [ ] core/sanitizer: allowlist による情報フィルタ
- [ ] mapping JSON validation（required_extension_version / autoSubmit=false 等）
- [ ] 1店舗 1サイトでの入力補助 E2E（保存は人間）
- [ ] **MVP段階で `auto_submit_enabled = true` にしないこと**（ADR-003）

---

## Phase 3: API / Admin / 店舗別学習

- [ ] API プロジェクト初期化（`api/`）
- [ ] 管理画面プロジェクト初期化（`admin/`）
- [ ] DBスキーマ初版を実DBへ反映（`database/`）
- [ ] サンプル transform-rules → `configs/transform-rules/`
- [ ] sync_jobs / sync_job_logs への記録（API側受信）
- [ ] DOMスナップショット保存
- [ ] 店舗識別チェック動作
- [ ] カテゴリ自動検出
- [ ] site_store_profiles 自動作成
- [ ] category_mappings UI
- [ ] store_site_identity_checks 強化
- [ ] DOM差分通知

---

## Phase 4: 運用自動化

- [ ] mapping JSON 即時配信API
- [ ] GitHub Actions による拡張機能ビルド
- [ ] Chrome Web Store 更新フロー
- [ ] 障害通知（Slack 等）
- [ ] ロールバックUI

---

## Phase 5: 高度化

- [ ] 画像アップロード補助
- [ ] コース料理対応
- [ ] 複数店舗一括更新
- [ ] AIによるカテゴリ候補提案
- [ ] 自動保存の限定解禁（条件付き・サイト別）

---

## オープン論点（要意思決定）

- [ ] DB選定（D1 / PostgreSQL / MySQL）
- [ ] 認証方式（自前 / OIDC）
- [ ] フロント技術選定（admin）
- [ ] APIフレームワーク選定
- [ ] Chrome拡張の Manifest V3 周辺の方針詳細
- [ ] mapping JSON のホスティング・キャッシュ戦略（ADR-004）
- [ ] popup と side panel の最終選択
