# Feature Flags API (Server, HTTP, Client)

## API Endpoints (Server ↔ HTTP ↔ Client)

Left column uses canonical server method names (`auth.api.*`) and matches OpenAPI `operationId`.
The right column shows the exact client alias and labels whether it is public or admin.

### Public runtime (session-authenticated)

- `auth.api.evaluateFeatureFlag` ↔ `POST /feature-flags/evaluate` ↔ `authClient.featureFlags.evaluate`
- `auth.api.evaluateFeatureFlags` ↔ `POST /feature-flags/evaluate-batch` ↔ `authClient.featureFlags.evaluateMany`
- `auth.api.bootstrapFeatureFlags` ↔ `POST /feature-flags/bootstrap` ↔ `authClient.featureFlags.bootstrap`
- `auth.api.createFeatureFlagEvent` ↔ `POST /feature-flags/events` ↔ `authClient.featureFlags.track`
- `auth.api.createFeatureFlagEventBatch` ↔ `POST /feature-flags/events/batch` ↔ `authClient.featureFlags.trackBatch`

### Admin (server-side; not exposed by default in public client)

- `auth.api.listFeatureFlags` ↔ `GET /feature-flags/admin/flags` ↔ `authClient.featureFlags.admin.flags.list`
- `auth.api.createFeatureFlag` ↔ `POST /feature-flags/admin/flags` ↔ `authClient.featureFlags.admin.flags.create`
- `auth.api.getFeatureFlag` ↔ `GET /feature-flags/admin/flags/{id}` ↔ `authClient.featureFlags.admin.flags.get`
- `auth.api.updateFeatureFlag` ↔ `PATCH /feature-flags/admin/flags/{id}` ↔ `authClient.featureFlags.admin.flags.update`
- `auth.api.deleteFeatureFlag` ↔ `DELETE /feature-flags/admin/flags/{id}` ↔ `authClient.featureFlags.admin.flags.delete`
- `auth.api.enableFeatureFlag` ↔ `POST /feature-flags/admin/flags/{id}/enable` ↔ `authClient.featureFlags.admin.flags.enable`
- `auth.api.disableFeatureFlag` ↔ `POST /feature-flags/admin/flags/{id}/disable` ↔ `authClient.featureFlags.admin.flags.disable`

### Rules (per-flag; admin)

- `auth.api.listFeatureFlagRules` ↔ `GET /feature-flags/admin/flags/{flagId}/rules` ↔ `authClient.featureFlags.admin.rules.list`
- `auth.api.createFeatureFlagRule` ↔ `POST /feature-flags/admin/flags/{flagId}/rules` ↔ `authClient.featureFlags.admin.rules.create`
- `auth.api.getFeatureFlagRule` ↔ `GET /feature-flags/admin/flags/{flagId}/rules/{ruleId}` ↔ `authClient.featureFlags.admin.rules.get`
- `auth.api.updateFeatureFlagRule` ↔ `PATCH /feature-flags/admin/flags/{flagId}/rules/{ruleId}` ↔ `authClient.featureFlags.admin.rules.update`
- `auth.api.deleteFeatureFlagRule` ↔ `DELETE /feature-flags/admin/flags/{flagId}/rules/{ruleId}` ↔ `authClient.featureFlags.admin.rules.delete`
- `auth.api.reorderFeatureFlagRules` ↔ `POST /feature-flags/admin/flags/{flagId}/rules/reorder` ↔ `authClient.featureFlags.admin.rules.reorder`

Reorder request body: `POST .../reorder` with `{ ids: string[] }` (full new order).

### Overrides (admin)

- `auth.api.listFeatureFlagOverrides` ↔ `GET /feature-flags/admin/overrides` ↔ `authClient.featureFlags.admin.overrides.list`
- `auth.api.createFeatureFlagOverride` ↔ `POST /feature-flags/admin/overrides` ↔ `authClient.featureFlags.admin.overrides.create`
- `auth.api.getFeatureFlagOverride` ↔ `GET /feature-flags/admin/overrides/{id}` ↔ `authClient.featureFlags.admin.overrides.get`
- `auth.api.updateFeatureFlagOverride` ↔ `PATCH /feature-flags/admin/overrides/{id}` ↔ `authClient.featureFlags.admin.overrides.update`
- `auth.api.deleteFeatureFlagOverride` ↔ `DELETE /feature-flags/admin/overrides/{id}` ↔ `authClient.featureFlags.admin.overrides.delete`

### Analytics (admin)

- `auth.api.getFeatureFlagStats` ↔ `GET /feature-flags/admin/flags/{flagId}/stats` ↔ `authClient.featureFlags.admin.analytics.stats.get`
- `auth.api.getFeatureFlagsUsageMetrics` ↔ `GET /feature-flags/admin/metrics/usage` ↔ `authClient.featureFlags.admin.analytics.usage.get`
- `auth.api.exportFeatureFlagData` ↔ `POST /feature-flags/admin/export` ↔ `authClient.featureFlags.admin.exports.create`

Admin client (analytics) aliases

- `authClient.featureFlags.admin.analytics.stats.get(flagId, query?)`
- `authClient.featureFlags.admin.analytics.usage.get(query?)`

### Audit (admin)

- `auth.api.listFeatureFlagAuditEntries` ↔ `GET /feature-flags/admin/audit` ↔ `authClient.featureFlags.admin.audit.list`
- `auth.api.getFeatureFlagAuditEntry` ↔ `GET /feature-flags/admin/audit/{id}` ↔ `authClient.featureFlags.admin.audit.get`

### Environments (admin)

- `auth.api.listFeatureFlagEnvironments` ↔ `GET /feature-flags/admin/environments` ↔ `authClient.featureFlags.admin.environments.list`
- `auth.api.createFeatureFlagEnvironment` ↔ `POST /feature-flags/admin/environments` ↔ `authClient.featureFlags.admin.environments.create`
- `auth.api.updateFeatureFlagEnvironment` ↔ `PATCH /feature-flags/admin/environments/{id}` ↔ `authClient.featureFlags.admin.environments.update`
- `auth.api.deleteFeatureFlagEnvironment` ↔ `DELETE /feature-flags/admin/environments/{id}` ↔ `authClient.featureFlags.admin.environments.delete`

### Health & Config

- `auth.api.getFeatureFlagsConfig` ↔ `GET /feature-flags/config` ↔ `authClient.featureFlags.config`
- `auth.api.checkFeatureFlagsHealth` ↔ `GET /feature-flags/health` ↔ (none)

Config semantics: `getFeatureFlagsConfig` returns a read-only, public-safe subset of server configuration for client introspection (avoid leaking sensitive/internal fields).

See [api-map.json](./api-map.json) — the machine‑readable, canonical source that maps OpenAPI operationIds to HTTP routes and client aliases for programmatic use by tools and agents.

## Client Integration

- Server plugin: add `featureFlags()` to `auth({ plugins: [...] })` on the server.
- Public client: add `featureFlagsClient()` to `createAuthClient({ plugins: [...] })` to use `authClient.featureFlags.evaluate|evaluateMany|bootstrap|track`.
- Admin client: add `featureFlagsAdminClient()` only in admin surfaces. Exposes `authClient.featureFlags.admin.*` (e.g., `list`, `create`, `updateRule`). Do not include in public bundles.
- Access control: enforce admin authorization on the server; do not set `SERVER_ONLY: true` for endpoints meant to be exposed via the admin client.
- Mapping: admin client methods mirror server names 1:1 unless an alias is provided.
  - To keep aliases short without ambiguity, prefer grouped admin namespaces: `authClient.featureFlags.admin.flags.*`, `rules.*`, `overrides.*`, `audit.*`, `environments.*`, `analytics.*` (e.g., `admin.flags.list`, `admin.rules.update`).

### Admin Client Namespace Structure (aliases)

Use a nested `admin` namespace to clearly separate public vs admin APIs. Method names under a specific group can be short because the group disambiguates them. These are aliases that map 1:1 to server endpoints.

```ts
authClient.featureFlags.admin = {
  flags: { list, create, get, update, delete, enable, disable },
  rules: { list, create, get, update, delete, reorder },
  overrides: { list, create, get, update, delete },
  audit: { list, get },
  environments: { list, create, update, delete },
  analytics: {
    stats: { get },   // GET /feature-flags/admin/flags/{flagId}/stats
    usage: { get },   // GET /feature-flags/admin/metrics/usage
  },
  exports: { create }, // POST /feature-flags/admin/export
}
```

Notes

- Do not include the admin client in public bundles by default; publish it as a separate plugin/bundle.
- Prefer `analytics.stats.get` and `analytics.usage.get` over `getStats`/`getUsage` to avoid stutter within the group.
- Keep `exports` separate from `analytics` because the HTTP path is `/export`, not under `/metrics`.

## Naming Decision Aids

- Runtime vs Admin: use “evaluate\*” for runtime evaluation; use `getX`/`listXs` for admin listing.
- Single vs Batch: provide both and mirror core patterns (e.g., `revokeSession` vs `revokeSessions`); avoid overloading with flags like `{ all: true }`.

Notes

- Endpoints use kebab-case paths; do not camelCase URL segments.
- Do not set `SERVER_ONLY: true` on endpoints you plan to expose via an admin client plugin; that flag permanently hides them from route inference.
- Namespace for this plugin’s admin client should be `authClient.featureFlags.admin.*` (path `/feature-flags/admin/...`).
- Reserve `SERVER_ONLY: true` for endpoints that must never be callable from clients.
- Where to set `SERVER_ONLY`: on the server route definition via `options.metadata.SERVER_ONLY`.
  - Endpoints with this flag are excluded from OpenAPI generation and client route inference.
  - If you plan to expose an admin client wrapper, do not set this flag; instead, enforce access with auth/roles on the server and publish a separate admin client plugin.
  - Example (illustrative):
    - `createFeatureFlag: { metadata: { SERVER_ONLY: true } } // never exposed to clients/OpenAPI`
    - `listFeatureFlags: { metadata: {} } // visible to OpenAPI; expose via admin client plugin`
- Naming clarity: prefer "Stats" for per-flag product analytics; use "UsageMetrics" for operational/health telemetry across flags.
- Error codes: export an `ERROR_CODES` map and reference codes in responses/docs/tests for machine-readable failures.
- Health check naming: prefer verb+resource action `checkFeatureFlagsHealth` (operationId matches server name); path remains `GET /feature-flags/health`. Consider `SERVER_ONLY: true` if you do not want it in OpenAPI or client route inference.
- Usage metrics scope: use pluralized server name `getFeatureFlagsUsageMetrics` to signal cross-flag scope.
- Paths for metrics: prefer family-specific paths like `/feature-flags/admin/metrics/usage` to leave room for additional metric families without query-controlled behavior.
- Future-proofing: reserve `/feature-flags/admin/flags/{flagId}/metrics` for potential per-flag operational metrics; do not overload `stats` or the global metrics endpoint.
- Queries and schemas: support common query params (`from`, `to`, `window`, `env`) where applicable and keep response types stable and distinct between stats vs usage metrics.
