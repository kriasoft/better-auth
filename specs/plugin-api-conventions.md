# API Naming Guidelines for Better Auth Plugins

Sources reviewed: vendor/better-auth (core code, plugins, tests, docs), internal usage patterns (`auth.api.*`, `authClient.*`, endpoint paths, OpenAPI generator).

## Goals

- Flat, globally unique server API (`auth.api.*`) with clear, consistent verbs.
- Ergonomic client API (`authClient.*`) using namespacing to reduce verbosity.
- Descriptive, conflict-free HTTP paths with predictable REST semantics.
- Avoid overloading; keep behavior, types, and observability clean.

## Server Methods (`auth.api.*`)

- Flat namespace: do NOT nest by plugin (e.g., no `auth.api.featureFlags.*`).
- Global uniqueness: method keys must not collide with core or other plugins.
- Verb + Resource: use clear action verbs with resource-qualified names.
  - CRUD: `createX`, `getX` (single), `listXs` (collection), `updateX`, `deleteX`.
  - Actions: `verifyX`, `enableX`/`disableX`, `revokeX`/`revokeXs`, `linkX`/`unlinkX`, `refreshX`, `generateX`, `sendX`, `checkX`, `approveX`/`denyX`, `signInX`/`signOut`.
- Collections: prefer `listXs` over `getAllXs` (matches core patterns).
- Special domain verbs OK when clearer than CRUD (e.g., `signInSSO`, `evaluateFeatureFlags`).
- Avoid plugin prefixes in names (e.g., prefer `createFeatureFlagOverride` over `featureFlagsCreateOverride`).
- Single vs plural endpoints should have distinct names (e.g., `revokeSession` vs `revokeSessions`).
- Do not overload one method with multiple shapes/behaviors (e.g., avoid `{ all: true }` toggles).
- Align OpenAPI `operationId` with the server method name for clarity.

Examples

- Good: `createApiKey`, `verifyApiKey`, `listApiKeys`, `deleteAllExpiredApiKeys`.
- Good: `deviceCode`, `deviceToken`, `deviceVerify`, `deviceApprove`, `deviceDeny`.
- Good: `createOIDCProvider`, `signInSSO`.
- Good (feature flags): `evaluateFeatureFlag`, `evaluateFeatureFlags`, `bootstrapFeatureFlags` (or `evaluateAllFeatureFlags`), `createFeatureFlagEvent`.
- Avoid: `getFlag`, `getAllFlags`, generic names likely to collide.

## Client Methods (`authClient.*`)

- Namespaced by plugin/domain to improve DX and reduce verbosity.
  - Pattern: `authClient.<namespace>.<method>` (e.g., `authClient.signIn.email`, `authClient.apiKey.create`).
- Method names can be shorter because the namespace disambiguates them.
  - Example: server `createFeatureFlagEvent` ↔ client `featureFlags.track`.
- Group by user intent: common groups include `signIn`, `twoFactor`, `apiKey`, `device`, `organization`, `featureFlags`.
- Keep lowerCamelCase; avoid stuttering with namespace (not `featureFlags.featureFlagsX`).
- Client methods should map 1:1 to server endpoints (thin wrappers), but may offer friendlier names.
  - Prefer aliases over renaming server method keys.
- Do not expose admin-only operations in public client bundles by default.
- When short aliases could be ambiguous, add one level of grouping under the plugin namespace to disambiguate (e.g., `authClient.featureFlags.admin.flags.list`, `admin.rules.update`).

Examples

- `authClient.signIn.email`, `authClient.signIn.passkey`.
- `authClient.apiKey.create`, `authClient.apiKey.get`, `authClient.apiKey.list`.
- `authClient.twoFactor.enable`, `authClient.twoFactor.verifyTotp`.
- `authClient.featureFlags.evaluate`, `authClient.featureFlags.evaluateMany`, `authClient.featureFlags.bootstrap`, `authClient.featureFlags.track`.

## HTTP Endpoints (Paths + Methods)

- Unique path+method across all installed plugins (core detects conflicts).
- Plugin-scoped base path using kebab-case segments.
  - Examples: `/api-key/create`, `/organization/teams/:teamId`, `/device-authorization/device-code`.
- Nouns for resources; verbs for actions when necessary.
  - CRUD resources: `GET /x`, `POST /x`, `GET /x/:id`, `PATCH /x/:id`, `DELETE /x/:id`.
- Actions: use explicit state changes: `POST /x/:id/enable` and `POST /x/:id/disable`; also `POST /sign-in/sso`, `POST /device/token`.
- Kebab-case segments; avoid camelCase in URLs.
- Separate single vs plural endpoints:
  - Example: `/revoke-session` vs `/revoke-sessions`; `/list-sessions` for listing.
- Avoid overloading a path with flags that change core behavior (prefer dedicated paths: `/evaluate`, `/evaluate-batch`, `/bootstrap`).
- Include `requireHeaders` where headers are needed for session, IP, or UA.
- Document request body under `body`, `headers`, `query` for server-side calls.

Examples (feature flags)

- Single: `POST /feature-flags/evaluate` → `evaluateFeatureFlag`.
- Batch: `POST /feature-flags/evaluate-batch` → `evaluateFeatureFlags`.
- All/subject: `POST /feature-flags/bootstrap` → `bootstrapFeatureFlags` (or `POST /feature-flags/evaluate-all` → `evaluateAllFeatureFlags`).
- Events: `POST /feature-flags/events` → `createFeatureFlagEvent` (client alias: `featureFlags.track`).

## Do / Don’t Checklist

Do

- Use verb+resource names; qualify resources to ensure global uniqueness.
- Use `listXs` (not `getAllXs`) for collections.
- Keep server names flat; client names namespaced.
- Create distinct endpoints for distinct behaviors; keep schemas simple.
- Map OpenAPI `operationId` to the server method name.

Don’t

- Don’t prefix server method names with plugin IDs.
- Don’t overload a single endpoint with multiple unrelated behaviors.
- Don’t leak unreleased features by default (e.g., keep `includeDisabled: false` on bootstrap).
- Don’t use ambiguous names like `getFlag`, `track` without a resource.
- Don’t create duplicate public routes for identical behavior (prefer a single route + client alias; reserve separate routes for genuinely distinct semantics like admin/debug traces).

## Example Mappings (Server ↔ Client ↔ HTTP)

- Server: `createApiKey` ↔ Client: `apiKey.create` ↔ `POST /api-key/create`
- Server: `listPasskeys` ↔ Client: `passkey.list` ↔ `GET /passkey/list`
- Server: `signInSSO` ↔ Client: `signIn.sso` ↔ `POST /sign-in/sso`
- Server: `evaluateFeatureFlags` ↔ Client: `featureFlags.evaluateMany` ↔ `POST /feature-flags/evaluate-batch`
- Server: `createFeatureFlagEvent` ↔ Client: `featureFlags.track` ↔ `POST /feature-flags/events`

## Notes

- Conflict detection: core logs conflicts for duplicated path+method across plugins; it does not detect duplicate server method names — ensure uniqueness.
- Server calls accept `{ body?, headers?, query?, asResponse?, returnHeaders? }`; client calls have friendlier signatures and handle headers.
- `SERVER_ONLY`: set on server route definitions via `options.metadata.SERVER_ONLY`. Endpoints with this flag are excluded from OpenAPI and client route inference; reserve for endpoints that must never be client-callable. If you need an admin client, do not set this flag — restrict via auth/roles and ship a separate admin client plugin.
- Config vs Settings: use “Config” for read-only, server-provided configuration exposed for introspection (e.g., `getXConfig`); use “Settings” only for admin-editable, persisted preferences, and prefer resource-specific settings over a single catch-all.
- Error codes: each plugin should export a stable `ERROR_CODES` map for machine-readable failures; reference these codes in responses and tests, avoid ad-hoc string comparisons.
- Middleware: document per-endpoint middleware (session/auth/roles) in plugin implementation docs; this spec focuses on naming and mappings.
