# Feature Flags API Parameters — vNext Plan (post‑update review)

Goal: Finalize remaining improvements after recent parameter updates. Keep the API idiomatic and aligned with Better Auth conventions.

References: CLAUDE.md, CLAUDE.local.md, specs/conventions.md, vendor/better-auth

What’s already landed

- Public read endpoints now use `flagKey`/`flagKeys`, `default(s)`, and `select` with optional field projection.
- Single evaluate returns `evaluatedAt` and supports `contextInResponse`; batch and bootstrap unify shaping with `select`.
- Events: single uses `{ flagKey, event, timestamp: string, sampleRate }` with `Idempotency-Key` header; batch adds top‑level `sampleRate` and `idempotencyKey`.
- Admin overrides list migrated to `{ cursor, limit, q, sort }` with `{ page: { nextCursor, limit, hasMore } }`.

Remaining Improvements (by area)

- Public
  - Apply header precedence for environment in evaluate‑batch and bootstrap (use `resolveEnvironment(ctx, bodyEnv)` as in single evaluate).
  - Ensure all public responses include `evaluatedAt` (single done; batch & bootstrap already include).

- Admin
  - Audit list: replace `offset/limit` with `cursor/limit` and return `{ page }` metadata.
  - Environments list: add `cursor/limit` and `{ page }` metadata; consider adding stable `key` (slug) to create/update.
  - DELETE responses: return `204 No Content` for delete endpoints (flags, overrides, environments) instead of `{ success: true }`.
  - Optional: merge enable/disable into `PATCH /flags/:id { enabled }` (keep action routes if desired, but PATCH is more RESTful).

- Cross‑cutting
  - Query coercion: use `z.coerce.number()`/`z.coerce.boolean()` consistently for query params (admin flags `limit`, `enabled`; already done in overrides).
  - Error contract: converge on a single error style (prefer `ctx.error(...)` or a shared helper) across endpoints for consistent `{ code, message, details? }`.
  - Config endpoint: add `ETag` or `Cache-Control` hints and support `If-None-Match` to enable client caching.
  - Health endpoint: add `HEAD /feature-flags/health` and optional `?verbose=1` while keeping default GET lightweight.
  - Docs/specs: update API reference and examples to reflect `select`, `flagKey(s)`, `default(s)`, header precedence for environment, and new admin list shapes.

TODO

- [ ] Public: use `resolveEnvironment` in evaluate‑batch and bootstrap with header precedence over body
- [ ] Admin/Audit: switch to `cursor` pagination and add `{ page }` metadata
- [ ] Admin/Environments: add `cursor` pagination + `{ page }`; consider `key` (slug) in create/update
- [ ] Admin/DELETE: return `204 No Content` across delete endpoints
- [ ] Admin/Flags: optionally support `PATCH /flags/:id { enabled }` as canonical; keep action routes as aliases
- [ ] Cross‑cutting: apply `z.coerce.number()/boolean()` to all query params
- [ ] Cross‑cutting: unify error responses via helper or `ctx.error`
- [ ] Config: add `ETag`/`If-None-Match` handling (optional), document caching
- [ ] Health: add `HEAD` and `?verbose=1` (optional)
- [ ] Docs & SDK: update docs and client types/samples to match the finalized shapes

Notes

- Prefer ideal, convention‑aligned design over backwards compatibility. Add aliases only if trivial and low‑risk.
