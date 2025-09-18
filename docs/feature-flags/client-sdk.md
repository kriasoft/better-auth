# Client SDK Guide

Frontend integration guide for Better Auth Feature Flags.

## Installation

Install the client SDK with your package manager:

::: code-group

```bash [bun]
bun add better-auth better-auth-feature-flags
```

```bash [npm]
npm install better-auth better-auth-feature-flags
```

```bash [pnpm]
pnpm add better-auth better-auth-feature-flags
```

> Note
>
> - `better-auth` is a peer dependency of this package.
> - Use a compatible version (e.g., `better-auth@^1.3.11`) to ensure type and runtime alignment.

:::

## Basic Setup

### Initialize the Client

```typescript {5,8}
import { createAuthClient } from "better-auth/client";
import { featureFlagsClient } from "better-auth-feature-flags/client";

const authClient = createAuthClient({
  baseURL: "https://api.example.com", // Your API URL
  plugins: [
    featureFlagsClient({
      // Client options (optional)
    }),
  ],
});
```

### Client Options

```typescript
featureFlagsClient({
  // Cache configuration
  cache: {
    enabled: true, // Cache flag values (default: true)
    ttl: 60000, // Time to live in milliseconds (default: 60000)
    storage: "memory", // or "localStorage", "sessionStorage"
    keyPrefix: "ff_", // Cache key prefix (default: "ff_")
    version: "v1", // Cache version for invalidation
    include: ["critical-flag"], // Only cache these flags
    exclude: ["dynamic-flag"], // Never cache these flags
  },

  // Smart polling with exponential backoff
  polling: {
    enabled: false, // Poll for flag changes
    interval: 30000, // Base interval: 30 seconds (backs off on errors)
  },

  // Default values
  defaults: {
    "feature-1": false,
    "feature-2": "default",
  },

  // Debug mode
  debug: true, // Enable debug logging

  // Error handling
  onError: (error) => {
    console.error("Feature flag error:", error);
  },

  // Evaluation callback
  onEvaluation: (flag, result) => {
    console.log(`Flag ${flag} evaluated to:`, result);
  },
});
```

### Cache Architecture

The client SDK includes an intelligent caching system with several key features:

#### Session-Aware Caching

The cache automatically invalidates when user sessions change:

- **Automatic Detection**: Integrates with Better Auth's session management
- **Complete Invalidation**: Clears all cached flags on login/logout
- **Session Binding**: Cache entries are associated with session IDs
- **Zero Configuration**: Works automatically without setup

#### Memory Management

Prevents memory leaks with built-in limits:

- **LRU Eviction**: Automatically removes least recently used entries
- **Max Entries**: Limited to 100 cached flags by default
- **Access Tracking**: Maintains usage order for intelligent eviction

#### Storage Quota Handling

Gracefully handles browser storage limitations:

- **Quota Detection**: Catches `QuotaExceededError` exceptions
- **Automatic Cleanup**: Removes oldest entries when storage is full
- **Fallback Strategy**: Continues with memory-only cache if storage fails
- **Silent Recovery**: No disruption to user experience

#### Cache Versioning

Supports cache busting for schema changes:

```typescript
featureFlagsClient({
  cache: {
    version: "v2", // Changing version clears old cache
  },
});
```

When the version changes, all previous cache entries are automatically cleared on initialization.

## Core Methods

### Check if Enabled

```typescript
// Simple boolean check
const isEnabled = await authClient.featureFlags.isEnabled("dark-mode");

// With default value
const isEnabled = await authClient.featureFlags.isEnabled(
  "new-feature",
  false, // Default if flag not found
);
```

### Get Flag Value

```typescript
// Get typed value
const theme = await authClient.featureFlags.getValue<string>(
  "theme-name",
  "light", // Default value
);

// Complex object
interface Config {
  layout: string;
  color: string;
}

const config = await authClient.featureFlags.getValue<Config>("ui-config", {
  layout: "grid",
  color: "blue",
});
```

### Get Variant

```typescript
// Get A/B test variant (returns variant key)
const variant = await authClient.featureFlags.getVariant("checkout-test");
if (variant) {
  console.log(variant); // "control" | "variant_a" | ...
}
```

### Get All Flags

```typescript
// Get all evaluated flags
const flags = await authClient.featureFlags.bootstrap();

console.log(flags);
// {
//   "feature-1": true,
//   "feature-2": "value",
//   "feature-3": { complex: "object" }
// }
```

### Batch Evaluation

```typescript
// Evaluate multiple flags at once for better performance
const results = await authClient.featureFlags.evaluateMany([
  "feature-1",
  "feature-2",
  "feature-3",
]);

console.log(results);
// {
//   "feature-1": { value: true, reason: "rule_match" },
//   "feature-2": { value: "variant-a", variant: "variant_a", reason: "percentage_rollout" },
//   "feature-3": { value: false, reason: "default" }
// }
```

### Track Events

```typescript
// Track conversion with numeric value
await authClient.featureFlags.track(
  "checkout-test",
  "purchase",
  99.99, // Optional numeric value
);

// Track with metadata
await authClient.featureFlags.track(
  "onboarding-flow",
  "step-completed",
  { step: 3, time: 45 }, // Optional metadata object
);

// Track simple event
await authClient.featureFlags.track("feature-used", "click");

// Track with idempotency key (NEW in v0.2.0)
await authClient.featureFlags.track(
  "payment-completed",
  "purchase",
  99.99,
  { idempotencyKey: "payment-123" }, // Prevents duplicate events
);

// Batch tracking (NEW in v0.2.0)
await authClient.featureFlags.trackBatch(
  [
    {
      flag: "checkout-test",
      event: "purchase",
      data: 99.99,
      timestamp: new Date(),
    },
    {
      flag: "onboarding-flow",
      event: "step-completed",
      data: { step: 3 },
    },
  ],
  { idempotencyKey: "batch-123" },
);
```

### Context Management

```typescript
// Set evaluation context
authClient.featureFlags.setContext({
  userId: "user-123",
  organizationId: "org-456",
  attributes: {
    plan: "premium",
    country: "US",
  },
  device: "mobile",
  browser: "chrome",
  version: "1.2.3",
});

// Get current context
const context = authClient.featureFlags.getContext();
```

#### Context Security

The SDK automatically sanitizes context data to prevent PII leakage:

**Default Behavior:**

- Removes sensitive fields (passwords, tokens, credit cards, SSN)
- Enforces size limits (2KB for URLs, 10KB for POST bodies)
- Whitelists safe fields only (strict mode by default)
- Warns about dropped fields in development

**Allowed Fields (Default):**

```typescript
// These fields are allowed by default
const safeContext = {
  // User identifiers
  userId,
  organizationId,
  teamId,
  role,
  plan,
  subscription,

  // Device/environment
  device,
  browser,
  os,
  platform,
  version,
  locale,
  timezone,

  // Application state
  page,
  route,
  feature,
  experiment,

  // Business attributes
  country,
  region,
  environment,
  buildVersion,
};
```

**Configuration:**

```typescript
featureFlagsClient({
  contextSanitization: {
    enabled: true, // Enable/disable sanitization (default: true)
    strict: true, // Only allow whitelisted fields (default: true)
    allowedFields: ["customField1", "customField2"], // Additional allowed fields
    maxUrlSize: 2048, // Max size for GET requests (default: 2KB)
    maxBodySize: 10240, // Max size for POST requests (default: 10KB)
    warnOnDrop: true, // Log warnings when fields are dropped
  },
});
```

**Security Best Practices:**

```typescript
// ❌ NEVER include sensitive data
authClient.featureFlags.setContext({
  userId: "user-123",
  password: "secret", // Will be removed
  apiKey: "key-123", // Will be removed
  creditCard: "4111-1111-1111-1111", // Will be removed
});

// ✅ Use safe, non-sensitive data
authClient.featureFlags.setContext({
  userId: "user-123",
  role: "admin",
  plan: "premium",
  device: "mobile",
});

// ✅ For custom fields, add them to allowlist
featureFlagsClient({
  contextSanitization: {
    allowedFields: ["departmentId", "projectId"],
  },
});
```

### Cache Management

```typescript
// Prefetch critical flags on app load
await authClient.featureFlags.prefetch(["critical-flag-1", "critical-flag-2"]);

// Clear cache when needed
authClient.featureFlags.clearCache();

// Refresh all flags
await authClient.featureFlags.refresh();
```

### Local Overrides (Development)

::: danger Security Warning
Overrides are **automatically disabled in production** to prevent debug features from being exposed. Never use `allowInProduction: true` unless absolutely necessary.
:::

```typescript
// ✅ SAFE: Overrides blocked in production by default
authClient.featureFlags.setOverride("new-feature", true);

// ⚠️ DANGEROUS: Explicitly allowing production overrides
featureFlagsClient({
  overrides: {
    allowInProduction: true, // Never do this!
  },
});
```

#### Override Configuration

```typescript
featureFlagsClient({
  overrides: {
    ttl: 3600000, // Expire after 1 hour (default)
    persist: true, // Save to localStorage (default: false)
    keyPrefix: "my-app", // Storage key prefix
    // allowInProduction: false, // Keep this false!
  },
});
```

#### Security Features

- **Automatic Expiration**: Overrides expire after 1 hour by default
- **Environment Detection**: Disabled in production unless explicitly allowed
- **Session Isolation**: Overrides are client-specific, not shared
- **Cleanup on Dispose**: Overrides cleared when component unmounts

```typescript
// Override flag values for testing (dev only)
if (process.env.NODE_ENV === "development") {
  authClient.featureFlags.setOverride("new-feature", true);
  authClient.featureFlags.setOverride("test-variant", {
    key: "variant-b",
    value: { color: "green" },
  });
}

// Clear all overrides
authClient.featureFlags.clearOverrides();
```

### Admin Operations (NEW in v0.2.0)

The client SDK now includes organized admin operations under the `authClient.featureFlags.admin` namespace:

```typescript
// Flag management
await authClient.featureFlags.admin.flags.create({
  key: "new-feature",
  name: "New Feature",
  type: "boolean",
  enabled: true,
  defaultValue: false,
});

await authClient.featureFlags.admin.flags.list();
await authClient.featureFlags.admin.flags.update("flag-id", { enabled: false });
await authClient.featureFlags.admin.flags.delete("flag-id");

// Rule management
await authClient.featureFlags.admin.rules.create({
  flagId: "flag-id",
  priority: 0,
  conditions: {
    all: [{ attribute: "role", operator: "equals", value: "admin" }],
  },
  value: true,
});

await authClient.featureFlags.admin.rules.list("flag-id");

// Override management
await authClient.featureFlags.admin.overrides.create({
  flagId: "flag-id",
  userId: "user-123",
  value: true,
});

await authClient.featureFlags.admin.overrides.list({ flagId: "flag-id" });

// Analytics and audit
await authClient.featureFlags.admin.analytics.stats.get("flag-id");
await authClient.featureFlags.admin.audit.list({ flagId: "flag-id" });
```

### Real-time Updates

```typescript
// Subscribe to flag changes
const unsubscribe = authClient.featureFlags.subscribe((flags) => {
  console.log("Flags updated:", flags);
  // Update UI based on new flags
});

// Cleanup
unsubscribe();
```

#### Smart Polling

The SDK includes intelligent polling that prevents server overload:

- **Jitter**: Adds 0-25% random delay to prevent synchronized requests
- **Exponential Backoff**: On errors, intervals increase: 30s → 60s → 120s → 240s
- **Auto-Recovery**: Returns to normal interval after successful poll
- **Maximum Backoff**: Capped at 10x base interval or 5 minutes

```typescript
featureFlagsClient({
  polling: {
    enabled: true,
    interval: 30000, // Base: 30 seconds
  },
  onError: (error) => {
    // Polling automatically backs off on errors
    console.error("Polling error (will retry with backoff):", error);
  },
});
```

## React Integration

### Provider Setup

Wrap your app with the feature flags provider:

```tsx {6-8}
import { FeatureFlagsProvider } from "better-auth-feature-flags/react";
import { authClient } from "./auth-client";

function App() {
  return (
    <FeatureFlagsProvider client={authClient}>
      <YourApp />
    </FeatureFlagsProvider>
  );
}
```

### React Hooks

#### `useFeatureFlag()`

Check if a single flag is enabled:

```tsx {1,5}
import { useFeatureFlag } from "better-auth-feature-flags/react";

function Component() {
  // Returns boolean with optional default value
  const isDarkMode = useFeatureFlag("dark-mode", false);

  return (
    <div className={isDarkMode ? "dark" : "light"}>{/* Your content */}</div>
  );
}
```

#### `useFeatureFlags()`

Get all flags:

```tsx {1,4-5}
import { useFeatureFlags } from "better-auth-feature-flags/react";

function Dashboard() {
  const flags = useFeatureFlags();
  const showNewUI = flags["new-dashboard"];

  return showNewUI ? <NewDashboard /> : <OldDashboard />;
}
```

#### `useTrackEvent()`

Track analytics events:

```tsx {1,4,8}
import { useTrackEvent } from "better-auth-feature-flags/react";

function CheckoutButton() {
  const track = useTrackEvent();

  const handlePurchase = async (amount: number) => {
    // Track conversion event
    await track("checkout-test", "purchase", amount);
    // Process purchase...
  };

  return <button onClick={() => handlePurchase(99.99)}>Buy Now</button>;
}
```

#### `useFeatureFlagsState()`

Get loading and error states:

```tsx {1,4}
import { useFeatureFlagsState } from "better-auth-feature-flags/react";

function FeatureStatus() {
  const { loading, error, refresh } = useFeatureFlagsState();

  if (loading) return <Spinner />;
  if (error) return <ErrorMessage error={error} />;

  return <button onClick={refresh}>Refresh Flags</button>;
}
```

#### `useFeatureFlagsCacheInfo()`

Monitor cache state for debugging (development only):

```tsx {1,4-6}
import { useFeatureFlagsCacheInfo } from "better-auth-feature-flags/react";

function DebugPanel() {
  const cacheInfo = useFeatureFlagsCacheInfo();

  if (process.env.NODE_ENV !== "development") return null;

  return (
    <div className="debug-panel">
      <p>Cache Enabled: {cacheInfo.cacheEnabled ? "Yes" : "No"}</p>
      <p>Cached Flags: {cacheInfo.flagCount}</p>
    </div>
  );
}
```

#### `useVariant()`

Get A/B test variant:

```tsx {1,4}
import { useVariant } from "better-auth-feature-flags/react";

function CheckoutButton() {
  const variant = useVariant("checkout-test");

  // useVariant returns the variant key; map keys to UI behavior
  const labelByVariant: Record<string, string> = {
    control: "Buy Now",
    variant_a: "Purchase",
    variant_b: "Get Started",
  };

  const label = (variant && labelByVariant[variant]) || "Buy Now";

  return <button>{label}</button>;
}
```

#### `useFeatureFlagValue()`

Get typed flag value:

```tsx {1,4}
import { useFeatureFlagValue } from "better-auth-feature-flags/react";

function Settings() {
  const maxItems = useFeatureFlagValue<number>("max-items", 10);

  return <ItemList maxItems={maxItems} />;
}
```

### Feature Component

Conditionally render based on flag:

```tsx
import { Feature } from "better-auth-feature-flags/react";

function App() {
  return (
    <>
      {/* Simple feature gate */}
      <Feature flag="new-header">
        <NewHeader />
      </Feature>

      {/* With fallback */}
      <Feature flag="beta-feature" fallback={<ComingSoon />}>
        <BetaFeature />
      </Feature>

      {/* With additional validation */}
      <Feature
        flag="premium-feature"
        validateAccess={(flags) => flags["subscription"] === "premium"}
        fallback={<UpgradePrompt />}
      >
        <PremiumContent />
      </Feature>
    </>
  );
}
```

### Variant Component

Render different variants for A/B testing:

```tsx
import { Variant } from "better-auth-feature-flags/react";

function HomePage() {
  return (
    <Variant flag="homepage-test">
      <Variant.Case variant="control">
        <ClassicHomepage />
      </Variant.Case>

      <Variant.Case variant="variant-a">
        <ModernHomepage />
      </Variant.Case>

      <Variant.Case variant="variant-b">
        <ExperimentalHomepage />
      </Variant.Case>

      <Variant.Default>
        <DefaultHomepage />
      </Variant.Default>
    </Variant>
  );
}
```

### Error Boundary

Handle feature flag errors gracefully:

```tsx
import { FeatureFlagErrorBoundary } from "better-auth-feature-flags/react";

function App() {
  return (
    <FeatureFlagErrorBoundary
      fallback={<SafeFallbackUI />}
      onError={(error) => {
        // Log to error tracking service
        console.error("Feature flag error:", error);
      }}
    >
      <FeatureGatedContent />
    </FeatureFlagErrorBoundary>
  );
}
```

### Higher-Order Components

For class components or additional flexibility:

```tsx
import {
  withFeatureFlags,
  withFeatureFlag,
} from "better-auth-feature-flags/react";

// Inject all flags as props
const EnhancedComponent = withFeatureFlags(({ featureFlags }) => {
  return <div>Dark mode: {featureFlags["dark-mode"] ? "On" : "Off"}</div>;
});

// Conditionally render based on flag
const PremiumFeature = withFeatureFlag(
  "premium-feature",
  FallbackComponent, // Optional fallback
)(PremiumComponent);
```

## Vue Integration

### Plugin Setup

```typescript
import { createApp } from "vue";
import { featureFlagsPlugin } from "better-auth-feature-flags/vue";

const app = createApp(App);
app.use(featureFlagsPlugin, {
  client: authClient,
});
```

### Composition API

```vue
<script setup>
import { useFeatureFlag, useFeatureFlags } from "better-auth-feature-flags/vue";

const isDarkMode = useFeatureFlag("dark-mode", false);
const flags = useFeatureFlags();

// Reactive computed
const showNewUI = computed(() => flags.value["new-dashboard"]);
</script>

<template>
  <div :class="{ dark: isDarkMode }">
    <NewDashboard v-if="showNewUI" />
    <OldDashboard v-else />
  </div>
</template>
```

### Feature Directive

```vue
<template>
  <!-- Show/hide based on flag -->
  <div v-feature="'new-feature'">
    This is only visible when new-feature is enabled
  </div>

  <!-- With fallback -->
  <div v-feature:else="'beta-feature'">
    <BetaFeature v-feature />
    <ComingSoon v-else />
  </div>
</template>
```

## Next.js Integration

### App Router

#### Server Component

```tsx {6-8}
// app/page.tsx
import { auth } from "@/lib/auth";

export default async function Page() {
  const session = await auth.api.getSession();
  const { flags } = await auth.api.bootstrapFeatureFlags({
    body: { context: { userId: session?.user?.id } },
  });

  return <div>{flags["new-feature"] && <NewFeature />}</div>;
}
```

#### Client Component

```tsx {4,7}
// app/components/interactive.tsx
"use client";

import { useFeatureFlag } from "better-auth-feature-flags/react";

export function InteractiveComponent() {
  const isEnabled = useFeatureFlag("interactive-feature");

  return isEnabled ? <NewVersion /> : <OldVersion />;
}
```

#### Streaming with Suspense

```tsx {8-10}
// app/dashboard/page.tsx
import { Suspense } from "react";
import { FeatureFlags } from "./feature-flags";

export default function Dashboard() {
  return (
    <Suspense fallback={<Loading />}>
      <FeatureFlags>
        <DashboardContent />
      </FeatureFlags>
    </Suspense>
  );
}
```

### Pages Router

#### `getServerSideProps`

```tsx {6-9}
// pages/index.tsx
import { auth } from "@/lib/auth";

export async function getServerSideProps(ctx) {
  const session = await auth.api.getSession(ctx.req);
  const { flags } = await auth.api.bootstrapFeatureFlags({
    body: {
      context: { userId: session?.user?.id, headers: ctx.req.headers as any },
    },
  });

  return {
    props: { flags },
  };
}

export default function Page({ flags }) {
  return flags["new-feature"] ? <NewFeature /> : <OldFeature />;
}
```

#### `getStaticProps`

```tsx {4-6}
// pages/marketing.tsx
export async function getStaticProps() {
  // Evaluate flags without user context
  const { flags } = await auth.api.bootstrapFeatureFlags({
    body: { context: { attributes: { page: "marketing" } } },
  });

  return {
    props: { flags },
    revalidate: 60, // Revalidate every minute
  };
}
```

### Middleware Integration

```typescript {7-14}
// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";

export async function middleware(request: NextRequest) {
  const session = await auth.api.getSession(request);
  const { flags } = await auth.api.bootstrapFeatureFlags({
    body: { context: { userId: session?.user?.id } },
  });

  // Add flags to headers
  const response = NextResponse.next();
  response.headers.set("x-feature-flags", JSON.stringify(flags));

  // Or redirect based on flag
  if (!flags["maintenance-mode"]) {
    return NextResponse.redirect(new URL("/maintenance", request.url));
  }

  return response;
}
```

## Advanced Patterns

### Prefetching Flags

Prefetch flags for better performance:

```typescript
// Prefetch on app load
await authClient.featureFlags.prefetch(["critical-flag-1", "critical-flag-2"]);

// Prefetch on route change
router.beforeEach(async (to) => {
  if (to.name === "dashboard") {
    await authClient.featureFlags.prefetch(["dashboard-features"]);
  }
});
```

### Local Overrides

::: warning Production Safety
Overrides are automatically disabled in production environments. The SDK detects production through:

- `NODE_ENV === 'production'`
- Non-localhost host names
- Build-time environment variables

:::

Override flags for testing:

```typescript
// ✅ Safe: Automatic production detection
authClient.featureFlags.setOverride("new-feature", true);
// Returns false in production, true in development

// ✅ Safe: Conditional override
if (process.env.NODE_ENV === "development") {
  authClient.featureFlags.setOverride("new-feature", true);
  authClient.featureFlags.setOverride("variant-test", {
    key: "variant-b",
    value: { color: "green" },
  });
}

// Clear overrides
authClient.featureFlags.clearOverrides();

// Configure override behavior
const client = featureFlagsClient({
  overrides: {
    ttl: 600000, // 10 minutes
    persist: false, // Don't save to localStorage
  },
});
```

### Context Providers

Add custom context for evaluation:

```typescript
// Set global context
authClient.featureFlags.setContext({
  device: "mobile",
  browser: "chrome",
  version: "1.2.3",
  attributes: {
    page: "checkout",
    cartValue: 99.99,
  },
});

// Context is automatically included in all evaluations
const isEnabled = await authClient.featureFlags.isEnabled("feature");
```

### Error Boundaries

Handle feature flag errors gracefully:

```tsx
import { FeatureFlagErrorBoundary } from "better-auth-feature-flags/react";

function App() {
  return (
    <FeatureFlagErrorBoundary
      fallback={<DefaultExperience />}
      onError={(error) => {
        // Log to error tracking
        console.error("Feature flag error:", error);
      }}
    >
      <FeatureGatedContent />
    </FeatureFlagErrorBoundary>
  );
}
```

### TypeScript Support

#### Type-Safe Flags

```typescript
// Define your flag types
interface MyFlags {
  "dark-mode": boolean;
  "api-version": number;
  "theme-config": {
    primaryColor: string;
    layout: "grid" | "list";
  };
}

// Create typed client
const client = createAuthClient({
  plugins: [featureFlagsClient<MyFlags>()],
});

// Now fully typed
const isDark = await client.featureFlags.isEnabled("dark-mode");
//    ^? boolean

const config = await client.featureFlags.getValue("theme-config");
//    ^? { primaryColor: string; layout: "grid" | "list" }
```

#### Typed Hooks

```tsx
// Type your hooks with generics
interface ThemeConfig {
  primaryColor: string;
  layout: "grid" | "list";
}

const isDarkMode = useFeatureFlag("dark-mode", false);
const config = useFeatureFlagValue<ThemeConfig>("theme-config", {
  primaryColor: "blue",
  layout: "grid",
});

// Values are properly typed
if (config.layout === "grid") {
  // TypeScript knows config.layout is "grid" | "list"
}
```

## Performance Optimization

### Caching Strategy

```typescript
featureFlagsClient({
  cache: {
    enabled: true,
    ttl: 60000, // 1 minute
    storage: "localStorage", // Persist across sessions

    // Cache key strategy
    keyPrefix: "ff_",
    version: "v1", // Bust cache on version change

    // Selective caching
    include: ["static-flag"], // Only cache these
    exclude: ["dynamic-flag"], // Never cache these
  },
});
```

### Batch Requests

```typescript
// Instead of multiple requests
const flag1 = await client.featureFlags.isEnabled("flag1");
const flag2 = await client.featureFlags.isEnabled("flag2");
const flag3 = await client.featureFlags.isEnabled("flag3");

// Use batch evaluation
const flags = await client.featureFlags.evaluateMany([
  "flag1",
  "flag2",
  "flag3",
]);
```

### Lazy Loading

```typescript
// Lazy load flags when needed
const LazyFeature = lazy(async () => {
  const flags = await client.featureFlags.bootstrap();
  return flags["new-feature"] ? import("./NewFeature") : import("./OldFeature");
});
```

## Testing

### Mock Client

```typescript
import { createMockClient } from "better-auth-feature-flags/testing";

const mockClient = createMockClient({
  flags: {
    "test-feature": true,
    "variant-test": {
      key: "variant-a",
      value: { color: "red" }
    }
  }
});

// Use in tests
describe("Feature", () => {
  it("shows new UI when enabled", () => {
    render(
      <FeatureFlagsProvider client={mockClient}>
        <Component />
      </FeatureFlagsProvider>
    );

    expect(screen.getByText("New UI")).toBeInTheDocument();
  });
});
```

### Testing Utilities

```typescript
import { mockFeatureFlag, clearMocks } from "better-auth-feature-flags/testing";

beforeEach(() => {
  mockFeatureFlag("test-feature", true);
});

afterEach(() => {
  clearMocks();
});
```

## Debugging

### Debug Mode

```typescript
featureFlagsClient({
  debug: true, // Enable debug logging

  onEvaluation: (flag, result) => {
    console.log(`Flag ${flag} evaluated to:`, result);
  },
});
```

### DevTools Extension

```typescript
// Enable DevTools integration
if (process.env.NODE_ENV === "development") {
  window.__FEATURE_FLAGS_DEVTOOLS__ = {
    client: authClient,
    flags: await authClient.featureFlags.bootstrap(),
  };
}
```

<!-- Console helpers are not provided by the SDK; use your own devtools if needed. -->

## Migration Guide

### From v0.1.x to v0.2.0

The v0.2.0 release introduces canonical API naming and admin client namespacing as the initial major feature set.

#### Client Admin Methods Migration

```typescript
// ❌ Old (flat admin methods - deprecated)
await authClient.featureFlags.adminCreateFlag({ key: "my-flag" });
await authClient.featureFlags.adminListFlags();
await authClient.featureFlags.adminUpdateFlag({ id: "flag-id" });
await authClient.featureFlags.adminDeleteFlag({ id: "flag-id" });
await authClient.featureFlags.adminCreateRule({ flagId: "flag-id" });
await authClient.featureFlags.adminCreateOverride({ flagId: "flag-id" });

// ✅ New (namespaced admin methods)
await authClient.featureFlags.admin.flags.create({ key: "my-flag" });
await authClient.featureFlags.admin.flags.list();
await authClient.featureFlags.admin.flags.update("flag-id", { enabled: false });
await authClient.featureFlags.admin.flags.delete("flag-id");
await authClient.featureFlags.admin.rules.create({ flagId: "flag-id" });
await authClient.featureFlags.admin.overrides.create({ flagId: "flag-id" });
```

#### Event Tracking Migration

```typescript
// ❌ Old (deprecated)
await authClient.featureFlags.trackEvent("flag-key", "click", 1);

// ✅ New (canonical)
await authClient.featureFlags.track("flag-key", "click", 1);

// ✅ New with idempotency (v0.2.0 feature)
await authClient.featureFlags.track("flag-key", "purchase", 99.99, {
  idempotencyKey: "purchase-123",
});
```

#### Batch Operations Migration

```typescript
// ❌ Old (multiple individual calls)
await authClient.featureFlags.trackEvent("flag1", "event1");
await authClient.featureFlags.trackEvent("flag2", "event2");
await authClient.featureFlags.trackEvent("flag3", "event3");

// ✅ New (batch tracking)
await authClient.featureFlags.trackBatch([
  { flag: "flag1", event: "event1" },
  { flag: "flag2", event: "event2" },
  { flag: "flag3", event: "event3" },
]);
```

### From LaunchDarkly

```typescript
// LaunchDarkly client
const ldValue = ldClient.variation("flag-key", false);

// Better Auth equivalent
const value = await authClient.featureFlags.isEnabled("flag-key", false);
```

### From Unleash

```typescript
// Unleash client
const isEnabled = unleash.isEnabled("flag-key");

// Better Auth equivalent
const isEnabled = await authClient.featureFlags.isEnabled("flag-key");
```

### From Split.io

```typescript
// Split client
const treatment = splitClient.getTreatment("flag-key");

// Better Auth equivalent
const variant = await authClient.featureFlags.getVariant("flag-key");
```

## Security Best Practices

::: warning Critical Security Guidelines
Feature flags can control access to sensitive features. Follow these security practices to prevent unauthorized access.
:::

### Override Security

1. **Never Enable Production Overrides** - Keep `allowInProduction: false` (default)
2. **Use Expiration** - Overrides auto-expire after 1 hour by default
3. **Avoid Persistence** - Don't persist overrides to localStorage in production
4. **Environment Detection** - SDK automatically detects and blocks production overrides
5. **Audit Override Usage** - Monitor when overrides are used in development

```typescript
// ❌ DANGEROUS: Never do this
featureFlagsClient({
  overrides: {
    allowInProduction: true, // Security vulnerability!
    persist: true, // Persists debug state!
  },
});

// ✅ SAFE: Default configuration
featureFlagsClient({
  // Overrides automatically disabled in production
  // No persistence by default
  // 1-hour expiration by default
});
```

### Context Data Protection

See the [Context Security](#context-security) section for PII protection details.

## Best Practices

::: tip Client SDK Best Practices

1. **Cache Appropriately** - Use caching to reduce API calls
2. **Set Defaults** - Always provide default values
3. **Handle Errors** - Gracefully handle network failures
4. **Batch Requests** - Evaluate multiple flags together
5. **Use TypeScript** - Leverage type safety for flags
6. **Prefetch Critical Flags** - Load important flags early
7. **Monitor Performance** - Track evaluation latency
8. **Test Thoroughly** - Use mock client for testing
9. **Use Smart Polling** - Enable polling with appropriate intervals
10. **Session Management** - Cache automatically handles session changes
11. **Secure Overrides** - Never enable overrides in production
12. **Protect Context Data** - Use sanitization to prevent PII leakage
    :::

## Browser Support

The client SDK supports:

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+
- Opera 76+

For older browsers, use polyfills:

```html
<!-- Polyfill for older browsers -->
<script src="https://polyfill.io/v3/polyfill.min.js?features=Promise,fetch"></script>
```

## Bundle Size

Minimal impact on bundle size:

| Package           | Size (minified + gzipped) |
| ----------------- | ------------------------- |
| Core client       | ~3KB                      |
| React integration | ~2KB                      |
| Vue integration   | ~2KB                      |
| Full bundle       | ~5KB                      |

## Support

- **Documentation**: [Full documentation](https://better-auth.com/plugins/feature-flags)
- **GitHub**: [Report issues](https://github.com/better-auth/plugins/issues)
- **Discord**: [Community support](https://discord.gg/better-auth)
