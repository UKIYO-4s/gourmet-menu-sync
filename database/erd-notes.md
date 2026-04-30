# ERD Notes

Menu Sync System の論理ERDメモ。詳細なDDLは `database/schema-draft.sql`、テーブル定義の説明は `docs/03_database-design.md` を参照する。

このメモは Phase 1.5 Hotpepper 実画面検証に入る前の復旧版であり、実画面DOM確認後に `dom_snapshots` / `mapping_versions` / `store_site_identity_checks` の粒度を再校正する。

---

## 1. 設計原則

- 現在状態と履歴を分離する。
- 外部サイト同士を直接変換せず、必ず Common Menu Model を経由する。
- Mapping JSON、DOM snapshot、sync job、audit log は履歴として追跡できるようにする。
- MVPでは保存・公開・削除を自動実行しない。
- 外部サイトのログインID、パスワード、Cookie、Session、Token、CSRF token、input value、hidden value、生DOM全文は保存しない。

---

## 2. 主要エンティティ

### Organization / User / Store

```txt
organizations
  ├─ organization_users ─ users
  └─ stores
       └─ store_users ─ users
```

- `organizations`: 店舗運営会社、代理店、コンサル等の単位。
- `users`: システム利用者。
- `organization_users`: 組織内ロール。
- `stores`: 店舗。
- `store_users`: 店舗単位の操作権限。

### External Site / Account / Source

```txt
stores
  ├─ store_site_accounts ─ external_sites
  └─ store_menu_sources ─ external_sites
```

- `external_sites`: Hotpepper / Tabelog / Gurunavi / CSV / own_site 等。
- `store_site_accounts`: 店舗と外部サイト管理画面の接続情報。認証情報は持たない。
- `store_menu_sources`: 自社DB、CSV、外部サイトなど、メニュー正本・入力元の候補。

### Menu / Version

```txt
stores
  └─ menus
       ├─ menu_sections
       └─ menu_items
            ├─ current_version_id ─ menu_item_versions
            └─ menu_item_versions
                 └─ menu_item_rollbacks
```

- `menu_items`: 現在の最新版。
- `menu_item_versions`: 追記型の履歴。
- `menu_item_rollbacks`: 過去versionを直接復元せず、過去versionを元に新versionを作る記録。
- 季節終了は原則 `publish_status = hidden`。削除は `deleted` として論理削除。

### Store Learning

```txt
store_site_accounts
  ├─ site_store_profiles
  ├─ site_store_categories
  └─ store_site_identity_checks

stores
  └─ category_mappings
       └─ site_store_categories
```

- `site_store_profiles`: 外部サイト上の店舗プロフィール構造。保存値はサニタイズ済み。
- `site_store_categories`: 外部サイト上のカテゴリ候補。option value は保存せずラベル中心。
- `category_mappings`: Common Menu Model 側カテゴリと外部サイトカテゴリの対応。
- `store_site_identity_checks`: 店舗名、電話、住所、管理画面URL、外部店舗IDの照合項目。

### Mapping / DOM

```txt
external_sites
  └─ site_pages
       ├─ mapping_versions
       ├─ dom_snapshots
       └─ dom_diffs

mapping_versions
  └─ dom_snapshots

dom_snapshots
  └─ dom_diffs
```

- `site_pages`: `hotpepper/menu_edit` のようなサイト別ページ。
- `mapping_versions`: Mapping JSON のバージョン管理。`auto_submit_enabled=false` をDB制約でも維持。
- `dom_snapshots`: サニタイズ済み構造情報のみ。生DOM、input value、hidden valueは保存しない。
- `dom_diffs`: DOM差分と severity。`critical` は `must_stop=true`。

### Sync / Log / Guardrail

```txt
stores
  ├─ menu_sync_routes
  ├─ sync_jobs
  │    └─ sync_job_logs
  ├─ audit_logs
  └─ guardrail_events
```

- `menu_sync_routes`: Source -> Common Menu Model -> Target の同期経路。
- `sync_jobs`: 同期・DOMスキャン・identity check等のジョブ。
- `sync_job_logs`: 技術的な実行ログ。値ではなくhash、score、理由ラベルを保存。
- `audit_logs`: ユーザー操作・安全停止・mapping公開等の監査ログ。
- `guardrail_events`: safety stop、identity mismatch、DOM critical diff 等のガードレール記録。

---

## 3. Phase 1.5 で特に使う関係

Hotpepper実画面検証では、主に以下を確認する。

```txt
external_sites(site_key = hotpepper)
  └─ site_pages(page_key = menu_edit)
       ├─ mapping_versions(version = 2026.04.30-001)
       ├─ dom_snapshots(sanitized_snapshot_json)
       └─ dom_diffs(severity, diff_type, must_stop)

stores
  └─ store_site_accounts
       ├─ store_site_identity_checks
       ├─ site_store_categories
       └─ sync_jobs
            └─ sync_job_logs
```

検証結果ファイルには実店舗値を書かず、`STORE_A` / `PHONE_A` / `ADDR_A` / `STOREID_A` のような仮名を使う。

---

## 4. Safety Constraints

### 自動保存禁止

以下は常に false。

```txt
store_site_accounts.auto_submit_enabled
sync_jobs.auto_submit_enabled
mapping_versions.mapping_json.submit.autoSubmit
mapping_versions.mapping_json.safety.autoSubmit
mapping_versions.safety_json.auto_submit_enabled
```

### 保存禁止データ

保存しない。

```txt
login_id
password
cookie
session
token
csrf_token
authorization_header
input_value
hidden_value
raw_dom
outer_html
local_storage
indexed_db
```

### DOM Snapshotに保存してよいもの

```txt
tag
type
name
id
label
placeholder
aria-label
nearby_text
selector_hint
field_hash
button_text
form_structure
url_pattern
page_hash
match_score
```

---

## 5. D1 移行時の注意

`database/schema-draft.sql` はPostgreSQL寄りの論理スキーマであり、`JSONB`、`TIMESTAMPTZ`、`CHECK` 制約を使う。

Cloudflare D1 / SQLite へ移行する場合:

- `JSONB` は `TEXT` に置換し、アプリケーション側でJSON validationを強制する。
- `TIMESTAMPTZ` は ISO8601 `TEXT` に置換する。
- `BOOLEAN` は `INTEGER` 0/1 に置換する。
- JSONパスを使うDB制約は、mapping publish前 validation と拡張側 validation で補完する。

---

## 6. Open TODO

- Hotpepper実画面検証後、`store_site_identity_checks` の5項目が十分か確認する。
- `dom_snapshots.sanitized_snapshot_json` の保存粒度を実画面検証結果に合わせて校正する。
- `mapping_versions.mapping_json` のスキーマを `docs/05_mapping-json-design.md` と完全一致させる。
- D1採用時の代替制約を別ドキュメント化する。
