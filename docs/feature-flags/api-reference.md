# API Reference

Complete API documentation for the Better Auth Feature Flags plugin.

## API Architecture

The feature flags plugin follows Better Auth's architectural pattern:

- Server API: flat methods on `auth.api.*` (e.g., `auth.api.evaluateFeatureFlag`, `auth.api.createFeatureFlag`)
- Client API: namespaced methods on `authClient.featureFlags.*` (e.g., `authClient.featureFlags.evaluate`, `authClient.featureFlags.admin.flags.create`)

Server methods are exported using keys from the plugin’s endpoints object. Client methods are derived from endpoint paths and organized under the feature-flags namespace for clarity.

## Server API

### Plugin Initialization

```typescript
import { betterAuth } from "better-auth";
import { featureFlags } from "better-auth-feature-flags";

const auth = betterAuth({
  plugins: [featureFlags(options)],
});
```

### Evaluation API

#### `evaluateFeatureFlag()`

Evaluate a single feature flag for the current context.

```typescript
const result = await auth.api.evaluateFeatureFlag({
  body: {
    flagKey: string,
    context?: { userId?: string; organizationId?: string; attributes?: Record<string, any> },
    default?: any,
    select?: 'value' | 'full' | Array<'value'|'variant'|'reason'|'metadata'>,
    environment?: string,
    track?: boolean,
    debug?: boolean,
    contextInResponse?: boolean,
  },
});
// Returns (default): { value, variant?, reason, metadata?, evaluatedAt, context? }
// Returns (select: 'value'): { value, evaluatedAt, context? }
```

**Evaluation Reasons:**

- `"rule_match"` - A targeting rule matched
- `"override"` - User has an override
- `"percentage_rollout"` - Percentage rollout matched
- `"default"` - Default value returned
- `"disabled"` - Flag is disabled
- `"not_found"` - Flag doesn't exist

#### `evaluateFeatureFlags()`

Evaluate multiple flags in a single request.

```typescript
const { flags } = await auth.api.evaluateFeatureFlags({
  body: {
    flagKeys: string[],
    defaults?: Record<string, any>,
    context?: { userId?: string; organizationId?: string; attributes?: Record<string, any> },
    select?: 'value' | 'full' | Array<'value'|'variant'|'reason'|'metadata'>,
    environment?: string,
    track?: boolean,
    debug?: boolean,
    contextInResponse?: boolean,
  },
});
// Returns: { flags: Record<string, { value: any; variant?: string; reason: string; metadata?: any }>, evaluatedAt: string, context?: object }
```

#### `bootstrapFeatureFlags()`

Get all enabled flags for a user.

```typescript
const { flags, evaluatedAt, context } = await auth.api.bootstrapFeatureFlags({
  body: {
    context?: { userId?: string; organizationId?: string; attributes?: Record<string, any> },
    include?: string[],
    prefix?: string,
    select?: 'value' | 'full' | Array<'value'|'variant'|'reason'|'metadata'>,
    environment?: string,
    track?: boolean,
    debug?: boolean,
  },
});

// Returns: { flags: Record<string, { value: any; variant?: string; reason: string }>|Record<string, any>, evaluatedAt: string, context: object }
```

Note: High-level helpers like `isEnabled()` and `getVariant()` are available on the client SDK.

### Admin API

#### Flag Management

##### `createFeatureFlag()`

Create a new feature flag.

```typescript
const flag = await auth.api.createFeatureFlag({
  body: {
    key: string,
    name: string,
    description?: string,
    type: "boolean" | "string" | "number" | "json",
    enabled?: boolean,
    defaultValue?: any,
    rolloutPercentage?: number,
    organizationId?: string,
    variants?: Array<{ key: string; weight: number; value: any }>,
    metadata?: Record<string, any>,
  },
});

// Returns: FeatureFlag
```

<!-- Single-flag fetch is available via getFeatureFlag(id). -->

##### `listFeatureFlags()`

List all flags with pagination.

```typescript
const { flags, page } = await auth.api.listFeatureFlags({
  query: {
    organizationId?: string,
    cursor?: string,
    limit?: number,
    q?: string,
    sort?: string,
    type?: 'boolean'|'string'|'number'|'json',
    enabled?: boolean,
    prefix?: string,
    include?: 'stats',
  },
});

// Returns: { flags: FeatureFlag[], page: { nextCursor?: string, limit: number, hasMore: boolean } }
```

##### `updateFeatureFlag()`

Update an existing flag.

```typescript
const updated = await auth.api.updateFeatureFlag({
  body: { id: string, key?: string, name?: string, description?: string, enabled?: boolean, type?: FlagType, defaultValue?: any, rolloutPercentage?: number },
});

// Returns: FeatureFlag
```

##### `deleteFeatureFlag()`

Delete a flag and all associated data.

```typescript
await auth.api.deleteFeatureFlag({ body: { id } });

// Returns: void
```

#### Rule Management

##### `createFeatureFlagRule()`

Add a targeting rule to a flag.

```typescript
const rule = await auth.api.createFeatureFlagRule({
  body: { flagId: string, priority: number, conditions: RuleConditions, value: any, variant?: string },
});

// Returns: FlagRule
```

**Rule Conditions Structure:**

```typescript
interface RuleConditions {
  operator?: "AND" | "OR"; // Default: "AND"
  conditions: Array<
    SimpleCondition | RuleConditions // Nested conditions
  >;
  not?: RuleConditions; // Negation
}

interface SimpleCondition {
  attribute: string; // Attribute path (e.g., "user.role")
  operator: ConditionOperator;
  value: any;
}

type ConditionOperator =
  | "equals"
  | "not_equals"
  | "contains"
  | "not_contains"
  | "starts_with"
  | "ends_with"
  | "in"
  | "not_in"
  | "greater_than"
  | "less_than"
  | "greater_than_or_equal"
  | "less_than_or_equal"
  | "regex";
```

##### `listFeatureFlagRules()`

Get all rules for a flag.

```typescript
const { rules } = await auth.api.listFeatureFlagRules({
  params: { flagId: string },
});

// Returns: { rules: FlagRule[] }
```

<!-- Rule update/delete endpoints are not currently provided. -->

#### Override Management

::: warning Server-Side Overrides
These are server-side overrides for specific users, different from client-side local overrides. Server overrides persist across sessions while client overrides are temporary and blocked in production.
:::

##### `createFeatureFlagOverride()`

Create a user-specific override.

```typescript
const override = await auth.api.createFeatureFlagOverride({
  body: { flagId: string, userId: string, value: any, enabled?: boolean, variant?: string, expiresAt?: string },
});

// Returns: FlagOverride
```

##### `listFeatureFlagOverrides()`

Get overrides for a flag or user.

````typescript
const { overrides, page } = await auth.api.listFeatureFlagOverrides({
  query: { flagId?: string, userId?: string, cursor?: string, limit?: number, q?: string, sort?: string },
});

<!-- Override delete endpoint is not currently provided. -->

### Analytics API

#### `createFeatureFlagEvent()`

Track custom events for analytics. (Canonical method, replaces deprecated `trackEvent()`)

```typescript
// Single event tracking with idempotency support
await auth.api.createFeatureFlagEvent({
  body: {
    flagKey: string,
    event: string,
    properties?: number | Record<string, any>,
    timestamp?: string, // RFC3339
    sampleRate?: number,
  },
}, {
  headers: { 'Idempotency-Key': 'unique-key' },
});

// Returns: { success: boolean, eventId: string }
```

#### `createFeatureFlagEventBatch()`

Track multiple events at once.

```typescript
// Batch event tracking
await auth.api.createFeatureFlagEventBatch({
  body: {
    events: Array<{
      flagKey: string,
      event: string,
      properties?: number | Record<string, any>,
      timestamp?: string, // RFC3339
      sampleRate?: number,
    }>,
    sampleRate?: number,
    idempotencyKey?: string,
  },
});

// Returns: { success: number, failed: number, batchId: string }
```

**Idempotency Support:**
- Use `Idempotency-Key` header for single-event requests
- Use top-level `idempotencyKey` for batch requests
- Recommended for payment events, conversions, and critical analytics

<!-- Use adminGetStats endpoint documented in the server API section. -->

### Audit API

#### `listFeatureFlagAuditEntries()`

Retrieve audit log entries.

```typescript
const { entries } = await auth.api.listFeatureFlagAuditEntries({
  query: {
    flagId?: string,
    userId?: string,
    action?: "create" | "update" | "delete" | "evaluate",
    start?: string,
    end?: string,
    limit?: number,
    offset?: number,
  },
});

// Returns: { entries: AuditEntry[] }
```

**Audit Actions:**

- `"flag.created"`
- `"flag.updated"`
- `"flag.deleted"`
- `"rule.created"`
- `"rule.updated"`
- `"rule.deleted"`
- `"override.created"`
- `"override.deleted"`

### Cache Management

Cache invalidation occurs automatically on admin create/update/delete operations.

## Client API

### Client Initialization

```typescript
import { createAuthClient } from "better-auth/client";
import { featureFlagsClient } from "better-auth-feature-flags/client";

const client = createAuthClient({
  plugins: [featureFlagsClient(options)],
});
```

### Client Methods

#### `isEnabled()`

Check if a feature is enabled for the current user.

```typescript
const enabled: boolean = await client.featureFlags.isEnabled(
  key: string,
  defaultValue?: boolean
);
```

#### `getValue()`

Get the value of any flag type.

```typescript
const value: T = await client.featureFlags.getValue<T>(
  key: string,
  defaultValue?: T
);
```

#### `getVariant()`

Get A/B test variant assignment.

```typescript
const variant = await client.featureFlags.getVariant(
  key: string
);

// Returns: string | null (variant key)
```

#### `bootstrap()`

Get all evaluated flags for the current user. (Canonical method, replaces deprecated `getAllFlags()`)

```typescript
const flags: Record<string, any> = await client.featureFlags.bootstrap();
```

#### `track()`

Track conversion or custom events with idempotency support. (Canonical method, replaces deprecated `trackEvent()`)

```typescript
// Basic event tracking
await client.featureFlags.track(
  flagKey: string,
  event: string,
  value?: number | Record<string, any>
);

// With idempotency key (NEW in v0.2.0)
await client.featureFlags.track(
  flagKey: string,
  event: string,
  value?: number | Record<string, any>,
  { idempotencyKey: string }
);

// Batch tracking (NEW in v0.2.0)
await client.featureFlags.trackBatch([
  {
    flag: string,
    event: string,
    data?: number | Record<string, any>,
    timestamp?: Date,
    idempotencyKey?: string,
  }
], batchId?: string);
```

### Admin Client API (NEW in v0.2.0)

The client SDK now includes organized admin operations under the `authClient.featureFlags.admin` namespace:

```typescript
// Admin flag management
await authClient.featureFlags.admin.flags.create({ key: "new-flag", type: "boolean" });
await authClient.featureFlags.admin.flags.list();
await authClient.featureFlags.admin.flags.update("flag-id", { enabled: false });
await authClient.featureFlags.admin.flags.delete("flag-id");

// Admin rule management
await authClient.featureFlags.admin.rules.create({ flagId: "flag-id", conditions: {...} });
await authClient.featureFlags.admin.rules.list("flag-id");

// Admin override management
await authClient.featureFlags.admin.overrides.create({ flagId: "flag-id", userId: "user-123" });
await authClient.featureFlags.admin.overrides.list({ flagId: "flag-id" });

// Admin analytics
await authClient.featureFlags.admin.analytics.stats.get("flag-id");
await authClient.featureFlags.admin.analytics.usage.get();

// Admin audit
await authClient.featureFlags.admin.audit.list({ flagId: "flag-id" });
```

#### `setOverride()`

Set a local override for testing (development only).

::: danger Production Safety
Overrides are automatically disabled in production environments to prevent debug features from being exposed.
:::

```typescript
// Development only - no effect in production
client.featureFlags.setOverride(
  flag: string,
  value: any
);
```

#### `clearOverrides()`

Clear all local overrides.

```typescript
client.featureFlags.clearOverrides();
```

## React Hooks

### Setup

```tsx
import { FeatureFlagsProvider } from "better-auth-feature-flags/react";

function App() {
  return (
    <FeatureFlagsProvider client={authClient}>
      {/* Your app */}
    </FeatureFlagsProvider>
  );
}
```

### Hooks

#### `useFeatureFlag()`

```tsx
import { useFeatureFlag } from "better-auth-feature-flags/react";

function Component() {
  const isEnabled = useFeatureFlag("feature-key", false);

  return isEnabled ? <NewFeature /> : <OldFeature />;
}
```

#### `useFeatureFlags()`

```tsx
import { useFeatureFlags } from "better-auth-feature-flags/react";

function Component() {
  const flags = useFeatureFlags();

  return (
    <div>
      {flags["feature-1"] && <Feature1 />}
      {flags["feature-2"] === "variant-a" && <VariantA />}
    </div>
  );
}
```

#### `useVariant()`

```tsx
import { useVariant } from "better-auth-feature-flags/react";

function Component() {
  const variant = useVariant("test-key");

  switch (variant?.key) {
    case "control":
      return <ControlVersion />;
    case "variant":
      return <VariantVersion />;
    default:
      return <DefaultVersion />;
  }
}
```

## REST API Endpoints

All endpoints are prefixed with your Better Auth API path (default: `/api/auth`).

### Public Endpoints

#### `POST /feature-flags/evaluate`

Evaluate a single flag.

**Headers:**

```
Authorization: Bearer <token>
x-organization-id: <org-id> (optional)
```

**Response:**

```json
{
  "value": true,
  "variant": "control",
  "reason": "rule_match"
}
```

#### `POST /feature-flags/evaluate-batch`

Evaluate multiple flags.

**Request Body:**

```json
{
  "flagKeys": ["flag-1", "flag-2"],
  "defaults": {
    "flag-1": false
  }
}
```

**Response:**

```json
{
  "flag-1": {
    "value": true,
    "reason": "percentage_rollout"
  },
  "flag-2": {
    "value": "blue",
    "reason": "default"
  }
}
```

#### `POST /feature-flags/bootstrap`

Get all enabled flags for bootstrap.

**Response:**

```json
{
  "feature-1": true,
  "feature-2": "value",
  "feature-3": { "nested": "data" }
}
```

#### `POST /feature-flags/events`

Track a single event.

**Request Body:**

```json
{
  "flagKey": "checkout-test",
  "event": "purchase",
  "value": 99.99
}
```

### Admin Endpoints

All admin endpoints require authentication and appropriate permissions.

Admin endpoints are under `/feature-flags/admin/...`.

#### `GET /feature-flags/admin/flags`

List all flags.

**Query Parameters:**

- `page` (number): Page number
- `limit` (number): Items per page
- `enabled` (boolean): Filter by status
- `search` (string): Search term

#### `POST /feature-flags/admin/flags`

Create a new flag.

**Request Body:**

```json
{
  "key": "new-feature",
  "type": "boolean",
  "enabled": true,
  "defaultValue": false,
  "rolloutPercentage": 25
}
```

#### `GET /feature-flags/admin/flags/:id`

Get flag details.

#### `PATCH /feature-flags/admin/flags/:id`

Update a flag.

#### `DELETE /feature-flags/admin/flags/:id`

Delete a flag.

#### `GET /feature-flags/admin/flags/:flagId/rules`

Get flag rules.

#### `POST /feature-flags/admin/flags/:flagId/rules`

Create a rule.

#### `PATCH /feature-flags/admin/flags/:flagId/rules/:ruleId`

Update a rule.

#### `DELETE /feature-flags/admin/flags/:flagId/rules/:ruleId`

Delete a rule.

#### `GET /feature-flags/admin/overrides`

Get flag overrides.

#### `POST /feature-flags/admin/overrides`

Create an override.

#### `DELETE /feature-flags/admin/overrides/:id`

Delete an override.

#### `GET /feature-flags/admin/flags/:id/stats`

Get flag statistics.

#### `GET /feature-flags/admin/audit`

Get audit log.

## WebSocket API (Planned)

Real-time flag updates via WebSocket.

```typescript
// Connect to WebSocket
const ws = client.featureFlags.subscribe();

// Listen for updates
ws.on("flag:updated", (flag) => {
  console.log("Flag updated:", flag.key);
});

ws.on("flag:deleted", (flagKey) => {
  console.log("Flag deleted:", flagKey);
});

// Unsubscribe
ws.close();
```

## Error Handling

### Error Types

```typescript
class FeatureFlagError extends Error {
  code: ErrorCode;
  details?: any;
}

enum ErrorCode {
  FLAG_NOT_FOUND = "FLAG_NOT_FOUND",
  INVALID_FLAG_TYPE = "INVALID_FLAG_TYPE",
  EVALUATION_ERROR = "EVALUATION_ERROR",
  PERMISSION_DENIED = "PERMISSION_DENIED",
  VALIDATION_ERROR = "VALIDATION_ERROR",
  STORAGE_ERROR = "STORAGE_ERROR",
  RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED",
}
```

### Error Handling Example

```typescript
try {
  const result = await auth.api.evaluateFeatureFlag({
    body: { flagKey: "my-flag" },
  });
} catch (error) {
  if (error instanceof FeatureFlagError) {
    switch (error.code) {
      case ErrorCode.FLAG_NOT_FOUND:
        // Use default value
        break;
      case ErrorCode.EVALUATION_ERROR:
        // Log and use fallback
        break;
      default:
      // Handle other errors
    }
  }
}
```

## Type Definitions

### Core Types

```typescript
interface FeatureFlag {
  id: string;
  key: string;
  name?: string;
  description?: string;
  type: FlagType;
  enabled: boolean;
  defaultValue?: any;
  rolloutPercentage?: number;
  organizationId?: string;
  variants?: Variant[];
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

type FlagType = "boolean" | "string" | "number" | "json";

interface Variant {
  key: string;
  weight: number;
  value: any;
  metadata?: Record<string, any>;
}

interface FlagRule {
  id: string;
  flagId: string;
  priority: number;
  name?: string;
  conditions: RuleConditions;
  value: any;
  percentage?: number;
  enabled: boolean;
  createdAt: Date;
}

interface FlagOverride {
  id: string;
  flagId: string;
  userId: string;
  value: any;
  reason?: string;
  expiresAt?: Date;
  createdAt: Date;
}

interface EvaluationResult {
  value: any;
  variant?: string;
  reason: EvaluationReason;
  metadata?: Record<string, any>;
}

type EvaluationReason =
  | "rule_match"
  | "override"
  | "percentage_rollout"
  | "default"
  | "disabled"
  | "not_found";

interface EvaluationContext {
  userId?: string;
  email?: string;
  role?: string;
  organizationId?: string;
  attributes?: Record<string, any>;
  device?: DeviceInfo;
  geo?: GeoInfo;
}
```

### Field Semantics (Authoritative)

- key
  - Unique, URL‑safe identifier (alphanumeric, `-`, `_`); recommended immutable.
  - Used in consistent hashing with `userId` for sticky rollout/variants.
- name
  - Human‑readable display name; safe to change without affecting evaluation.
- description
  - Optional long text for docs/discovery; not used in evaluation.
- type
  - One of `boolean | string | number | json`. `defaultValue` and rule values should match this type.
- enabled
  - When `false`, evaluation returns `defaultValue` with reason `"disabled"`.
- defaultValue
  - Safe fallback when no rule/override/rollout applies. Must be compatible with `type`.
- rolloutPercentage
  - Integer 0–100. Sticky assignment via consistent hashing of `userId:key`.
  - If no `userId`, assignment is consistent for anonymous cohort (same hash seed).
- variants
  - Array of `{ key, value, weight }`. Weights must sum to 100.
  - EvaluationResult.variant is the variant key (string).
- metadata
  - Free‑form JSON for tooling and UI. Not part of evaluation logic.
- organizationId
  - Multi‑tenant scope. Required when multi‑tenancy is enabled.
- createdAt / updatedAt
  - Timestamps. Dates in SDK types; serialized as ISO strings over HTTP.

See also: Flag authoring Do/Don’t in Quickstart for practical guidance.

## Rate Limits

Default rate limits (built-in):

| Endpoint Path                        | Limit    | Window |
| ------------------------------------ | -------- | ------ |
| `/feature-flags/evaluate*`           | 100/min  | 60s    |
| `/feature-flags/evaluate-batch`      | 1000/min | 60s    |
| `/feature-flags/admin/*`             | 20/min   | 60s    |

Note: These defaults are defined by the plugin’s `rateLimit` settings.

## Response Codes

| Code | Description           |
| ---- | --------------------- |
| 200  | Success               |
| 201  | Created               |
| 204  | No Content            |
| 400  | Bad Request           |
| 401  | Unauthorized          |
| 403  | Forbidden             |
| 404  | Not Found             |
| 409  | Conflict              |
| 429  | Too Many Requests     |
| 500  | Internal Server Error |

## SDK Support

Official SDKs:

- ✅ JavaScript/TypeScript
- ✅ React
- ✅ Next.js
- 🔜 Vue (planned)
- 🔜 Svelte (planned)
- 🔜 React Native (planned)
- 🔜 Flutter (planned)

## Migration Guide

### From v0.1.x to v0.2.0

```typescript
// Old API (v0.1.x) - basic setup
const enabled = await featureFlags.isEnabled("flag");

// New API (v0.2.0) - canonical naming
const result = await auth.api.evaluateFeatureFlag({
  body: { flagKey: "flag" },
});
const enabled = result.value;
```

## Performance Benchmarks

| Operation         | P50   | P95   | P99   |
| ----------------- | ----- | ----- | ----- |
| Single evaluation | 2ms   | 10ms  | 50ms  |
| Batch (10 flags)  | 5ms   | 20ms  | 100ms |
| Cache hit         | 0.1ms | 0.5ms | 1ms   |
| Rule evaluation   | 1ms   | 5ms   | 20ms  |

## Support

- GitHub Issues: [Report bugs](https://github.com/better-auth/plugins/issues)
- Documentation: [Full docs](https://better-auth.com/plugins/feature-flags)
- Discord: [Community support](https://discord.gg/better-auth)
Admin client plugin

- Public runtime uses `better-auth-feature-flags/client` only.
- Admin surfaces should add `better-auth-feature-flags/admin` alongside the public client.

```ts
import { createAuthClient } from "better-auth/client";
import { featureFlagsClient } from "better-auth-feature-flags/client";
import { featureFlagsAdminClient } from "better-auth-feature-flags/admin";

// Public runtime
createAuthClient({ plugins: [featureFlagsClient()] });

// Admin runtime
createAuthClient({ plugins: [featureFlagsClient(), featureFlagsAdminClient()] });
```
````
