# Getting Started

> 🚧 **Note:** This project is currently under active development. APIs and features may change before the stable release.

## Overview

Better Auth Plugins is a collection of 17 enterprise-grade plugins that extend [Better Auth](https://better-auth.com) with powerful features like cloud storage integration, advanced security, analytics, and more.

## Prerequisites

- **Better Auth** v0.5.0 or higher
- **Node.js** 18+ or **Bun** 1.0+
- **TypeScript** 5.0+ (recommended)

## Installation

Install the plugins you need via your preferred package manager:

```bash
# Using Bun (recommended)
bun add better-auth-feature-flags better-auth-storage

# Using npm
npm install better-auth-feature-flags better-auth-storage

# Using pnpm
pnpm add better-auth-feature-flags better-auth-storage

# Using yarn
yarn add better-auth-feature-flags better-auth-storage
```

## Basic Setup

Configure Better Auth with your chosen plugins:

```typescript
import { betterAuth } from "better-auth";
import { featureFlags } from "better-auth-feature-flags";
import { storagePlugin } from "better-auth-storage";
import { analyticsPlugin } from "better-auth-analytics";

export const auth = betterAuth({
  // Your Better Auth config
  database: {
    // ...
  },

  // Add plugins
  plugins: [
    featureFlags({
      storage: "database",
      analytics: { trackUsage: true },
    }),
    storagePlugin({
      providers: ["google-drive", "onedrive"],
    }),
    analyticsPlugin({
      trackEvents: true,
    }),
  ],
});
```

## Client-Side Setup

For client-side functionality, import from the plugin's client module:

```typescript
import { createAuthClient } from "better-auth/client";
import { featureFlagsClient } from "better-auth-feature-flags/client";
import { storageClient } from "better-auth-storage/client";

const client = createAuthClient({
  plugins: [featureFlagsClient(), storageClient()],
});

// Use feature flags
const isNewFeatureEnabled = await client.featureFlags.isEnabled("new-feature");
```

## Available Plugins

| Plugin             | Package                          | Description                                                 |
| ------------------ | -------------------------------- | ----------------------------------------------------------- |
| Feature Flags      | `better-auth-feature-flags`      | Feature toggles, A/B testing, and gradual rollouts          |
| Storage            | `better-auth-storage`            | Cloud storage integration (Google Drive, OneDrive, Dropbox) |
| Analytics          | `better-auth-analytics`          | User behavior and auth event tracking                       |
| Rate Limit         | `better-auth-rate-limit`         | Request throttling and brute force protection               |
| Audit Log          | `better-auth-audit-log`          | Comprehensive activity logging                              |
| Session Management | `better-auth-session-management` | Advanced session control and device management              |
| Fraud Detection    | `better-auth-fraud-detection`    | Fraud prevention and risk scoring                           |
| Impersonation      | `better-auth-impersonation`      | Admin user impersonation for support                        |
| Webhooks           | `better-auth-webhooks`           | Event-driven integrations                                   |
| Notifications      | `better-auth-notifications`      | Email, SMS, and push notifications                          |
| Consent            | `better-auth-consent`            | GDPR compliance and privacy management                      |
| Compliance         | `better-auth-compliance`         | Regulatory compliance tools                                 |
| Backup Codes       | `better-auth-backup-codes`       | Recovery codes for 2FA                                      |
| Subscription       | `better-auth-subscription`       | Subscription and billing management                         |
| Onboarding         | `better-auth-onboarding`         | User onboarding flows                                       |
| Abuse Detection    | `better-auth-abuse-detection`    | Abuse and spam prevention                                   |
| MCP                | `better-auth-mcp`                | Model Context Protocol integration                          |

## TypeScript Support

All plugins are written in TypeScript and provide full type definitions:

```typescript
import type { StorageOptions } from "better-auth-storage";

const config: StorageOptions = {
  providers: ["google-drive"],
  syncInterval: 300,
};
```

## Next Steps

- Explore the available plugins and their configurations
- Check the Better Auth documentation for core features
- Review the TypeScript types for better IDE support

## Status

This project is actively being developed. Follow our progress:

- [GitHub Repository](https://github.com/kriasoft/better-auth)
- [Roadmap & Issues](https://github.com/kriasoft/better-auth/issues)
