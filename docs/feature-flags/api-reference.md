# API Reference

Complete API documentation for the Better Auth Feature Flags plugin.

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

#### `evaluate()`

Evaluate a single feature flag for a user.

```typescript
const result = await auth.api.featureFlags.evaluate({
  key: string,              // Required: Flag key
  userId?: string,          // User ID for evaluation
  organizationId?: string,  // Organization context
  attributes?: Record<string, any>, // Custom attributes
  defaultValue?: any        // Fallback if flag not found
});

// Returns: EvaluationResult
{
  value: any,              // The evaluated value
  variant?: string,        // Variant key if applicable
  reason: EvaluationReason, // Why this value was returned
  metadata?: Record<string, any> // Additional data
}
```

**Evaluation Reasons:**

- `"rule_match"` - A targeting rule matched
- `"override"` - User has an override
- `"percentage_rollout"` - Percentage rollout matched
- `"default"` - Default value returned
- `"disabled"` - Flag is disabled
- `"not_found"` - Flag doesn't exist

#### `evaluateBatch()`

Evaluate multiple flags at once.

```typescript
const results = await auth.api.featureFlags.evaluateBatch({
  keys: string[],           // Flag keys to evaluate
  userId?: string,
  organizationId?: string,
  attributes?: Record<string, any>,
  defaults?: Record<string, any> // Default values by key
});

// Returns: Record<string, EvaluationResult>
{
  "flag-1": { value: true, reason: "rule_match" },
  "flag-2": { value: "blue", reason: "default" }
}
```

#### `evaluateAll()`

Get all enabled flags for a user.

```typescript
const flags = await auth.api.featureFlags.evaluateAll({
  userId?: string,
  organizationId?: string,
  attributes?: Record<string, any>
});

// Returns: Record<string, any>
{
  "feature-1": true,
  "feature-2": "value",
  "feature-3": { config: "data" }
}
```

#### `isEnabled()`

Check if a boolean flag is enabled.

```typescript
const enabled = await auth.api.featureFlags.isEnabled({
  key: string,
  userId?: string,
  organizationId?: string,
  attributes?: Record<string, any>
});

// Returns: boolean
```

#### `getVariant()`

Get the variant assignment for an A/B test.

```typescript
const variant = await auth.api.featureFlags.getVariant({
  key: string,
  userId?: string,
  organizationId?: string,
  attributes?: Record<string, any>
});

// Returns: Variant | null
{
  key: string,
  value: any,
  weight: number,
  metadata?: Record<string, any>
}
```

### Admin API

#### Flag Management

##### `admin.featureFlags.create()`

Create a new feature flag.

```typescript
const flag = await auth.api.admin.featureFlags.create({
  key: string,              // Unique identifier
  name?: string,            // Display name
  description?: string,     // Description
  type: "boolean" | "string" | "number" | "json",
  enabled: boolean,         // Is flag active?
  defaultValue?: any,       // Default value
  rolloutPercentage?: number, // 0-100
  organizationId?: string,  // For multi-tenant
  variants?: Variant[],     // A/B test variants
  metadata?: Record<string, any>
});

// Returns: FeatureFlag
```

##### `admin.featureFlags.get()`

Get a flag by ID or key.

```typescript
// By ID
const flag = await auth.api.admin.featureFlags.get(id: string);

// By key
const flag = await auth.api.admin.featureFlags.getByKey(
  key: string,
  organizationId?: string
);

// Returns: FeatureFlag | null
```

##### `admin.featureFlags.list()`

List all flags with pagination.

```typescript
const { flags, total, page } = await auth.api.admin.featureFlags.list({
  organizationId?: string,
  enabled?: boolean,
  type?: FlagType,
  search?: string,          // Search in key/name/description
  page?: number,            // Default: 1
  limit?: number,           // Default: 20
  sortBy?: "key" | "createdAt" | "updatedAt",
  sortOrder?: "asc" | "desc"
});

// Returns: PaginatedResponse<FeatureFlag>
```

##### `admin.featureFlags.update()`

Update an existing flag.

```typescript
const updated = await auth.api.admin.featureFlags.update(
  id: string,
  updates: Partial<FeatureFlag>
);

// Returns: FeatureFlag
```

##### `admin.featureFlags.delete()`

Delete a flag and all associated data.

```typescript
await auth.api.admin.featureFlags.delete(id: string);

// Returns: void
```

#### Rule Management

##### `admin.featureFlags.createRule()`

Add a targeting rule to a flag.

```typescript
const rule = await auth.api.admin.featureFlags.createRule({
  flagId: string,
  name?: string,
  priority: number,         // Lower = higher priority
  conditions: RuleConditions,
  value: any,               // Value when rule matches
  percentage?: number,      // Optional rollout within rule
  enabled?: boolean         // Default: true
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
  | "regex"
  | "exists"
  | "not_exists";
```

##### `admin.featureFlags.getRules()`

Get all rules for a flag.

```typescript
const rules = await auth.api.admin.featureFlags.getRules(
  flagId: string
);

// Returns: FlagRule[]
// Sorted by priority (ascending)
```

##### `admin.featureFlags.updateRule()`

Update a rule.

```typescript
const updated = await auth.api.admin.featureFlags.updateRule(
  ruleId: string,
  updates: Partial<FlagRule>
);

// Returns: FlagRule
```

##### `admin.featureFlags.deleteRule()`

Delete a rule.

```typescript
await auth.api.admin.featureFlags.deleteRule(ruleId: string);

// Returns: void
```

#### Override Management

::: warning Server-Side Overrides
These are server-side overrides for specific users, different from client-side local overrides. Server overrides persist across sessions while client overrides are temporary and blocked in production.
:::

##### `admin.featureFlags.createOverride()`

Create a user-specific override.

```typescript
const override = await auth.api.admin.featureFlags.createOverride({
  flagId: string,
  userId: string,
  value: any,               // Override value
  reason?: string,          // Audit trail
  expiresAt?: Date          // Auto-expire
});

// Returns: FlagOverride
```

##### `admin.featureFlags.getOverrides()`

Get overrides for a flag or user.

```typescript
// For a flag
const overrides = await auth.api.admin.featureFlags.getOverrides({
  flagId: string,
});

// For a user
const overrides = await auth.api.admin.featureFlags.getUserOverrides({
  userId: string,
});

// Returns: FlagOverride[]
```

##### `admin.featureFlags.deleteOverride()`

Remove an override.

```typescript
await auth.api.admin.featureFlags.deleteOverride(
  overrideId: string
);

// Returns: void
```

### Analytics API

#### `track()`

Track custom events for analytics.

```typescript
await auth.api.featureFlags.track({
  flagKey: string,
  event: string,            // Event name
  userId?: string,
  value?: number,           // Numeric value for metrics
  metadata?: Record<string, any>
});

// Returns: void
```

#### `getStats()`

Get usage statistics for a flag.

```typescript
const stats = await auth.api.admin.featureFlags.getStats({
  flagId: string,
  startDate?: Date,         // Default: 30 days ago
  endDate?: Date,           // Default: now
  granularity?: "hour" | "day" | "week" | "month"
});

// Returns: FlagStatistics
{
  totalEvaluations: number,
  uniqueUsers: number,
  valueDistribution: Record<string, number>,
  variantDistribution?: Record<string, number>,
  evaluationReasons: Record<string, number>,
  performance: {
    p50: number,            // Median latency (ms)
    p95: number,
    p99: number
  },
  errors: number,
  conversions?: {
    total: number,
    rate: number,
    value?: number
  }
}
```

### Audit API

#### `getAuditLog()`

Retrieve audit log entries.

```typescript
const entries = await auth.api.admin.featureFlags.getAuditLog({
  flagId?: string,
  userId?: string,
  action?: AuditAction,
  startDate?: Date,
  endDate?: Date,
  page?: number,
  limit?: number
});

// Returns: PaginatedResponse<AuditEntry>
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

#### `invalidateCache()`

Invalidate cached flag data.

```typescript
// Single flag
await auth.api.featureFlags.invalidateCache(key: string);

// All flags
await auth.api.featureFlags.clearCache();

// Returns: void
```

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

// Returns: { key: string, value: any } | null
```

#### `getAllFlags()`

Get all evaluated flags for the current user.

```typescript
const flags: Record<string, any> = await client.featureFlags.getAllFlags();
```

#### `track()`

Track conversion or custom events.

```typescript
await client.featureFlags.track(
  flagKey: string,
  event: string,
  value?: number
);
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

#### `GET /feature-flags/evaluate/:key`

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

#### `POST /feature-flags/evaluate/batch`

Evaluate multiple flags.

**Request Body:**

```json
{
  "keys": ["flag-1", "flag-2"],
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

#### `GET /feature-flags/all`

Get all enabled flags.

**Response:**

```json
{
  "feature-1": true,
  "feature-2": "value",
  "feature-3": { "nested": "data" }
}
```

#### `POST /feature-flags/track`

Track an event.

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

#### `GET /admin/feature-flags`

List all flags.

**Query Parameters:**

- `page` (number): Page number
- `limit` (number): Items per page
- `enabled` (boolean): Filter by status
- `search` (string): Search term

#### `POST /admin/feature-flags`

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

#### `GET /admin/feature-flags/:id`

Get flag details.

#### `PATCH /admin/feature-flags/:id`

Update a flag.

#### `DELETE /admin/feature-flags/:id`

Delete a flag.

#### `GET /admin/feature-flags/:id/rules`

Get flag rules.

#### `POST /admin/feature-flags/:id/rules`

Create a rule.

#### `PATCH /admin/rules/:id`

Update a rule.

#### `DELETE /admin/rules/:id`

Delete a rule.

#### `GET /admin/feature-flags/:id/overrides`

Get flag overrides.

#### `POST /admin/feature-flags/:id/overrides`

Create an override.

#### `DELETE /admin/overrides/:id`

Delete an override.

#### `GET /admin/feature-flags/:id/stats`

Get flag statistics.

#### `GET /admin/audit`

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
  const result = await auth.api.featureFlags.evaluate({
    key: "my-flag",
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

## Rate Limits

Default rate limits for API endpoints:

| Endpoint Type | Rate Limit | Window   |
| ------------- | ---------- | -------- |
| Evaluation    | 1000/sec   | Per IP   |
| Admin Read    | 100/min    | Per user |
| Admin Write   | 20/min     | Per user |
| Analytics     | 500/min    | Per user |

Configure custom limits:

```typescript
featureFlags({
  security: {
    rateLimit: {
      evaluation: 2000, // 2000/sec
      admin: 50, // 50/min
    },
  },
});
```

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

### From v0.x to v1.0

```typescript
// Old API (v0.x)
const enabled = await featureFlags.isEnabled("flag");

// New API (v1.0)
const result = await auth.api.featureFlags.evaluate({
  key: "flag",
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
