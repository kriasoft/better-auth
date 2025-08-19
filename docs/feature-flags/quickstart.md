# Quickstart Guide

Get up and running with Better Auth Feature Flags in 5 minutes.

## Installation

Install the feature flags plugin alongside Better Auth:

::: code-group

```bash [bun]
bun add better-auth-feature-flags
```

```bash [npm]
npm install better-auth-feature-flags
```

```bash [pnpm]
pnpm add better-auth-feature-flags
```

```bash [yarn]
yarn add better-auth-feature-flags
```

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

## Your First Feature Flag

### Create a Flag

Create your first feature flag programmatically:

```typescript
// Create a simple boolean flag
await auth.api.admin.flags.create({
  key: "new-feature",
  type: "boolean",
  enabled: true,
  defaultValue: false,
  description: "My first feature flag",
});
```

### Evaluate the Flag

Check if a feature is enabled:

::: code-group

```typescript [Server]
// Server-side evaluation
app.get("/api/feature-check", async (req, res) => {
  const session = await auth.getSession(req);
  const result = await auth.api.flags.evaluate({
    key: "new-feature",
    context: { userId: session?.user?.id },
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
await auth.api.admin.flags.create({
  key: "beta-feature",
  type: "boolean",
  enabled: true,
  defaultValue: false,
  rolloutPercentage: 25, // 25% of users
});
```

### User Targeting

Target specific users or groups:

```typescript
await auth.api.admin.flags.create({
  key: "premium-feature",
  type: "boolean",
  enabled: true,
  defaultValue: false,
  rules: [
    {
      priority: 1,
      conditions: {
        attribute: "subscription",
        operator: "equals",
        value: "premium",
      },
      value: true,
    },
  ],
});
```

### A/B Testing

Set up an A/B test with variants:

```typescript
await auth.api.admin.flags.create({
  key: "checkout-test",
  type: "json",
  enabled: true,
  variants: {
    control: {
      buttonColor: "blue",
      buttonText: "Buy Now",
    },
    variant_a: {
      buttonColor: "green",
      buttonText: "Purchase",
    },
  },
  defaultValue: {
    buttonColor: "blue",
    buttonText: "Buy Now",
  },
});

// Get variant for user
const variant = await authClient.featureFlags.getVariant("checkout-test");
// Use variant.buttonColor and variant.buttonText
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
const response = await auth.api.admin.flags.list();
const flags = response.flags;

flags.forEach((flag) => {
  console.log(`${flag.key}: ${flag.enabled ? "ON" : "OFF"}`);
});
```

### Update a Flag

Toggle a flag on/off:

```typescript
// Disable a flag
await auth.api.admin.flags.update({
  id: "flag-id",
  enabled: false,
});

// Increase rollout percentage
await auth.api.admin.flags.update({
  id: "flag-id",
  rolloutPercentage: 50,
});
```

### User Override

Override a flag for a specific user:

```typescript
await auth.api.admin.overrides.create({
  flagId: "flag-id",
  userId: "user-123",
  value: true,
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
const stats = await auth.api.admin.flags.stats({
  id: "flag-id",
  period: "7d",
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
const logs = await auth.api.admin.audit.list({
  flagId: "flag-id",
  limit: 10,
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
