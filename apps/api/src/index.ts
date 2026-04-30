import { Hono } from "hono";
import { SAFETY_CONSTRAINTS } from "@menusync/shared";

type Bindings = {
  DB: D1Database;
};

const app = new Hono<{ Bindings: Bindings }>();

app.get("/", (c) => {
  return c.json({
    name: "menu-sync-api",
    phase: "phase-0-skeleton",
    safety: SAFETY_CONSTRAINTS,
  });
});

app.get("/health", (c) => {
  return c.json({ ok: true });
});

export default app;
