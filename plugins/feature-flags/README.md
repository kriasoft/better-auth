# Better Auth: Feature Flags

[![npm version](https://img.shields.io/npm/v/better-auth-feature-flags.svg)](https://www.npmjs.com/package/better-auth-feature-flags)
[![npm downloads](https://img.shields.io/npm/dm/better-auth-feature-flags.svg)](https://www.npmjs.com/package/better-auth-feature-flags)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/kriasoft/better-auth/pulls)
[![Discord](https://img.shields.io/discord/better-auth?label=Discord&logo=discord)](https://discord.gg/SBwX6VeqCY)
[![Sponsor](https://img.shields.io/github/sponsors/koistya?label=Sponsor&logo=github)](https://github.com/sponsors/koistya)

Enterprise-grade feature flag management integrated with Better Auth. Control feature rollouts, run A/B tests, and manage user experiences with powerful targeting rules and real-time evaluation.

> Version status
>
> - Current: v0.2.1
> - Previous: v0.2.0

## Features

### Core Capabilities

- 🚀 **Dynamic Feature Control** - Enable/disable features without deployments
- 🎯 **Advanced Targeting** - Rule-based targeting with complex conditions
- 🧪 **A/B Testing** - Multiple variants with deterministic assignment
- 📊 **Analytics & Tracking** - Built-in usage analytics and performance metrics
- 🔄 **Progressive Rollouts** - Percentage-based gradual feature releases
- 🔒 **Security First** - Role-based access, audit logging, and context sanitization

### Performance & Scale

- ⚡ **High Performance** - <10ms P50 latency with intelligent caching
- 💾 **Multiple Storage Backends** - Database, Memory, or Redis storage
- 🔄 **Smart Polling** - Exponential backoff and jitter for efficient updates
- 📦 **Batch Evaluation** - Evaluate multiple flags in a single request
- 🎯 **Session-Aware Caching** - Automatic cache invalidation on user changes

### Developer Experience

- 📘 **Full TypeScript Support** - Type-safe flag evaluation with schema validation
- ⚛️ **React Integration** - Hooks, components, and providers
- 🔧 **Development Tools** - Local overrides, debug mode, and DevTools integration
- 🏢 **Multi-Tenancy** - Organization-level flag isolation
- 📝 **Comprehensive Audit Trail** - Track all changes with configurable retention

## Installation

```bash
# npm
npm install better-auth better-auth-feature-flags

# bun
bun add better-auth better-auth-feature-flags

# pnpm
pnpm add better-auth better-auth-feature-flags

# yarn
yarn add better-auth better-auth-feature-flags
```

### Peer Dependencies

- This plugin requires `better-auth` as a peer dependency.
- Install a compatible version (e.g., `better-auth@^1.3.11`) to ensure proper type and runtime alignment.

## Quick Start

### 1. Server Setup

```typescript
import { betterAuth } from "better-auth";
import { featureFlags } from "better-auth-feature-flags";

const auth = betterAuth({
  plugins: [
    featureFlags({
      storage: "database", // "memory" | "database" | "redis"

      // Analytics configuration
      analytics: {
        trackUsage: true,
        trackPerformance: true,
      },

      // Caching for performance
      caching: {
        enabled: true,
        ttl: 60, // seconds
        maxSize: 1000,
      },

      // Admin access control
      adminAccess: {
        enabled: true,
        roles: ["admin"],
      },

      // Multi-tenancy (optional)
      multiTenant: {
        enabled: false,
        useOrganizations: false,
      },

      // Audit logging
      audit: {
        enabled: true,
        retentionDays: 90,
      },
    }),
  ],
});
```

### 2. Client Setup

```typescript
import { createAuthClient } from "better-auth/client";
import { featureFlagsClient } from "better-auth-feature-flags/client";

// Public client (for end users)
const authClient = createAuthClient({
  plugins: [
    featureFlagsClient({
      // Client-side caching
      cache: {
        enabled: true,
        ttl: 60000, // 60 seconds
        storage: "localStorage", // or "sessionStorage" or "memory"
      },

      // Real-time updates
      polling: {
        enabled: true,
        interval: 30000, // 30 seconds
      },

      // Context collection
      contextCollection: {
        collectDevice: false,
        collectGeo: false,
        collectCustomHeaders: false,
      },
    }),
  ],
});
```

#### Admin Client Setup

For admin dashboards, use both public and admin plugins:

```typescript
import { createAuthClient } from "better-auth/client";
import { featureFlagsClient } from "better-auth-feature-flags/client";
import { featureFlagsAdminClient } from "better-auth-feature-flags/admin";

// Admin client (for management interfaces)
const adminClient = createAuthClient({
  plugins: [
    featureFlagsClient(), // Public evaluation methods
    featureFlagsAdminClient(), // Admin CRUD operations
  ],
});
```

### 3. Using Feature Flags

## API Overview

### Public Endpoints

- **POST** `/feature-flags/evaluate`
  - Body: `{ flagKey: string, context?: object, default?: any, select?: 'value'|'full'|Array<'value'|'variant'|'reason'|'metadata'>, environment?: string, track?: boolean, debug?: boolean, contextInResponse?: boolean }`
  - Response (default): `{ value: any, variant?: string, reason: string, metadata?: any, evaluatedAt: string, context?: object }`
  - Response (`select: 'value'`): `{ value: any, evaluatedAt: string, context?: object }`

- **POST** `/feature-flags/evaluate-batch`
  - Body: `{ flagKeys: string[], defaults?: Record<string,any>, context?: object, select?: 'value'|'full'|Array<'value'|'variant'|'reason'|'metadata'>, environment?: string, track?: boolean, debug?: boolean, contextInResponse?: boolean }`
  - Response: `{ flags: Record<string, EvaluationResult>, evaluatedAt: string, context?: object }`

- **POST** `/feature-flags/bootstrap`
  - Body: `{ context?: object, include?: string[], prefix?: string, select?: 'value'|'full'|Array<'value'|'variant'|'reason'|'metadata'>, environment?: string, track?: boolean, debug?: boolean }`
  - Server response: `{ flags: Record<string, EvaluationResult>|Record<string, any>, evaluatedAt: string, context: object }`
  - Client helper `featureFlags.bootstrap()` returns a plain key→value map for convenience

- **POST** `/feature-flags/events`
  - Body: `{ flagKey: string, event: string, properties?: number|object, timestamp?: string (RFC3339), sampleRate?: number }`
  - Headers: `Idempotency-Key?: string`
- Event tracking for analytics

Note

- Environment can also be supplied via `x-deployment-ring` header; header takes precedence over body `environment`.
- Client `bootstrap()` extracts values; use server API with `select` if you need full result shapes.

### Admin Endpoints

- **GET** `/feature-flags/admin/flags`
  - Query: `{ organizationId?, cursor?, limit?, q?, sort?, type?, enabled?, prefix?, include? }`
  - Enhanced with filtering and metrics projection
  - Response: `{ flags: FeatureFlag[], page: { nextCursor?, limit, hasMore } }`

- **GET** `/feature-flags/admin/flags/:flagId/stats`
  - Query: `{ start?, end?, granularity?, timezone?, metrics? }`
  - Analytics with date range validation (max 90 days) and selective metrics

- **GET** `/feature-flags/admin/metrics/usage`
  - Query: `{ start?, end?, organizationId?, metrics? }`
  - Organization-level analytics with projection support

#### Simple Flag Evaluation

```typescript
// High-level client methods (v0.2.x)
const isEnabled = await authClient.featureFlags.isEnabled("new-feature");
const value = await authClient.featureFlags.getValue(
  "config-setting",
  "default",
);
const variant = await authClient.featureFlags.getVariant("ab-test");

// Canonical evaluation API
const result = await authClient.featureFlags.evaluate("new-feature", {
  default: false,
  context: { userId: "123", plan: "premium" },
});
// Returns: { value: boolean, variant?: string, reason: string }

// Batch evaluation for performance
const results = await authClient.featureFlags.evaluateMany(["flag1", "flag2"], {
  context: { userId: "123" },
  defaults: { flag1: false, flag2: "default" },
});

// Bootstrap all flags
const allFlags = await authClient.featureFlags.bootstrap({
  context: { userId: "123" },
});

// Event tracking
await authClient.featureFlags.track("new-feature", "viewed", {
  section: "dashboard",
});
```

#### React Integration

```tsx
import {
  FeatureFlagsProvider,
  useFeatureFlag,
  useFeatureFlagValue,
  useVariant,
  useTrackEvent,
  Feature,
  Variant,
} from "better-auth-feature-flags/react";

// Provider setup
function App() {
  return (
    <FeatureFlagsProvider
      client={authClient}
      fetchOnMount={true}
      context={{ userId: "user-123", plan: "premium" }}
    >
      <YourApp />
    </FeatureFlagsProvider>
  );
}

// Using hooks
function Component() {
  const isDarkMode = useFeatureFlag("dark-mode", false);
  const config = useFeatureFlagValue("ui-config", { theme: "light" });
  const variant = useVariant("homepage-test");
  const track = useTrackEvent();

  const handleClick = () => {
    track("ui-interaction", "button_click", { component: "header" });
  };

  return (
    <div className={isDarkMode ? "dark" : "light"}>
      <h1>Theme: {config.theme}</h1>
      <p>Variant: {variant || "default"}</p>
      <button onClick={handleClick}>Track Event</button>
    </div>
  );
}

// Conditional rendering
function Page() {
  return (
    <Feature flag="premium-feature" fallback={<FreeVersion />}>
      <PremiumVersion />
    </Feature>
  );
}

// A/B testing with variants
function Homepage() {
  return (
    <Variant flag="homepage-test">
      <Variant.Case variant="control">
        <ClassicHomepage />
      </Variant.Case>
      <Variant.Case variant="variant-a">
        <ModernHomepage />
      </Variant.Case>
      <Variant.Default>
        <DefaultHomepage />
      </Variant.Default>
    </Variant>
  );
}

// Suspense support for modern React apps
import {
  FeatureSuspense,
  useFeatureFlagSuspense,
} from "better-auth-feature-flags/react";

function SuspenseExample() {
  return (
    <Suspense fallback={<Loading />}>
      <FeatureSuspense flag="new-feature" fallback={<OldFeature />}>
        <NewFeature />
      </FeatureSuspense>
    </Suspense>
  );
}

function SuspenseHook() {
  // Throws promise for Suspense to catch
  const isEnabled = useFeatureFlagSuspense("feature-name", false);
  return <div>Feature is {isEnabled ? "enabled" : "disabled"}</div>;
}
```

### Client Configuration

```typescript
import { createAuthClient } from "better-auth/client";
import { featureFlagsClient } from "better-auth-feature-flags/client";

const authClient = createAuthClient({
  plugins: [
    featureFlagsClient({
      // Client-side caching
      cache: {
        enabled: true,
        ttl: 60000, // 60 seconds
        storage: "localStorage", // or "sessionStorage" or "memory"
      },

      // Automatic polling for updates
      polling: {
        enabled: true,
        interval: 30000, // 30 seconds
      },

      // Context collection
      contextCollection: {
        collectDevice: false,
        collectGeo: false,
        collectCustomHeaders: false,
      },

      // Development overrides (disabled in production)
      overrides: {
        enabled: process.env.NODE_ENV === "development",
      },
    }),
  ],
});
```

## Client API Reference

### Core Evaluation Methods

```typescript
// Simple boolean check
const isEnabled = await authClient.featureFlags.isEnabled("new-feature");

// Get any value type with default
const config = await authClient.featureFlags.getValue("ui-config", {
  theme: "light",
  sidebar: "collapsed",
});

// Get variant for A/B testing
const variant = await authClient.featureFlags.getVariant("homepage-test");

// Full evaluation with metadata
const result = await authClient.featureFlags.evaluate("feature-name", {
  default: false,
  context: { plan: "premium", region: "us-west" },
  select: "full", // Returns { value, variant?, reason }
});

// Batch evaluation
const results = await authClient.featureFlags.evaluateMany(
  ["feature-1", "feature-2"],
  {
    context: { userId: "123" },
    defaults: { "feature-1": false, "feature-2": "default" },
  },
);

// Bootstrap all enabled flags
const allFlags = await authClient.featureFlags.bootstrap({
  context: { userId: "123" },
  include: ["ui-*", "experiments-*"], // Optional filtering
});
```

### Event Tracking

```typescript
// Simple event tracking
await authClient.featureFlags.track("checkout-flow", "step_completed", {
  step: "payment",
  value: 99.99,
});

// Context and override management
authClient.featureFlags.setContext({ plan: "premium", region: "us" });
const context = authClient.featureFlags.getContext();

// Development overrides (disabled in production)
authClient.featureFlags.setOverride("debug-mode", true);
authClient.featureFlags.clearOverrides();

// Cache management
authClient.featureFlags.clearCache();
await authClient.featureFlags.refresh();
```

### Admin API (Separate Bundle)

Admin operations use a separate client plugin to keep public bundles lean:

```typescript
import { createAuthClient } from "better-auth/client";
import { featureFlagsClient } from "better-auth-feature-flags/client";
import { featureFlagsAdminClient } from "better-auth-feature-flags/admin";

// Admin clients include both public and admin plugins
const adminClient = createAuthClient({
  plugins: [featureFlagsClient(), featureFlagsAdminClient()],
});

// Flag management
const flags = await adminClient.featureFlags.admin.flags.list({
  q: "search-term",
  type: "boolean",
  enabled: true,
  sort: "-updatedAt",
  limit: 20,
});
// Returns: { flags: FeatureFlag[], page: { nextCursor?, limit, hasMore } }

const newFlag = await adminClient.featureFlags.admin.flags.create({
  key: "new-checkout",
  name: "New Checkout Flow",
  type: "boolean",
  enabled: true,
  defaultValue: false,
  rolloutPercentage: 25,
  variants: [
    { key: "control", value: false, weight: 50 },
    { key: "test", value: true, weight: 50 },
  ],
});

// Rule-based targeting
await adminClient.featureFlags.admin.rules.create({
  flagId: newFlag.id,
  priority: 1,
  conditions: {
    all: [
      { attribute: "plan", operator: "equals", value: "premium" },
      { attribute: "region", operator: "in", value: ["us", "ca"] },
    ],
  },
  value: true,
});

// Analytics with enhanced projection
const stats = await adminClient.featureFlags.admin.analytics.stats.get(
  newFlag.id,
  {
    start: "2025-01-01",
    end: "2025-01-31",
    granularity: "day",
    metrics: ["total", "uniqueUsers", "variants"], // Selective metrics
  },
);

const usage = await adminClient.featureFlags.admin.analytics.usage.get({
  start: "2025-01-01",
  end: "2025-01-31",
  metrics: ["errorRate", "avgLatency"], // Only get performance metrics
});
```

### What's New in v0.2.0

- Idempotency support for analytics events
- Batch event tracking for performance
- Canonical API naming and improved DX
- Enhanced TypeScript types and error handling
- React Suspense hooks and advanced React helpers

## Migration Guide (v0.1.3 → v0.2.0)

The v0.2.0 release introduces canonical API naming for better consistency and long-term stability. The old methods are deprecated but still supported. API renames:

- `getFlag()` → `evaluate()`
- `getFlags()` → `evaluateMany()`
- `getAllFlags()` → `bootstrap()`
- `trackEvent()` → `track()`

Old methods are deprecated but still supported for backward compatibility.

### API Methods Overview (Canonical)

| Purpose                   | Method                                     |
| ------------------------- | ------------------------------------------ |
| **Flag Evaluation**       | `featureFlags.isEnabled()`                 |
|                           | `featureFlags.getValue()`                  |
|                           | `featureFlags.getVariant()`                |
|                           | `featureFlags.evaluate()`                  |
|                           | `featureFlags.evaluateMany()`              |
|                           | `featureFlags.bootstrap()`                 |
| **Analytics**             | `featureFlags.track()`                     |
|                           | `featureFlags.trackBatch()`                |
| **Admin Operations**      | `featureFlags.admin.flags.list()`          |
|                           | `featureFlags.admin.flags.create()`        |
|                           | `featureFlags.admin.flags.get()`           |
|                           | `featureFlags.admin.flags.update()`        |
|                           | `featureFlags.admin.flags.delete()`        |
|                           | `featureFlags.admin.flags.enable()`        |
|                           | `featureFlags.admin.flags.disable()`       |
|                           | `featureFlags.admin.rules.list()`          |
|                           | `featureFlags.admin.rules.create()`        |
|                           | `featureFlags.admin.rules.get()`           |
|                           | `featureFlags.admin.rules.update()`        |
|                           | `featureFlags.admin.rules.delete()`        |
|                           | `featureFlags.admin.rules.reorder()`       |
|                           | `featureFlags.admin.overrides.list()`      |
|                           | `featureFlags.admin.overrides.create()`    |
|                           | `featureFlags.admin.overrides.get()`       |
|                           | `featureFlags.admin.overrides.update()`    |
|                           | `featureFlags.admin.overrides.delete()`    |
|                           | `featureFlags.admin.audit.list()`          |
|                           | `featureFlags.admin.audit.get()`           |
|                           | `featureFlags.admin.analytics.stats.get()` |
|                           | `featureFlags.admin.analytics.usage.get()` |
| **Context**               | `featureFlags.setContext()`                |
|                           | `featureFlags.getContext()`                |
| **Cache Management**      | `featureFlags.clearCache()`                |
|                           | `featureFlags.refresh()`                   |
| **Development Overrides** | `featureFlags.setOverride()`               |
|                           | `featureFlags.clearOverrides()`            |

## Advanced Configuration

### Static Flag Definitions

Define flags in your server configuration for version control:

```typescript
import { betterAuth } from "better-auth";
import { featureFlags } from "better-auth-feature-flags";

const auth = betterAuth({
  plugins: [
    featureFlags({
      storage: "database",

      // Static flag definitions
      flags: {
        "maintenance-mode": {
          enabled: false,
          default: false,
        },

        "new-checkout": {
          enabled: true,
          default: false,
          rolloutPercentage: 25, // Gradual rollout
          targeting: {
            roles: ["beta-tester"],
            attributes: { plan: "premium" },
          },
        },

        "homepage-test": {
          enabled: true,
          variants: [
            { key: "control", value: "classic", weight: 50 },
            { key: "variant", value: "modern", weight: 50 },
          ],
        },
      },

      // Analytics configuration
      analytics: {
        trackUsage: true,
        trackPerformance: true,
      },

      // Multi-tenancy
      multiTenant: {
        enabled: true,
        useOrganizations: true,
      },

      // Admin access control
      adminAccess: {
        enabled: true,
        roles: ["admin", "feature-manager"],
      },
    }),
  ],
});
```

### Storage Options

```typescript
// Database storage (recommended for production)
featureFlags({ storage: "database" });

// Memory storage (development/testing)
featureFlags({ storage: "memory" });

// Redis storage (high-scale distributed)
featureFlags({ storage: "redis" });
```

## Best Practices

### Flag Design

✅ **Do:**

- Use descriptive, URL-safe keys: `new-checkout`, `experiment-homepage`
- Start with `enabled: false` and safe defaults
- Use gradual rollouts: `rolloutPercentage: 10` → `25` → `50` → `100`
- Define meaningful variant keys: `control`, `variant-a`, `new-design`
- Scope flags by organization in multi-tenant environments

❌ **Don't:**

- Include PII or secrets in flag metadata
- Change flag keys after deployment (breaks analytics)
- Use chaotic on/off toggling (prefer rollout percentages)
- Omit weights in variants (must sum to 100)

### Performance Optimization

```typescript
// Use caching for better performance
featureFlagsClient({
  cache: {
    enabled: true,
    ttl: 60000, // 1 minute
    storage: "localStorage",
  },

  // Enable polling for real-time updates
  polling: {
    enabled: true,
    interval: 30000, // 30 seconds
  },
});

// Batch evaluations when possible
const results = await client.featureFlags.evaluateMany([
  "feature-1",
  "feature-2",
  "feature-3",
]);

// Use bootstrap for initial page load
const allFlags = await client.featureFlags.bootstrap();
```

### Security Considerations

- Context sanitization is enabled by default
- Production overrides are automatically disabled
- Admin operations require proper role-based access
- Audit logging tracks all flag changes

### TypeScript Integration

```typescript
// Define your flag schema for type safety
interface AppFlags {
  "ui.dark-mode": boolean;
  "experiment.homepage": "control" | "variant-a" | "variant-b";
  "config.max-items": number;
  "feature.premium-checkout": boolean;
}

// Server setup with typed schema
const auth = betterAuth({
  plugins: [
    featureFlags<AppFlags>({
      // Schema type flows to client via $Infer
      storage: "database",
    }),
  ],
});

// Type-safe client with schema inference
const client = createAuthClient({
  plugins: [featureFlagsClient<AppFlags>()],
});

// TypeScript ensures correct types
const isDark = await client.featureFlags.isEnabled("ui.dark-mode");
//    ^? boolean

const variant = await client.featureFlags.getValue(
  "experiment.homepage",
  "control",
);
//    ^? "control" | "variant-a" | "variant-b"

const maxItems = await client.featureFlags.getValue("config.max-items", 10);
//    ^? number
```

## Performance & Security

### Performance Metrics

- **Evaluation Latency**: <10ms P50, <100ms P99
- **Throughput**: 100,000+ evaluations/second
- **Cache Hit Rate**: >95% with proper configuration
- **Bundle Size**: ~5KB minified + gzipped (core + React)

### Security Features

- **Context Sanitization**: Automatic PII filtering and validation
- **Production Safeguards**: Development overrides disabled in production
- **Role-Based Access**: Admin operations require proper authentication
- **Audit Trail**: Complete change history with configurable retention
- **Multi-Tenant Isolation**: Organization-level flag scoping

## Documentation

📚 **[Full Documentation](https://kriasoft.com/better-auth/feature-flags/overview)**

- [Quickstart Guide](https://kriasoft.com/better-auth/feature-flags/quickstart.html) - Get up and running in 5 minutes
- [Configuration](https://kriasoft.com/better-auth/feature-flags/configuration.html) - Detailed configuration options
- [API Reference](https://kriasoft.com/better-auth/feature-flags/api-reference.html) - Complete API documentation
- [Client SDK](https://kriasoft.com/better-auth/feature-flags/client-sdk.html) - Frontend integration guide
- [Device Detection](https://kriasoft.com/better-auth/feature-flags/device-detection.html) - Target by device, browser, OS
- [Troubleshooting](https://kriasoft.com/better-auth/feature-flags/troubleshooting.html) - Common issues and solutions

## Architecture

### Modular Endpoint Design

The feature flags plugin uses a modular architecture for better maintainability and performance:

#### Public Endpoints (by functional concern)

```
src/endpoints/public/
├── evaluate.ts          # Single flag evaluation
├── evaluate-batch.ts    # Batch flag evaluation
├── bootstrap.ts         # Bulk flag initialization
├── events.ts           # Analytics event tracking
├── config.ts           # Public configuration
└── health.ts           # Service health checks
```

#### Admin Endpoints (by resource type)

```
src/endpoints/admin/
├── flags.ts            # Flag CRUD operations
├── rules.ts            # Rule management
├── overrides.ts        # Override management
├── analytics.ts        # Stats and metrics
├── audit.ts            # Audit log access
└── environments.ts     # Environment management + data export
```

### Benefits

- **Single Responsibility**: Each module focuses on one concern (200-300 lines)
- **Better Tree-Shaking**: Unused admin features don't bloat client bundles
- **Easier Testing**: Focused test suites per module
- **Independent Development**: Teams can work on different modules without conflicts
- **Clear API Surface**: RESTful organization makes the API predictable

### Design Decisions

- **Public endpoints** organized by **functional concern** for performance optimization
- **Admin endpoints** organized by **REST resource** for consistent management UX
- **Shared utilities** in `endpoints/shared.ts` for consistent security and validation
- **Composition pattern** in `endpoints/index.ts` to maintain backward compatibility

## Comparison

| Feature                     | Better Auth Feature Flags | LaunchDarkly | Unleash    | Flagsmith  |
| --------------------------- | ------------------------- | ------------ | ---------- | ---------- |
| **Open Source**             | ✅                        | ❌           | ✅         | ✅         |
| **Self-hosted**             | ✅                        | ❌           | ✅         | ✅         |
| **Type Safety**             | ✅ Full                   | ⚠️ Partial   | ⚠️ Partial | ⚠️ Partial |
| **Better Auth Integration** | ✅ Native                 | ❌           | ❌         | ❌         |
| **Smart Caching**           | ✅                        | ✅           | ⚠️ Basic   | ⚠️ Basic   |
| **A/B Testing**             | ✅                        | ✅           | ✅         | ✅         |
| **Audit Logging**           | ✅                        | ✅           | ✅         | ✅         |
| **Multi-tenancy**           | ✅                        | ✅           | ⚠️ Limited | ✅         |
| **Device Detection**        | ✅                        | ⚠️ Limited   | ❌         | ❌         |
| **Pricing**                 | Free                      | $$$          | Free/$     | Free/$     |

## Support

- **GitHub Issues:** [Report bugs](https://github.com/kriasoft/better-auth/issues)
- **Better Auth Docs:** https://docs.better-auth.com/
- **Discord:** [Community support](https://discord.gg/SBwX6VeqCY)

## Contributing

We welcome contributions! Please see our [Contributing Guide](../../.github/CONTRIBUTING.md) for details.

## Sponsors

This project is made possible by our generous sponsors. Thank you for your support! 🙏

<a href="https://github.com/sponsors/koistya">
  <img src="https://img.shields.io/github/sponsors/koistya?style=social" alt="Sponsor @koistya on GitHub" />
</a>

## License

MIT - See [LICENSE](./LICENSE) for details
