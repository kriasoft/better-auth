# Better Auth: Feature Flags

[![npm version](https://img.shields.io/npm/v/better-auth-feature-flags.svg)](https://www.npmjs.com/package/better-auth-feature-flags)
[![npm downloads](https://img.shields.io/npm/dm/better-auth-feature-flags.svg)](https://www.npmjs.com/package/better-auth-feature-flags)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/kriasoft/better-auth/pulls)
[![Discord](https://img.shields.io/discord/better-auth?label=Discord&logo=discord)](https://discord.gg/SBwX6VeqCY)
[![Sponsor](https://img.shields.io/github/sponsors/koistya?label=Sponsor&logo=github)](https://github.com/sponsors/koistya)

Enterprise-grade feature flag management integrated with Better Auth. Control feature rollouts, run A/B tests, and manage user experiences with powerful targeting rules and real-time evaluation.

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
npm install better-auth-feature-flags

# bun
bun add better-auth-feature-flags

# pnpm
pnpm add better-auth-feature-flags

# yarn
yarn add better-auth-feature-flags
```

## Quick Start

### 1. Server Setup

```typescript
import { betterAuth } from "better-auth";
import { featureFlags } from "better-auth-feature-flags";

const auth = betterAuth({
  plugins: [
    featureFlags({
      storage: "database", // "memory" | "database" | "redis"
      caching: {
        enabled: true,
        ttl: 60, // Cache for 60 seconds
      },
      analytics: {
        trackUsage: true, // Track flag evaluations
        trackPerformance: true, // Track evaluation latency
      },
    }),
  ],
});
```

### 2. Client Setup

```typescript
import { createAuthClient } from "better-auth/client";
import { featureFlagsClient } from "better-auth-feature-flags/client";

const authClient = createAuthClient({
  plugins: [
    featureFlagsClient({
      cache: {
        enabled: true,
        ttl: 60000, // 60 seconds
        storage: "localStorage",
      },
      polling: {
        enabled: true,
        interval: 30000, // Poll every 30 seconds
      },
    }),
  ],
});
```

### 3. Using Feature Flags

#### Simple Flag Check

```typescript
// Server-side
const result = await auth.api.featureFlags.evaluate({
  key: "new-feature",
  userId: session.user.id,
});

// Client-side
const isEnabled = await authClient.featureFlags.isEnabled("new-feature");
```

#### React Integration

```tsx
import {
  FeatureFlagsProvider,
  useFeatureFlag,
  Feature,
  Variant,
} from "better-auth-feature-flags/react";

// Provider setup
function App() {
  return (
    <FeatureFlagsProvider client={authClient}>
      <YourApp />
    </FeatureFlagsProvider>
  );
}

// Using hooks
function Component() {
  const isDarkMode = useFeatureFlag("dark-mode", false);
  return <div className={isDarkMode ? "dark" : "light"}>Content</div>;
}

// Conditional rendering
function Page() {
  return (
    <Feature flag="premium-feature" fallback={<FreeVersion />}>
      <PremiumVersion />
    </Feature>
  );
}

// A/B testing
function Homepage() {
  return (
    <Variant flag="homepage-test">
      <Variant.Case variant="control">
        <ClassicHomepage />
      </Variant.Case>
      <Variant.Case variant="modern">
        <ModernHomepage />
      </Variant.Case>
      <Variant.Default>
        <DefaultHomepage />
      </Variant.Default>
    </Variant>
  );
}
```

## Advanced Features

### Progressive Rollout

```typescript
await auth.api.admin.flags.create({
  key: "new-checkout",
  enabled: true,
  rolloutPercentage: 25, // Start with 25% of users
  defaultValue: false,
});
```

### User Targeting

```typescript
await auth.api.admin.flags.create({
  key: "premium-feature",
  enabled: true,
  rules: [
    {
      conditions: {
        attribute: "subscription",
        operator: "equals",
        value: "premium",
      },
      value: true,
    },
  ],
  defaultValue: false,
});
```

### A/B Testing with Variants

```typescript
await auth.api.admin.flags.create({
  key: "checkout-flow",
  type: "json",
  enabled: true,
  variants: {
    control: { buttonText: "Buy Now", color: "blue" },
    variant_a: { buttonText: "Purchase", color: "green" },
    variant_b: { buttonText: "Get Started", color: "orange" },
  },
});
```

### Type-Safe Flags

```typescript
// Define your flag schema
interface MyFlags {
  "feature.darkMode": boolean;
  "experiment.algorithm": "A" | "B" | "C";
  "config.maxItems": number;
}

// Use with type safety
const client = createAuthClient({
  plugins: [featureFlagsClient<MyFlags>()],
});

const isDark = await client.featureFlags.isEnabled("feature.darkMode");
//    ^? boolean
```

## Security

### Context Sanitization

The SDK automatically sanitizes evaluation context to prevent PII leakage:

```typescript
featureFlagsClient({
  contextSanitization: {
    enabled: true, // Default: true
    strict: true, // Only allow whitelisted fields
    maxUrlSize: 2048, // Max context size for GET requests
    maxBodySize: 10240, // Max context size for POST requests
  },
});
```

### Production Safeguards

Local overrides are automatically disabled in production:

```typescript
// Development only - no effect in production
client.featureFlags.setOverride("debug-feature", true);
```

## Performance

- **Evaluation Latency**: <10ms P50, <100ms P99
- **Throughput**: 100,000+ evaluations/second
- **Cache Hit Rate**: >95% with proper configuration
- **Bundle Size**: ~5KB minified + gzipped (core + React)

## Documentation

📚 **[Full Documentation](https://kriasoft.com/better-auth/feature-flags/overview.html)**

- [Quickstart Guide](https://kriasoft.com/better-auth/feature-flags/quickstart.html) - Get up and running in 5 minutes
- [Configuration](https://kriasoft.com/better-auth/feature-flags/configuration.html) - Detailed configuration options
- [API Reference](https://kriasoft.com/better-auth/feature-flags/api-reference.html) - Complete API documentation
- [Client SDK](https://kriasoft.com/better-auth/feature-flags/client-sdk.html) - Frontend integration guide
- [Device Detection](https://kriasoft.com/better-auth/feature-flags/device-detection.html) - Target by device, browser, OS
- [Troubleshooting](https://kriasoft.com/better-auth/feature-flags/troubleshooting.html) - Common issues and solutions

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
- **Documentation:** [Full docs](https://kriasoft.com/better-auth/feature-flags/overview.html)
- **Discord:** [Community support](https://discord.gg/SBwX6VeqCY)

## Contributing

We welcome contributions! Please see our [Contributing Guide](../../CONTRIBUTING.md) for details.

## Sponsors

This project is made possible by our generous sponsors. Thank you for your support! 🙏

<a href="https://github.com/sponsors/koistya">
  <img src="https://img.shields.io/github/sponsors/koistya?style=social" alt="Sponsor @koistya on GitHub" />
</a>

## License

MIT - See [LICENSE](./LICENSE) for details
