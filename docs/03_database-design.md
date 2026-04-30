# Database Design

## 1. 方針

DB設計では、現在状態と履歴を分離する。

例：

```txt
menu_items = 現在の最新版
menu_item_versions = 過去を含む全変更履歴
```

また、外部サイトのDOM変更やマッピング変更に備えて、設定や実行ログもすべてバージョン管理する。

---

## 2. Core Tables

### 2.1 organizations

```sql
CREATE TABLE organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  organization_type TEXT NOT NULL DEFAULT 'restaurant_owner',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

organization_type:

```txt
restaurant_owner
consultant
agency
franchise_headquarters
system_admin
```

---

### 2.2 users

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

---

### 2.3 organization_users

```sql
CREATE TABLE organization_users (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  created_at TEXT NOT NULL,
  FOREIGN KEY (organization_id) REFERENCES organizations(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

role:

```txt
owner
admin
operator
viewer
```

---

### 2.4 stores

```sql
CREATE TABLE stores (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  website_url TEXT,
  primary_menu_source_id TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (organization_id) REFERENCES organizations(id)
);
```

---

### 2.5 store_users

```sql
CREATE TABLE store_users (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'operator',
  created_at TEXT NOT NULL,
  FOREIGN KEY (store_id) REFERENCES stores(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

---

## 3. External Site Tables

### 3.1 external_sites

```sql
CREATE TABLE external_sites (
  id TEXT PRIMARY KEY,
  site_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  base_url TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

例：

```txt
tabelog
hotpepper
gurunavi
google_business_profile
own_site
csv
```

---

### 3.2 store_site_accounts

```sql
CREATE TABLE store_site_accounts (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  external_site_id TEXT NOT NULL,
  display_name TEXT,
  login_url TEXT,
  admin_url TEXT,
  account_label TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  auto_fill_enabled INTEGER NOT NULL DEFAULT 1,
  auto_submit_enabled INTEGER NOT NULL DEFAULT 0,
  last_detected_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (store_id) REFERENCES stores(id),
  FOREIGN KEY (external_site_id) REFERENCES external_sites(id)
);
```

---

### 3.3 store_menu_sources

```sql
CREATE TABLE store_menu_sources (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  source_type TEXT NOT NULL,
  external_site_id TEXT,
  name TEXT NOT NULL,
  is_primary INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (store_id) REFERENCES stores(id),
  FOREIGN KEY (external_site_id) REFERENCES external_sites(id)
);
```

source_type:

```txt
internal_db
csv
external_site
own_site
spreadsheet
```

---

## 4. Menu Tables

### 4.1 menus

```sql
CREATE TABLE menus (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT 'default',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (store_id) REFERENCES stores(id)
);
```

---

### 4.2 menu_sections

```sql
CREATE TABLE menu_sections (
  id TEXT PRIMARY KEY,
  menu_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (menu_id) REFERENCES menus(id)
);
```

---

### 4.3 menu_items

```sql
CREATE TABLE menu_items (
  id TEXT PRIMARY KEY,
  menu_id TEXT NOT NULL,
  section_id TEXT,
  current_version_id TEXT,
  name TEXT NOT NULL,
  description TEXT,
  price INTEGER,
  tax_type TEXT DEFAULT 'tax_included',
  category_name TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  image_url TEXT,
  sale_start_date TEXT,
  sale_end_date TEXT,
  sort_order INTEGER DEFAULT 0,
  raw_source_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (menu_id) REFERENCES menus(id),
  FOREIGN KEY (section_id) REFERENCES menu_sections(id)
);
```

---

### 4.4 menu_item_versions

```sql
CREATE TABLE menu_item_versions (
  id TEXT PRIMARY KEY,
  menu_item_id TEXT NOT NULL,
  version_number INTEGER NOT NULL,
  source_id TEXT,
  change_type TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  price INTEGER,
  tax_type TEXT,
  category_name TEXT,
  status TEXT,
  image_url TEXT,
  sale_start_date TEXT,
  sale_end_date TEXT,
  raw_source_json TEXT,
  changed_fields_json TEXT,
  change_summary TEXT,
  created_by_user_id TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (menu_item_id) REFERENCES menu_items(id),
  FOREIGN KEY (created_by_user_id) REFERENCES users(id)
);
```

change_type:

```txt
create
update
hide
delete_request
rollback
import
sync
```

---

### 4.5 menu_item_rollbacks

```sql
CREATE TABLE menu_item_rollbacks (
  id TEXT PRIMARY KEY,
  menu_item_id TEXT NOT NULL,
  from_version_id TEXT NOT NULL,
  to_version_id TEXT NOT NULL,
  reason TEXT,
  created_by_user_id TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (menu_item_id) REFERENCES menu_items(id),
  FOREIGN KEY (created_by_user_id) REFERENCES users(id)
);
```

---

## 5. Store Learning Tables

### 5.1 site_store_profiles

```sql
CREATE TABLE site_store_profiles (
  id TEXT PRIMARY KEY,
  store_site_account_id TEXT NOT NULL,
  external_site_id TEXT NOT NULL,
  profile_json TEXT NOT NULL,
  profile_hash TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  first_detected_at TEXT NOT NULL,
  last_detected_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (store_site_account_id) REFERENCES store_site_accounts(id),
  FOREIGN KEY (external_site_id) REFERENCES external_sites(id)
);
```

---

### 5.2 site_store_categories

```sql
CREATE TABLE site_store_categories (
  id TEXT PRIMARY KEY,
  store_site_account_id TEXT NOT NULL,
  external_site_id TEXT NOT NULL,
  category_key TEXT,
  category_name TEXT NOT NULL,
  parent_category_id TEXT,
  external_category_id TEXT,
  source TEXT NOT NULL DEFAULT 'detected',
  status TEXT NOT NULL DEFAULT 'active',
  first_detected_at TEXT NOT NULL,
  last_detected_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (store_site_account_id) REFERENCES store_site_accounts(id),
  FOREIGN KEY (external_site_id) REFERENCES external_sites(id),
  FOREIGN KEY (parent_category_id) REFERENCES site_store_categories(id)
);
```

---

### 5.3 category_mappings

```sql
CREATE TABLE category_mappings (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  from_source_id TEXT NOT NULL,
  to_source_id TEXT NOT NULL,
  from_category_name TEXT NOT NULL,
  to_category_id TEXT,
  to_category_name TEXT NOT NULL,
  confidence_score REAL DEFAULT 1.0,
  created_by_user_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (store_id) REFERENCES stores(id),
  FOREIGN KEY (to_category_id) REFERENCES site_store_categories(id),
  FOREIGN KEY (created_by_user_id) REFERENCES users(id)
);
```

---

### 5.4 store_site_identity_checks

```sql
CREATE TABLE store_site_identity_checks (
  id TEXT PRIMARY KEY,
  store_site_account_id TEXT NOT NULL,
  check_type TEXT NOT NULL,
  expected_value TEXT NOT NULL,
  last_detected_value TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (store_site_account_id) REFERENCES store_site_accounts(id)
);
```

check_type:

```txt
store_name
phone
address
admin_url
external_store_id
```

---

## 6. Mapping and DOM Tables

### 6.1 site_pages

```sql
CREATE TABLE site_pages (
  id TEXT PRIMARY KEY,
  external_site_id TEXT NOT NULL,
  page_key TEXT NOT NULL,
  url_pattern TEXT,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (external_site_id) REFERENCES external_sites(id)
);
```

---

### 6.2 mapping_versions

```sql
CREATE TABLE mapping_versions (
  id TEXT PRIMARY KEY,
  site_page_id TEXT NOT NULL,
  version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  required_extension_version TEXT,
  mapping_json TEXT NOT NULL,
  change_summary TEXT,
  created_by_user_id TEXT,
  published_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (site_page_id) REFERENCES site_pages(id),
  FOREIGN KEY (created_by_user_id) REFERENCES users(id)
);
```

status:

```txt
draft
published
deprecated
rollback
```

---

### 6.3 transform_rules

```sql
CREATE TABLE transform_rules (
  id TEXT PRIMARY KEY,
  rule_type TEXT NOT NULL,
  store_id TEXT,
  source_id TEXT,
  target_id TEXT,
  version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  rule_json TEXT NOT NULL,
  change_summary TEXT,
  created_by_user_id TEXT,
  published_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (store_id) REFERENCES stores(id),
  FOREIGN KEY (created_by_user_id) REFERENCES users(id)
);
```

rule_type:

```txt
import
export
```

---

### 6.4 dom_snapshots

```sql
CREATE TABLE dom_snapshots (
  id TEXT PRIMARY KEY,
  store_site_account_id TEXT,
  site_page_id TEXT NOT NULL,
  mapping_version_id TEXT,
  snapshot_hash TEXT NOT NULL,
  sanitized_snapshot_json TEXT NOT NULL,
  extension_version TEXT,
  captured_by_user_id TEXT,
  captured_at TEXT NOT NULL,
  FOREIGN KEY (store_site_account_id) REFERENCES store_site_accounts(id),
  FOREIGN KEY (site_page_id) REFERENCES site_pages(id),
  FOREIGN KEY (mapping_version_id) REFERENCES mapping_versions(id),
  FOREIGN KEY (captured_by_user_id) REFERENCES users(id)
);
```

---

### 6.5 dom_diffs

```sql
CREATE TABLE dom_diffs (
  id TEXT PRIMARY KEY,
  site_page_id TEXT NOT NULL,
  previous_snapshot_id TEXT,
  current_snapshot_id TEXT NOT NULL,
  severity TEXT NOT NULL,
  diff_type TEXT NOT NULL,
  diff_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  resolved_by_mapping_version_id TEXT,
  created_at TEXT NOT NULL,
  resolved_at TEXT,
  FOREIGN KEY (site_page_id) REFERENCES site_pages(id)
);
```

---

## 7. Sync Tables

### 7.1 menu_sync_routes

```sql
CREATE TABLE menu_sync_routes (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  from_source_id TEXT NOT NULL,
  to_source_id TEXT NOT NULL,
  import_rule_id TEXT,
  export_rule_id TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (store_id) REFERENCES stores(id)
);
```

---

### 7.2 sync_jobs

```sql
CREATE TABLE sync_jobs (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  route_id TEXT,
  store_site_account_id TEXT,
  mapping_version_id TEXT,
  extension_version TEXT,
  job_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  started_by_user_id TEXT,
  started_at TEXT,
  finished_at TEXT,
  summary_json TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (store_id) REFERENCES stores(id),
  FOREIGN KEY (route_id) REFERENCES menu_sync_routes(id),
  FOREIGN KEY (mapping_version_id) REFERENCES mapping_versions(id),
  FOREIGN KEY (started_by_user_id) REFERENCES users(id)
);
```

---

### 7.3 sync_job_logs

```sql
CREATE TABLE sync_job_logs (
  id TEXT PRIMARY KEY,
  sync_job_id TEXT NOT NULL,
  log_level TEXT NOT NULL,
  event_type TEXT NOT NULL,
  message TEXT NOT NULL,
  details_json TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (sync_job_id) REFERENCES sync_jobs(id)
);
```

---

## 8. Index Strategy TODO

今後検討するインデックス：

```txt
stores.organization_id
store_site_accounts.store_id
menu_items.menu_id
menu_item_versions.menu_item_id
mapping_versions.site_page_id + status
dom_snapshots.site_page_id + captured_at
dom_diffs.site_page_id + status
sync_jobs.store_id + created_at
```
