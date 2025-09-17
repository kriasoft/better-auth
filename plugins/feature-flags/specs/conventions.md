# Packaging & Import Conventions

## Decision: Client import path

- Import the client plugin from `better-auth-feature-flags/client`.
- Import the server plugin from `better-auth-feature-flags`.

## Decision: Separate Admin Client Bundle

- Import the admin client plugin from `better-auth-feature-flags/admin` and add it only to admin surfaces.
- Do NOT include the admin client in public bundles by default. Keep public bundles lean and avoid shipping admin-only routes.

### Rationale

- Mirrors Better Auth guidance (see vendor/better-auth docs for the Admin plugin) where admin capabilities are a dedicated client plugin.
- Improves tree-shaking and reduces risk by not exposing admin code in public apps.

### Usage

```ts
import { createAuthClient } from "better-auth/client";
import { featureFlagsClient } from "better-auth-feature-flags/client";
import { featureFlagsAdminClient } from "better-auth-feature-flags/admin";

// Public surfaces
createAuthClient({ plugins: [featureFlagsClient()] });

// Admin surfaces
createAuthClient({
  plugins: [featureFlagsClient(), featureFlagsAdminClient()],
});
```

Notes

- Admin endpoints enforce authorization on the server; splitting the client does not relax server checks.
- Avoid setting `SERVER_ONLY: true` on endpoints intended to be exposed via the admin client; enforce access with roles/middleware.

### Rationale

- Aligns with Better Auth’s conventions in `vendor/better-auth/`:
  - Core client SDK imports use `better-auth/client`.
  - External plugin client imports use the `/client` suffix (e.g., `@better-auth/stripe/client`).
- Keeps server and client bundles clearly separated and tree‑shakeable.

### Usage

```ts
// Server (register plugin)
import { featureFlags } from "better-auth-feature-flags";

// Client (public runtime)
import { featureFlagsClient } from "better-auth-feature-flags/client";
```

Notes

- This file is the canonical place for packaging/import requirements for this plugin. Add similar requirements here as they are decided.
