-- Menu Sync System logical schema draft.
-- Target: PostgreSQL-oriented logical schema for Phase 1 design.
-- D1 migration note: JSONB columns should be replaced with TEXT columns
-- containing validated JSON when moving to Cloudflare D1 / SQLite.
-- Safety note: Do not store login IDs, passwords, cookies, sessions, tokens,
-- CSRF tokens, hidden values, raw DOM, or input values from external sites.

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
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'invited', 'suspended', 'deleted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE organization_users (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  role TEXT NOT NULL DEFAULT 'member'
    CHECK (role IN ('owner', 'admin', 'operator', 'viewer', 'member')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);

CREATE TABLE stores (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  website_url TEXT,
  primary_menu_source_id TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'deleted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE store_users (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL REFERENCES stores(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  role TEXT NOT NULL DEFAULT 'operator'
    CHECK (role IN ('owner', 'admin', 'operator', 'viewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (store_id, user_id)
);

CREATE TABLE external_sites (
  id TEXT PRIMARY KEY,
  site_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  base_url TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'deprecated')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE store_site_accounts (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL REFERENCES stores(id),
  external_site_id TEXT NOT NULL REFERENCES external_sites(id),
  display_name TEXT,
  login_url TEXT,
  admin_url TEXT,
  account_label TEXT,
  external_store_id TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'needs_review', 'deleted')),
  auto_fill_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  auto_submit_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  last_detected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (store_id, external_site_id, external_store_id),
  CHECK (auto_submit_enabled = FALSE)
);

CREATE TABLE store_menu_sources (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL REFERENCES stores(id),
  source_type TEXT NOT NULL
    CHECK (source_type IN (
      'internal_db',
      'csv',
      'external_site',
      'own_site',
      'spreadsheet'
    )),
  external_site_id TEXT REFERENCES external_sites(id),
  name TEXT NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'deleted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE stores
  ADD CONSTRAINT stores_primary_menu_source_fk
  FOREIGN KEY (primary_menu_source_id) REFERENCES store_menu_sources(id);

CREATE TABLE menus (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL REFERENCES stores(id),
  name TEXT NOT NULL DEFAULT 'default',
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'deleted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE menu_sections (
  id TEXT PRIMARY KEY,
  menu_id TEXT NOT NULL REFERENCES menus(id),
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'hidden', 'deleted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE menu_items (
  id TEXT PRIMARY KEY,
  menu_id TEXT NOT NULL REFERENCES menus(id),
  section_id TEXT REFERENCES menu_sections(id),
  current_version_id TEXT,
  name TEXT NOT NULL,
  description TEXT,
  price INTEGER,
  tax_type TEXT NOT NULL DEFAULT 'tax_included'
    CHECK (tax_type IN ('tax_included', 'tax_excluded', 'tax_unknown')),
  category_name TEXT,
  publish_status TEXT NOT NULL DEFAULT 'enabled'
    CHECK (publish_status IN ('enabled', 'hidden', 'deleted')),
  image_url TEXT,
  sale_start_date DATE,
  sale_end_date DATE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  raw_source_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (price IS NULL OR price >= 0),
  CHECK (sale_end_date IS NULL OR sale_start_date IS NULL OR sale_end_date >= sale_start_date)
);

CREATE TABLE menu_item_versions (
  id TEXT PRIMARY KEY,
  menu_item_id TEXT NOT NULL REFERENCES menu_items(id),
  version_number INTEGER NOT NULL,
  source_id TEXT REFERENCES store_menu_sources(id),
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
  tax_type TEXT CHECK (tax_type IN ('tax_included', 'tax_excluded', 'tax_unknown')),
  category_name TEXT,
  publish_status TEXT CHECK (publish_status IN ('enabled', 'hidden', 'deleted')),
  image_url TEXT,
  sale_start_date DATE,
  sale_end_date DATE,
  raw_source_json JSONB,
  changed_fields_json JSONB,
  change_summary TEXT,
  created_by_user_id TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (menu_item_id, version_number),
  CHECK (price IS NULL OR price >= 0),
  CHECK (sale_end_date IS NULL OR sale_start_date IS NULL OR sale_end_date >= sale_start_date)
);

ALTER TABLE menu_items
  ADD CONSTRAINT menu_items_current_version_fk
  FOREIGN KEY (current_version_id) REFERENCES menu_item_versions(id);

CREATE TABLE menu_item_rollbacks (
  id TEXT PRIMARY KEY,
  menu_item_id TEXT NOT NULL REFERENCES menu_items(id),
  from_version_id TEXT NOT NULL REFERENCES menu_item_versions(id),
  to_version_id TEXT NOT NULL REFERENCES menu_item_versions(id),
  reason TEXT,
  created_by_user_id TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE site_store_profiles (
  id TEXT PRIMARY KEY,
  store_site_account_id TEXT NOT NULL REFERENCES store_site_accounts(id),
  external_site_id TEXT NOT NULL REFERENCES external_sites(id),
  profile_json JSONB NOT NULL,
  profile_hash TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'stale', 'needs_review', 'deleted')),
  first_detected_at TIMESTAMPTZ NOT NULL,
  last_detected_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE site_store_categories (
  id TEXT PRIMARY KEY,
  store_site_account_id TEXT NOT NULL REFERENCES store_site_accounts(id),
  external_site_id TEXT NOT NULL REFERENCES external_sites(id),
  category_key TEXT,
  category_name TEXT NOT NULL,
  parent_category_id TEXT REFERENCES site_store_categories(id),
  external_category_id TEXT,
  source TEXT NOT NULL DEFAULT 'detected'
    CHECK (source IN ('detected', 'manual', 'imported')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'hidden', 'deleted')),
  first_detected_at TIMESTAMPTZ NOT NULL,
  last_detected_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE category_mappings (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL REFERENCES stores(id),
  from_source_id TEXT NOT NULL REFERENCES store_menu_sources(id),
  to_source_id TEXT NOT NULL REFERENCES store_menu_sources(id),
  from_category_name TEXT NOT NULL,
  to_category_id TEXT REFERENCES site_store_categories(id),
  to_category_name TEXT NOT NULL,
  confidence_score NUMERIC(4, 3) NOT NULL DEFAULT 1.000,
  created_by_user_id TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (confidence_score >= 0 AND confidence_score <= 1)
);

CREATE TABLE store_site_identity_checks (
  id TEXT PRIMARY KEY,
  store_site_account_id TEXT NOT NULL REFERENCES store_site_accounts(id),
  check_type TEXT NOT NULL
    CHECK (check_type IN (
      'store_name',
      'phone',
      'address',
      'admin_url',
      'external_store_id'
    )),
  expected_value TEXT NOT NULL,
  last_detected_value TEXT,
  match_score NUMERIC(4, 3),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'matched', 'mismatch', 'missing', 'ignored')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (match_score IS NULL OR (match_score >= 0 AND match_score <= 1)),
  UNIQUE (store_site_account_id, check_type)
);

CREATE TABLE site_pages (
  id TEXT PRIMARY KEY,
  external_site_id TEXT NOT NULL REFERENCES external_sites(id),
  page_key TEXT NOT NULL,
  url_pattern TEXT,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'deprecated')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (external_site_id, page_key)
);

CREATE TABLE mapping_versions (
  id TEXT PRIMARY KEY,
  site_page_id TEXT NOT NULL REFERENCES site_pages(id),
  version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'deprecated', 'rollback')),
  required_extension_version TEXT NOT NULL,
  mapping_json JSONB NOT NULL,
  safety_json JSONB NOT NULL DEFAULT '{"auto_submit_enabled": false}'::jsonb,
  change_summary TEXT,
  created_by_user_id TEXT REFERENCES users(id),
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (site_page_id, version),
  CHECK (
    COALESCE(mapping_json #>> '{submit,autoSubmit}', 'false') = 'false'
    AND COALESCE(mapping_json #>> '{submit,auto_submit_enabled}', 'false') = 'false'
    AND COALESCE(mapping_json #>> '{safety,autoSubmit}', 'false') = 'false'
    AND COALESCE(mapping_json #>> '{safety,auto_submit_enabled}', 'false') = 'false'
    AND COALESCE(safety_json->>'auto_submit_enabled', 'false') = 'false'
  )
);

CREATE TABLE transform_rules (
  id TEXT PRIMARY KEY,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('import', 'export')),
  store_id TEXT REFERENCES stores(id),
  source_id TEXT REFERENCES store_menu_sources(id),
  target_id TEXT REFERENCES store_menu_sources(id),
  version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'deprecated', 'rollback')),
  rule_json JSONB NOT NULL,
  change_summary TEXT,
  created_by_user_id TEXT REFERENCES users(id),
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE dom_snapshots (
  id TEXT PRIMARY KEY,
  store_site_account_id TEXT REFERENCES store_site_accounts(id),
  site_page_id TEXT NOT NULL REFERENCES site_pages(id),
  mapping_version_id TEXT REFERENCES mapping_versions(id),
  snapshot_hash TEXT NOT NULL,
  page_hash TEXT,
  sanitized_snapshot_json JSONB NOT NULL,
  extension_version TEXT,
  captured_by_user_id TEXT REFERENCES users(id),
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE dom_diffs (
  id TEXT PRIMARY KEY,
  site_page_id TEXT NOT NULL REFERENCES site_pages(id),
  previous_snapshot_id TEXT REFERENCES dom_snapshots(id),
  current_snapshot_id TEXT NOT NULL REFERENCES dom_snapshots(id),
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  diff_type TEXT NOT NULL CHECK (diff_type IN (
    'field_added',
    'field_removed',
    'selector_changed',
    'label_changed',
    'placeholder_changed',
    'aria_label_changed',
    'button_changed',
    'required_field_missing',
    'layout_changed',
    'page_hash_changed',
    'store_identity_missing',
    'store_identity_mismatch'
  )),
  diff_json JSONB NOT NULL,
  must_stop BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'acknowledged', 'resolved', 'ignored')),
  resolved_by_mapping_version_id TEXT REFERENCES mapping_versions(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  CHECK (
    (severity = 'critical' AND must_stop = TRUE)
    OR severity <> 'critical'
  )
);

CREATE TABLE menu_sync_routes (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL REFERENCES stores(id),
  from_source_id TEXT NOT NULL REFERENCES store_menu_sources(id),
  to_source_id TEXT NOT NULL REFERENCES store_menu_sources(id),
  import_rule_id TEXT REFERENCES transform_rules(id),
  export_rule_id TEXT REFERENCES transform_rules(id),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'deleted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sync_jobs (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL REFERENCES stores(id),
  route_id TEXT REFERENCES menu_sync_routes(id),
  store_site_account_id TEXT REFERENCES store_site_accounts(id),
  mapping_version_id TEXT REFERENCES mapping_versions(id),
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
  auto_submit_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  started_by_user_id TEXT REFERENCES users(id),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  summary_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (auto_submit_enabled = FALSE)
);

CREATE TABLE sync_job_logs (
  id TEXT PRIMARY KEY,
  sync_job_id TEXT NOT NULL REFERENCES sync_jobs(id),
  log_level TEXT NOT NULL CHECK (log_level IN ('debug', 'info', 'warning', 'error')),
  event_type TEXT NOT NULL,
  message TEXT NOT NULL,
  details_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  organization_id TEXT REFERENCES organizations(id),
  store_id TEXT REFERENCES stores(id),
  user_id TEXT REFERENCES users(id),
  event_type TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  result TEXT NOT NULL DEFAULT 'success'
    CHECK (result IN ('success', 'failure', 'blocked')),
  details_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE guardrail_events (
  id TEXT PRIMARY KEY,
  sync_job_id TEXT REFERENCES sync_jobs(id),
  store_id TEXT REFERENCES stores(id),
  external_site_id TEXT REFERENCES external_sites(id),
  guardrail_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  reason_code TEXT NOT NULL,
  details_json JSONB,
  must_stop BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_stores_organization_id ON stores(organization_id);
CREATE INDEX idx_store_users_user_id ON store_users(user_id);
CREATE INDEX idx_store_site_accounts_store_id ON store_site_accounts(store_id);
CREATE INDEX idx_store_site_accounts_external_site_id ON store_site_accounts(external_site_id);
CREATE INDEX idx_store_menu_sources_store_id ON store_menu_sources(store_id);
CREATE INDEX idx_menus_store_id ON menus(store_id);
CREATE INDEX idx_menu_sections_menu_id ON menu_sections(menu_id);
CREATE INDEX idx_menu_items_menu_id ON menu_items(menu_id);
CREATE INDEX idx_menu_items_section_id ON menu_items(section_id);
CREATE INDEX idx_menu_item_versions_item_id ON menu_item_versions(menu_item_id);
CREATE INDEX idx_site_store_profiles_account_id ON site_store_profiles(store_site_account_id);
CREATE INDEX idx_site_store_categories_account_id ON site_store_categories(store_site_account_id);
CREATE INDEX idx_category_mappings_store_id ON category_mappings(store_id);
CREATE INDEX idx_identity_checks_account_id ON store_site_identity_checks(store_site_account_id);
CREATE INDEX idx_site_pages_external_site_id ON site_pages(external_site_id);
CREATE INDEX idx_mapping_versions_site_page_status ON mapping_versions(site_page_id, status);
CREATE INDEX idx_dom_snapshots_site_page_captured_at ON dom_snapshots(site_page_id, captured_at);
CREATE INDEX idx_dom_diffs_site_page_status ON dom_diffs(site_page_id, status);
CREATE INDEX idx_sync_jobs_store_created_at ON sync_jobs(store_id, created_at);
CREATE INDEX idx_sync_job_logs_job_created_at ON sync_job_logs(sync_job_id, created_at);
CREATE INDEX idx_audit_logs_store_created_at ON audit_logs(store_id, created_at);
CREATE INDEX idx_guardrail_events_job_created_at ON guardrail_events(sync_job_id, created_at);
