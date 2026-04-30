# Database Migrations

Cloudflare D1 migration files will live here.

## Phase 0 Scope

- Directory and documentation only
- No production data
- No seed data
- No external site credentials
- No Cookie, Session, Token, raw DOM, or input value

`database/schema-draft.sql` is PostgreSQL-oriented. D1 migrations must convert PostgreSQL-specific types and constraints before use.
