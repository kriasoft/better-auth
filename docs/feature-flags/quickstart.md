# Quickstart Guide

Get up and running with Better Auth Feature Flags in 5 minutes.

## Installation

Install the feature flags plugin alongside Better Auth:

::: code-group

```bash [bun]
bun add better-auth better-call better-auth-feature-flags
```

```bash [npm]
npm install better-auth better-call better-auth-feature-flags
```

```bash [pnpm]
pnpm add better-auth better-call better-auth-feature-flags
```

```bash [yarn]
yarn add better-auth better-call better-auth-feature-flags
```

> Note
>
> - `better-auth` and `better-call` are peer dependencies of the feature flags plugin.
> - `better-call` is the HTTP API/middleware foundation used by Better Auth and this plugin. Better Auth depends on it and re-exports some of its types.
> - Install matching versions (e.g., `better-auth@^1.3.11`, `better-call@^1.0.19`) to avoid package resolution issues.

:::

## Basic Setup

### 1. Add the Plugin to Your Auth Config

Configure the plugin on your server:

```typescript {3,7-9}
// auth.ts
import { betterAuth } from "better-auth";
import { featureFlags } from "better-auth-feature-flags";

export const auth = betterAuth({
  plugins: [
    featureFlags({
      storage: "database", // or "memory" for development
    }),
  ],
});
```

### 2. Run Database Migrations

If using database storage, create the required tables:

```bash
# Generate migration
npx better-auth migrate

# Apply migration to your database
npx better-auth migrate:run
```

> [!TIP]
> The plugin creates tables for flags, rules, overrides, and optionally analytics. See [Database Schema](./configuration.md#database-schema) for details.

### 3. Initialize Client SDK

Set up the client-side SDK:

```typescript {3,6}
// auth-client.ts
import { createAuthClient } from "better-auth/client";
import { featureFlagsClient } from "better-auth-feature-flags/client";

export const authClient = createAuthClient({
  plugins: [featureFlagsClient()],
});
```

### Client Bundles

Keep the public bundle lean and include admin capabilities only where needed:

```ts
import { createAuthClient } from "better-auth/client";
import { featureFlagsClient } from "better-auth-feature-flags/client";
import { featureFlagsAdminClient } from "better-auth-feature-flags/admin";

// Public surfaces (no admin)
export const publicClient = createAuthClient({
  plugins: [featureFlagsClient()],
});

// Admin surfaces only (add admin plugin)
export const adminClient = createAuthClient({
  plugins: [featureFlagsClient(), featureFlagsAdminClient()],
});
```

## Your First Feature Flag

### Create a Flag

Create your first feature flag programmatically:

```typescript
// Create a simple boolean flag
await auth.api.createFeatureFlag({
  body: {
    key: "new-feature",
    name: "New Feature",
    type: "boolean",
    enabled: true,
    defaultValue: false,
    rolloutPercentage: 0,
    description: "My first feature flag",
  },
});
```

### Evaluate the Flag

Check if a feature is enabled:

::: code-group

```typescript [Server]
// Server-side evaluation
app.get("/api/feature-check", async (req, res) => {
  const session = await auth.getSession(req);
  const result = await auth.api.evaluateFeatureFlag({
    body: { flagKey: "new-feature", context: { userId: session?.user?.id } },
  });

  res.json({ enabled: result.value });
});
```

```typescript [Client]
// Client-side evaluation
const isEnabled = await authClient.featureFlags.isEnabled("new-feature");

if (isEnabled) {
  // Show new feature
  console.log("New feature is enabled!");
}
```

:::

## Common Patterns

### Percentage Rollout

Gradually roll out a feature to users:

```typescript
await auth.api.createFeatureFlag({
  body: {
    key: "beta-feature",
    name: "Beta Feature",
    type: "boolean",
    enabled: true,
    defaultValue: false,
    rolloutPercentage: 25,
  },
});
```

### User Targeting

Target specific users or groups:

```typescript
// Create flag
const { flag } = await auth.api.createFeatureFlag({
  body: {
    key: "premium-feature",
    name: "Premium Feature",
    type: "boolean",
    enabled: true,
    defaultValue: false,
  },
});

// Add targeting rule
await auth.api.createFeatureFlagRule({
  body: {
    flagId: flag.id,
    priority: 0,
    conditions: {
      all: [
        { attribute: "subscription", operator: "equals", value: "premium" },
      ],
    },
    value: true,
  },
});
```

### A/B Testing

Set up an A/B test with variants:

```typescript
await auth.api.createFeatureFlag({
  body: {
    key: "checkout-test",
    name: "Checkout Test",
    type: "json",
    enabled: true,
    defaultValue: { buttonColor: "blue", buttonText: "Buy Now" },
    variants: [
      {
        key: "control",
        weight: 50,
        value: { buttonColor: "blue", buttonText: "Buy Now" },
      },
      {
        key: "variant_a",
        weight: 50,
        value: { buttonColor: "green", buttonText: "Purchase" },
      },
    ],
  },
});

// Get variant key and JSON config
const variantKey = await authClient.featureFlags.getVariant("checkout-test");
const config = await authClient.featureFlags.getValue("checkout-test");
// Use config.buttonColor and config.buttonText
// Or branch on variantKey to control UI
```

## React Integration

First, wrap your app with the provider:

```tsx
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

Then use feature flags in React components:

```tsx
import { useFeatureFlag } from "better-auth-feature-flags/react";

function MyComponent() {
  const isEnabled = useFeatureFlag("new-feature", false);

  return <div>{isEnabled ? <NewFeature /> : <OldFeature />}</div>;
}
```

Or use the component wrapper:

```tsx
import { Feature } from "better-auth-feature-flags/react";

function App() {
  return (
    <Feature flag="premium-feature" fallback={<UpgradePrompt />}>
      <PremiumContent />
    </Feature>
  );
}
```

## Admin Dashboard

### List All Flags

Get all flags with their current status:

```typescript
const { flags } = await auth.api.listFeatureFlags({ query: {} });

flags.forEach((flag) => {
  console.log(`${flag.key}: ${flag.enabled ? "ON" : "OFF"}`);
});
```

### Update a Flag

Toggle a flag on/off:

```typescript
// Disable a flag
await auth.api.updateFeatureFlag({
  body: { id: "flag-id", enabled: false },
});

// Increase rollout percentage
await auth.api.updateFeatureFlag({
  body: { id: "flag-id", rolloutPercentage: 50 },
});
```

### User Override

Override a flag for a specific user:

```typescript
await auth.api.createFeatureFlagOverride({
  body: { flagId: "flag-id", userId: "user-123", value: true },
});
```

## Environment-Specific Flags

Use different configurations per environment:

```typescript
// auth.ts
const isDevelopment = process.env.NODE_ENV === "development";

export const auth = betterAuth({
  plugins: [
    featureFlags({
      storage: isDevelopment ? "memory" : "database",
      flags: isDevelopment
        ? {
            // Default flags for development
            "debug-mode": {
              enabled: true,
              defaultValue: true,
            },
            "new-feature": {
              enabled: true,
              defaultValue: true,
            },
          }
        : undefined,
    }),
  ],
});
```

## Monitoring & Analytics

### Track Flag Usage

Enable analytics to track evaluations:

```typescript
featureFlags({
  analytics: {
    trackUsage: true,
    trackPerformance: true,
  },
});

// Query usage stats
const { stats } = await auth.api.getFeatureFlagStats({
  body: { flagId: "flag-id", period: "day" },
});

console.log(`Evaluations: ${stats.evaluationCount}`);
console.log(`Unique users: ${stats.uniqueUsers}`);
```

### Audit Log

Track who changed flags and when:

```typescript
featureFlags({
  audit: {
    enabled: true,
    retentionDays: 90,
  },
});

// Query audit log
const { entries } = await auth.api.listFeatureFlagAuditEntries({
  body: { flagId: "flag-id", limit: 10 },
});
```

## Best Practices

::: tip Quick Tips

1. **Start with memory storage** during development, switch to database for production
2. **Use descriptive flag keys** like `feature-checkout-v2` instead of `test1`
3. **Set appropriate defaults** that work if the flag system fails
4. **Clean up old flags** to keep your codebase maintainable
5. **Monitor performance** when rolling out to large user bases
   :::

### Flag Authoring Tips (Do/Don’t)

Do

- Use URL‑safe, unique `key` values; avoid renaming after release.
- Keep `type` stable; ensure `defaultValue`, rules, and overrides match it.
- Start disabled with a safe `defaultValue`; ramp with `rolloutPercentage`.
- Define `variants` with weights that sum to 100 and meaningful keys.
- Add `description`/`metadata` for clarity and ownership.
- Scope by `organizationId` when using multi‑tenant mode.

Don’t

- Don’t put PII or secrets in `metadata`/`key`.
- Don’t expect sticky rollout without a stable `userId` in context.
- Don’t omit weights when you need non‑equal variant distribution.
- Don’t rely on overrides as long‑term targeting; prefer rules.

## Common Issues

### Flag Not Found

If a flag returns `not_found`:

- Check the flag key spelling
- Ensure the flag is created
- Verify multi-tenant organization ID if applicable

### Evaluation Latency

For better performance:

- Enable caching with appropriate TTL
- Use bulk evaluation for multiple flags
- Consider Redis for distributed caching

### Type Safety

Use TypeScript generics for type-safe evaluations:

```typescript
// Define your flag types
type MyFlags = {
  "dark-mode": boolean;
  "max-uploads": number;
  "theme-config": { primary: string; secondary: string };
};

// Type-safe evaluation
const isDark =
  await authClient.featureFlags.isEnabled<MyFlags["dark-mode"]>("dark-mode");
const maxUploads =
  await authClient.featureFlags.getValue<MyFlags["max-uploads"]>("max-uploads");
```

## What's Next?

Now that you have feature flags running:

- 📖 Read the [Configuration Guide](./configuration.md) for advanced options
- 🔧 Explore the [API Reference](./api-reference.md) for all available methods
- 📱 Check the [Client SDK Guide](./client-sdk.md) for frontend integration
- 🔍 Review [Troubleshooting](./troubleshooting.md) for common issues

## Example Projects

Check out these complete examples:

- [Basic Setup](https://github.com/better-auth/examples/tree/main/feature-flags-basic) - Minimal configuration
- [React App](https://github.com/better-auth/examples/tree/main/feature-flags-react) - React with hooks and components
- [Multi-tenant](https://github.com/better-auth/examples/tree/main/feature-flags-multitenant) - Organization-based flags
- [A/B Testing](https://github.com/better-auth/examples/tree/main/feature-flags-ab-test) - Variant testing setup
