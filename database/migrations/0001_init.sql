-- 0001_init.sql
-- Menu Sync System / Cloudflare D1 (SQLite) initial schema.
--
-- 正本:
--   - DB論理設計      : docs/03_database-design.md
--   - 同期フロー / status / event_type 値域 : docs/07_sync-flow.md
--   - 保存禁止情報・監査・保持期間          : docs/09_security-policy.md
--   - sync_job 設計   : docs/16_sync-job-design.md
--   - D1 migration計画: docs/24_d1-migration-plan.md
--   - サニタイザ責務  : docs/25_api-sanitizer-policy.md
--   - 保存期間パージ  : decisions/adr-007-retention-purge-policy.md
--
-- 重要ルール:
--   - migration は追加のみ。既存 migration は編集しない。
--   - DELETE 文・パージSQL は本ファイルに含めない（パージは Scheduled Worker で実行: ADR-007）。
--   - 保存禁止情報（ログインID/パスワード/Cookie/Session/Token/CSRF/hidden value/
--     生DOM/外部サイト入力済みvalue）を保存するカラムは作らない。
--   - JSON 系は SQLite 前提で TEXT。書き込み前に API 層サニタイザを通すこと（docs/25）。
--   - PRAGMA foreign_keys = ON; は migration には書かない（接続側責務、docs/24 §8）。
--
-- D1 / SQLite 変換方針（docs/24 §3）:
--   - JSONB → TEXT（サニタイズ済みJSONを格納）
--   - UUID → TEXT（UUID v4 文字列）
--   - BOOLEAN → INTEGER CHECK (col IN (0,1))
--   - TIMESTAMPTZ → TEXT（ISO8601 UTC）
--   - now() デフォルト → strftime('%Y-%m-%dT%H:%M:%fZ','now')
--
-- パージ用日時カラム（ADR-007 §6 連動）:
--   - audit_logs.created_at
--   - sync_job_logs.created_at
--   - csv_import_jobs.created_at（completed_at は parallel）
--   - csv_import_rows は親 csv_import_jobs.created_at を JOIN 参照
--
-- docs/24 §6 との一致: 20 テーブル一致。詳細は本ファイル末尾コメント参照。
--
-- docs/03 整合自己レビュー (2026-04-30):
--   対象 6 テーブル（menu_items / category_mappings / sync_jobs /
--   sync_job_logs / audit_logs / store_site_accounts）について、
--   docs/03_database-design.md 最新仕様と本ファイルの DDL を再照合。
--   差分なし（NOT NULL / CHECK / FK / UNIQUE / 各種カラムすべて一致）。
--   → 本リビジョンでの SQL 本体変更は不要、ヘッダー注記のみ更新。

-- ========================================================================
-- 1. Core: organizations / users / membership / stores
-- ========================================================================

CREATE TABLE organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  organization_type TEXT NOT NULL DEFAULT 'restaurant_owner'
    CHECK (organization_type IN (
      'restaurant_owner',
      'consultant',
      'agency',
      'franchise_headquarters',
      'system_admin'
    )),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'invited', 'suspended', 'deleted')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE organization_users (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member'
    CHECK (role IN ('owner', 'admin', 'operator', 'viewer', 'member')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (organization_id, user_id),
  FOREIGN KEY (organization_id) REFERENCES organizations(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE stores (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  website_url TEXT,
  -- primary_menu_source_id は store_menu_sources(id) を指すが、
  -- store_menu_sources は MVP 初期 20 テーブルに含まれない（docs/24 §6）。
  -- 本 migration では FK を貼らず TEXT のみ保持する。
  primary_menu_source_id TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'deleted')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

CREATE TABLE store_users (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'operator'
    CHECK (role IN ('owner', 'admin', 'operator', 'viewer')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (store_id, user_id),
  FOREIGN KEY (store_id) REFERENCES stores(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- ========================================================================
-- 2. External sites / accounts
-- ========================================================================

CREATE TABLE external_sites (
  id TEXT PRIMARY KEY,
  site_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  base_url TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'deprecated')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- store_site_accounts:
--   ログインID/パスワード/Cookie/Session/Token/CSRF token は保存しない。
--   識別子と URL のみ（docs/09 §4 / docs/24 §11 / CLAUDE.md §6）。
--   auto_submit_enabled は MVP では常に 0 に固定（ADR-003）。
CREATE TABLE store_site_accounts (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  external_site_id TEXT NOT NULL,
  display_name TEXT,
  login_url TEXT,
  admin_url TEXT,
  account_label TEXT,
  external_store_id TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'needs_review', 'deleted')),
  auto_fill_enabled INTEGER NOT NULL DEFAULT 1
    CHECK (auto_fill_enabled IN (0, 1)),
  auto_submit_enabled INTEGER NOT NULL DEFAULT 0
    CHECK (auto_submit_enabled = 0),
  last_detected_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (store_id, external_site_id, external_store_id),
  FOREIGN KEY (store_id) REFERENCES stores(id),
  FOREIGN KEY (external_site_id) REFERENCES external_sites(id)
);

-- ========================================================================
-- 3. Menus / items / versions / rollbacks
-- ========================================================================

CREATE TABLE menus (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT 'default',
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'deleted')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (store_id) REFERENCES stores(id)
);

CREATE TABLE menu_sections (
  id TEXT PRIMARY KEY,
  menu_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'hidden', 'deleted')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (menu_id) REFERENCES menus(id)
);

-- menu_items:
--   raw_source_json は API 層サニタイザを通したデータのみ保存（docs/25 §3.1 連動）。
--   current_version_id は menu_item_versions(id) への循環参照のため、
--   FK は本 migration では貼らない（SQLite は ALTER TABLE ADD CONSTRAINT 不可）。
--   参照整合は API 層で担保する。
CREATE TABLE menu_items (
  id TEXT PRIMARY KEY,
  menu_id TEXT NOT NULL,
  section_id TEXT,
  current_version_id TEXT,
  name TEXT NOT NULL,
  description TEXT,
  price INTEGER,
  tax_type TEXT NOT NULL DEFAULT 'tax_included'
    CHECK (tax_type IN ('tax_included', 'tax_excluded', 'tax_unknown')),
  category_name TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'hidden', 'deleted')),
  image_url TEXT,
  sale_start_date TEXT,
  sale_end_date TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  raw_source_json TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  CHECK (price IS NULL OR price >= 0),
  CHECK (
    sale_end_date IS NULL
    OR sale_start_date IS NULL
    OR sale_end_date >= sale_start_date
  ),
  FOREIGN KEY (menu_id) REFERENCES menus(id),
  FOREIGN KEY (section_id) REFERENCES menu_sections(id)
);

-- menu_item_versions:
--   raw_source_json / changed_fields_json は API 層サニタイザ通過必須（docs/25 §3.1）。
--   source_id は store_menu_sources を指すが MVP 初期テーブルに含まれないため FK は貼らない。
CREATE TABLE menu_item_versions (
  id TEXT PRIMARY KEY,
  menu_item_id TEXT NOT NULL,
  version_number INTEGER NOT NULL,
  source_id TEXT,
  change_type TEXT NOT NULL
    CHECK (change_type IN (
      'create',
      'update',
      'hide',
      'delete_request',
      'rollback',
      'import',
      'sync'
    )),
  name TEXT NOT NULL,
  description TEXT,
  price INTEGER,
  tax_type TEXT
    CHECK (tax_type IS NULL OR tax_type IN ('tax_included', 'tax_excluded', 'tax_unknown')),
  category_name TEXT,
  status TEXT
    CHECK (status IS NULL OR status IN ('active', 'hidden', 'deleted')),
  image_url TEXT,
  sale_start_date TEXT,
  sale_end_date TEXT,
  raw_source_json TEXT,
  changed_fields_json TEXT,
  change_summary TEXT,
  created_by_user_id TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (menu_item_id, version_number),
  CHECK (price IS NULL OR price >= 0),
  CHECK (
    sale_end_date IS NULL
    OR sale_start_date IS NULL
    OR sale_end_date >= sale_start_date
  ),
  FOREIGN KEY (menu_item_id) REFERENCES menu_items(id),
  FOREIGN KEY (created_by_user_id) REFERENCES users(id)
);

CREATE TABLE menu_item_rollbacks (
  id TEXT PRIMARY KEY,
  menu_item_id TEXT NOT NULL,
  from_version_id TEXT NOT NULL,
  to_version_id TEXT NOT NULL,
  reason TEXT,
  created_by_user_id TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (menu_item_id) REFERENCES menu_items(id),
  FOREIGN KEY (from_version_id) REFERENCES menu_item_versions(id),
  FOREIGN KEY (to_version_id) REFERENCES menu_item_versions(id),
  FOREIGN KEY (created_by_user_id) REFERENCES users(id)
);

-- ========================================================================
-- 4. Sync routing / mapping versions / category mappings
-- ========================================================================

-- menu_sync_routes:
--   from_source_id / to_source_id は store_menu_sources を指す論理 FK だが、
--   store_menu_sources は MVP 初期 20 テーブルに含まれないため FK は貼らない。
--   import_rule_id / export_rule_id は transform_rules（Phase 2）参照のため FK 貼らない。
CREATE TABLE menu_sync_routes (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  from_source_id TEXT NOT NULL,
  to_source_id TEXT NOT NULL,
  import_rule_id TEXT,
  export_rule_id TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'deleted')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (store_id) REFERENCES stores(id)
);

-- mapping_versions:
--   site_page_id は site_pages を指すが、site_pages は Phase 2 で導入する。
--   MVP では FK を貼らず TEXT のみ保持する（docs/24 §9 と整合: MVP では status のみで index）。
--   mapping_json は API 層サニタイザ通過必須（docs/25）。
CREATE TABLE mapping_versions (
  id TEXT PRIMARY KEY,
  site_page_id TEXT,
  version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'deprecated', 'rollback')),
  required_extension_version TEXT,
  mapping_json TEXT NOT NULL,
  change_summary TEXT,
  created_by_user_id TEXT,
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (created_by_user_id) REFERENCES users(id)
);

-- category_mappings:
--   from_source_id / to_source_id / to_category_id は MVP 初期 20 テーブル外参照のため FK 貼らない。
CREATE TABLE category_mappings (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  from_source_id TEXT NOT NULL,
  to_source_id TEXT NOT NULL,
  from_category_name TEXT NOT NULL,
  to_category_id TEXT,
  to_category_name TEXT NOT NULL,
  confidence_score REAL NOT NULL DEFAULT 1.0
    CHECK (confidence_score >= 0 AND confidence_score <= 1),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'deleted')),
  created_by_user_id TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (store_id) REFERENCES stores(id),
  FOREIGN KEY (created_by_user_id) REFERENCES users(id)
);

-- ========================================================================
-- 5. CSV import (jobs / rows)
-- ========================================================================

-- csv_import_jobs:
--   error_summary_json は API 層サニタイザ通過必須（docs/25 §3.1）。
--   created_at / completed_at が retention purge の基準カラム（ADR-007 §6）。
CREATE TABLE csv_import_jobs (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  store_id TEXT NOT NULL,
  uploaded_by_user_id TEXT,
  source_filename TEXT NOT NULL,
  import_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (import_status IN (
      'pending',
      'processing',
      'completed',
      'failed',
      'cancelled'
    )),
  total_rows INTEGER NOT NULL DEFAULT 0,
  valid_rows INTEGER NOT NULL DEFAULT 0,
  invalid_rows INTEGER NOT NULL DEFAULT 0,
  error_summary_json TEXT,
  record_status TEXT NOT NULL DEFAULT 'active'
    CHECK (record_status IN ('active', 'archived')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  completed_at TEXT,
  FOREIGN KEY (organization_id) REFERENCES organizations(id),
  FOREIGN KEY (store_id) REFERENCES stores(id),
  FOREIGN KEY (uploaded_by_user_id) REFERENCES users(id)
);

-- csv_import_rows:
--   raw_row_json / normalized_json / validation_errors_json は
--   API 層サニタイザ通過必須（docs/25 §3.1）。
--   行単独の保持期間は親 csv_import_jobs.created_at を JOIN 参照（ADR-007 §6）。
CREATE TABLE csv_import_rows (
  id TEXT PRIMARY KEY,
  csv_import_job_id TEXT NOT NULL,
  row_number INTEGER NOT NULL,
  raw_row_json TEXT NOT NULL,
  normalized_json TEXT,
  validation_status TEXT NOT NULL
    CHECK (validation_status IN ('valid', 'invalid', 'skipped')),
  validation_errors_json TEXT,
  target_menu_item_id TEXT,
  record_status TEXT NOT NULL DEFAULT 'active'
    CHECK (record_status IN ('active', 'archived')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (csv_import_job_id) REFERENCES csv_import_jobs(id),
  FOREIGN KEY (target_menu_item_id) REFERENCES menu_items(id)
);

-- ========================================================================
-- 6. Sync jobs / logs / audit
-- ========================================================================

-- sync_jobs:
--   docs/07 §9 の status 値域、docs/16 のスナップショット参照列を含む。
--   menu_item_version_id / mapping_snapshot_json は docs/24 §12 で
--   「0001_init.sql で確保しておく」と明記された列。
--   summary_json / mapping_snapshot_json は API 層サニタイザ通過必須（docs/25）。
--   auto_submit_enabled は MVP では常に 0 固定（ADR-003）。
CREATE TABLE sync_jobs (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  route_id TEXT,
  store_site_account_id TEXT,
  mapping_version_id TEXT,
  menu_item_version_id TEXT,
  mapping_snapshot_json TEXT,
  extension_version TEXT,
  job_type TEXT NOT NULL
    CHECK (job_type IN ('import', 'export', 'dom_scan', 'identity_check', 'rollback')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN (
      'pending',
      'running',
      'waiting_user_review',
      'completed',
      'failed',
      'cancelled',
      'blocked_by_safety_check'
    )),
  auto_submit_enabled INTEGER NOT NULL DEFAULT 0
    CHECK (auto_submit_enabled = 0),
  started_by_user_id TEXT,
  started_at TEXT,
  finished_at TEXT,
  summary_json TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (store_id) REFERENCES stores(id),
  FOREIGN KEY (route_id) REFERENCES menu_sync_routes(id),
  FOREIGN KEY (store_site_account_id) REFERENCES store_site_accounts(id),
  FOREIGN KEY (mapping_version_id) REFERENCES mapping_versions(id),
  FOREIGN KEY (menu_item_version_id) REFERENCES menu_item_versions(id),
  FOREIGN KEY (started_by_user_id) REFERENCES users(id)
);

-- sync_job_logs:
--   docs/03 §7.3 を正本とするカラム名（log_level / event_type / message / details_json）。
--   event_type 値域は docs/07 §10 が正本（DB CHECK では縛らない: 追加が頻繁なため）。
--   details_json は API 層サニタイザ通過必須（docs/25）。
--   created_at が retention purge の基準カラム（ADR-007 §6）。
CREATE TABLE sync_job_logs (
  id TEXT PRIMARY KEY,
  sync_job_id TEXT NOT NULL,
  log_level TEXT NOT NULL
    CHECK (log_level IN ('debug', 'info', 'warning', 'error')),
  event_type TEXT NOT NULL,
  message TEXT NOT NULL,
  details_json TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (sync_job_id) REFERENCES sync_jobs(id)
);

-- audit_logs:
--   action は docs/09 §8 が正本。DB CHECK では縛らない（追加が頻繁なため、§7.4 方針）。
--   API 層で許可値バリデーション。将来追加予定の値:
--     - sanitizer_rejected         （docs/09 §8 TODO / docs/25 §6）
--     - retention_purge_executed   （ADR-007 連動）
--   before_json / after_json / details_json は API 層サニタイザ通過必須（docs/25 §3.1）。
--   created_at が retention purge の基準カラム（ADR-007 §6）。
CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  store_id TEXT,
  actor_user_id TEXT,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  before_json TEXT,
  after_json TEXT,
  details_json TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'archived')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (organization_id) REFERENCES organizations(id),
  FOREIGN KEY (store_id) REFERENCES stores(id),
  FOREIGN KEY (actor_user_id) REFERENCES users(id)
);

-- ========================================================================
-- Indexes (docs/24 §9)
-- ========================================================================

CREATE INDEX idx_stores_organization_id ON stores(organization_id);
CREATE INDEX idx_organization_users_user_id ON organization_users(user_id);
CREATE INDEX idx_store_users_user_id ON store_users(user_id);

CREATE INDEX idx_store_site_accounts_store_id ON store_site_accounts(store_id);
CREATE INDEX idx_store_site_accounts_external_site_id ON store_site_accounts(external_site_id);

CREATE INDEX idx_menus_store_id ON menus(store_id);
CREATE INDEX idx_menu_sections_menu_id ON menu_sections(menu_id);
CREATE INDEX idx_menu_items_menu_section ON menu_items(menu_id, section_id);
CREATE INDEX idx_menu_item_versions_item_created ON menu_item_versions(menu_item_id, created_at);
CREATE INDEX idx_menu_item_rollbacks_item_id ON menu_item_rollbacks(menu_item_id);

CREATE INDEX idx_menu_sync_routes_store_id ON menu_sync_routes(store_id);

-- mapping_versions: MVP では status のみで index（docs/24 §9 の注に準拠）
CREATE INDEX idx_mapping_versions_status ON mapping_versions(status);

CREATE INDEX idx_category_mappings_store_id ON category_mappings(store_id);
CREATE INDEX idx_category_mappings_from_to_name
  ON category_mappings(from_source_id, to_source_id, from_category_name);
CREATE INDEX idx_category_mappings_status ON category_mappings(status);

CREATE INDEX idx_csv_import_jobs_org_created ON csv_import_jobs(organization_id, created_at);
CREATE INDEX idx_csv_import_jobs_store_created ON csv_import_jobs(store_id, created_at);
CREATE INDEX idx_csv_import_jobs_import_status ON csv_import_jobs(import_status);
CREATE INDEX idx_csv_import_rows_job_row ON csv_import_rows(csv_import_job_id, row_number);
CREATE INDEX idx_csv_import_rows_job_status
  ON csv_import_rows(csv_import_job_id, validation_status);

CREATE INDEX idx_sync_jobs_store_status ON sync_jobs(store_id, status);
CREATE INDEX idx_sync_jobs_store_created ON sync_jobs(store_id, created_at);
CREATE INDEX idx_sync_job_logs_job_created ON sync_job_logs(sync_job_id, created_at);

CREATE INDEX idx_audit_logs_org_created ON audit_logs(organization_id, created_at);
CREATE INDEX idx_audit_logs_actor_created ON audit_logs(actor_user_id, created_at);
CREATE INDEX idx_audit_logs_target ON audit_logs(target_type, target_id, created_at);

-- ========================================================================
-- docs/24 §6 一致確認:
--   1. organizations              ✓
--   2. users                      ✓
--   3. organization_users         ✓
--   4. stores                     ✓
--   5. store_users                ✓
--   6. menus                      ✓
--   7. menu_sections              ✓
--   8. menu_items                 ✓
--   9. menu_item_versions         ✓
--  10. menu_item_rollbacks        ✓
--  11. external_sites             ✓
--  12. store_site_accounts        ✓
--  13. menu_sync_routes           ✓
--  14. mapping_versions           ✓
--  15. category_mappings          ✓
--  16. csv_import_jobs            ✓
--  17. csv_import_rows            ✓
--  18. sync_jobs                  ✓
--  19. sync_job_logs              ✓
--  20. audit_logs                 ✓
-- 一致テーブル数: 20 / 20
--
-- 含めなかったもの（意図的）:
--   - DELETE 文・retention purge SQL（ADR-007: Scheduled Worker 側）
--   - PRAGMA foreign_keys = ON;（接続側責務、docs/24 §8）
--   - seed data
--   - store_menu_sources / site_pages / transform_rules / dom_snapshots /
--     dom_diffs / site_store_profiles / site_store_categories /
--     store_site_identity_checks（Phase 2、docs/24 §7）
--   - guardrail_events（schema-draft.sql には存在するが docs/03 / docs/24 §6 に未掲載）
--
-- 草案との主な差分（schema-draft.sql との比較）:
--   - PostgreSQL → SQLite 変換（JSONB→TEXT、TIMESTAMPTZ→TEXT、BOOLEAN→INTEGER 等）
--   - menu_items: publish_status → status（docs/03 §4.3 を正本に統一）
--   - audit_logs: docs/03 §7.4 のカラム構成（organization_id NOT NULL / actor_user_id /
--     action / target_type NOT NULL / before_json / after_json / status）に統一。
--     草案の event_type / result / user_id は採用しない。
--   - sync_jobs: menu_item_version_id / mapping_snapshot_json を追加（docs/24 §12）
--   - category_mappings: status カラムを追加（docs/24 §9 の index 要件、docs/03 §5.3 の index 候補）
--   - mapping_versions: required_extension_version を NOT NULL → NULL 許容に緩和
--     （docs/03 §6.2 では NOT NULL 指定なし）
--   - 循環 FK は不採用（menu_items.current_version_id → menu_item_versions.id）。
--     SQLite は ALTER TABLE ADD CONSTRAINT 不可のため、参照整合は API 層担保。
