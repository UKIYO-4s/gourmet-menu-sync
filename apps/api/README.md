# API App

Cloudflare Workers + Hono API skeleton for Menu Sync System.

## Scope

- Minimal Worker entrypoint
- Hono routing skeleton
- D1 binding placeholder for local migration setup
- No external site admin screen analysis
- No Chrome extension real connection
- No auto save, auto publish, or auto delete
- No Cookie, Session, Token, raw DOM, or input value handling

## Commands

```sh
pnpm --filter @menusync/api dev
pnpm --filter @menusync/api build
pnpm --filter @menusync/api typecheck
pnpm --filter @menusync/api db:migrate
```

`database_id` values in `wrangler.toml` are placeholders for Phase 0 and must be replaced before real deployment.
