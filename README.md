# Better Auth Plugins

[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/kriasoft/better-auth/pulls)
[![Discord](https://img.shields.io/discord/643523529131950086?label=Discord&logo=discord)](https://discord.gg/SBwX6VeqCY)
[![Sponsor](https://img.shields.io/github/sponsors/koistya?label=Sponsor&logo=github)](https://github.com/sponsors/koistya)

A collection of modular plugins extending [Better Auth](https://better-auth.com) with specialized authentication features for modern TypeScript applications. Each plugin is designed to be lightweight, type-safe, and production-ready.

## Available Plugins

### Preview Release

- **[`better-auth-feature-flags`](./plugins/feature-flags)** - Feature flags and gradual roll-outs with user targeting, A/B testing, and admin controls

### In Active Development

🚧 _The following plugins are currently under development:_

- **Security & Compliance**: `abuse-detection`, `fraud-detection`, `compliance`, `backup-codes`
- **User Management**: `impersonation`, `onboarding`, `session-management`, `subscription`
- **Integrations**: `analytics`, `audit-log`, `connect`, `storage`, `webhooks`, `notifications`
- **Access Control**: `rate-limit`, `consent`
- **Development Tools**: `mcp`

## Quick Start

### Installation

Install Better Auth and the plugins you need:

```bash
# Using Bun (recommended)
bun add better-auth better-call better-auth-feature-flags

# Using npm
npm install better-auth better-call better-auth-feature-flags

# Using pnpm
pnpm add better-auth better-call better-auth-feature-flags
```

#### Peer Dependencies

- `better-auth` and `better-call` are peer dependencies.
- `better-call` provides the API/middleware foundation used by Better Auth and this plugin. Better Auth depends on it and re-exports related types.
- Installing both ensures version alignment and avoids resolution issues with strict package managers (e.g., pnpm).

### Basic Setup

```typescript
import { betterAuth } from "better-auth";
import { featureFlags } from "better-auth-feature-flags";

export const auth = betterAuth({
  database: {
    provider: "postgresql",
    url: process.env.DATABASE_URL,
  },
  plugins: [
    // Feature flags and access control
    featureFlags({
      // Optional static flags (server defaults)
      flags: {
        "premium-features": {
          default: false,
          enabled: false,
        },
        "beta-ui": {
          default: false,
          enabled: false,
        },
      },
    }),
  ],
});
```

### Client Integration

```typescript
import { createAuthClient } from "better-auth/client";
import { featureFlagsClient } from "better-auth-feature-flags/client";

const authClient = createAuthClient({
  plugins: [featureFlagsClient()],
});

// Check feature flags (simple boolean checks)
const hasPremiumFeatures =
  await authClient.featureFlags.isEnabled("premium-features");
const canUseBetaUI = await authClient.featureFlags.isEnabled("beta-ui");

// Evaluate multiple flags efficiently
const flags = await authClient.featureFlags.evaluateMany([
  "premium-features",
  "beta-ui",
  "new-dashboard",
]);

// Get all flags for current user
const allFlags = await authClient.featureFlags.bootstrap();

// Track flag usage for analytics
await authClient.featureFlags.track("premium-features", "viewed");

// Admin operations (requires proper permissions)
const adminFlags = await authClient.featureFlags.admin.flags.list();
await authClient.featureFlags.admin.flags.create({
  key: "new-feature",
  name: "New Feature",
  type: "boolean",
  defaultValue: false,
});

if (hasPremiumFeatures) {
  // Show premium features
}
```

## Development

This monorepo uses Bun's built-in workspace support for managing all plugins.

### Prerequisites

- [Bun](https://bun.sh) >= 1.0.0
- Node.js >= 20.0.0 (for compatibility)
- PostgreSQL or compatible database

### Setup

```bash
# Clone the repository
git clone https://github.com/kriasoft/better-auth.git
cd better-auth-plugins

# Install dependencies
bun install

# Migrate the database
bun run db:push

# Build all packages
bun run build

# Run development mode
bun run dev

# Type check all packages
bun run typecheck
```

### Database Commands

```bash
bun run db:studio         # Open Drizzle Studio (database GUI)
bun run db:generate       # Generate migrations from schema changes
bun run db:push           # Push schema changes (development)
bun run db:migrate        # Run migrations (production)
```

### Project Structure

```text
better-auth-plugins/
├── plugins/                # 18 standalone plugins
│   ├── abuse-detection/    ├── analytics/         ├── audit-log/
│   ├── backup-codes/       ├── compliance/        ├── connect/
│   ├── consent/            ├── feature-flags/     ├── fraud-detection/
│   ├── impersonation/      ├── mcp/               ├── notifications/
│   ├── onboarding/         ├── rate-limit/        ├── session-management/
│   ├── storage/            ├── subscription/      └── webhooks/
├── apps/playground/        # Dev environment
├── docs/                   # Documentation site
└── test/                   # Test suites

Plugin structure: src/{index,client,plugin,schema,types}.ts → tsup → dist/
```

## Vendor Dependencies

This project includes reference implementations as Git submodules in the `vendor/` directory. See [vendor/README.md](./vendor/README.md) for details and license information.

## Contributing

We welcome contributions! Please see our [Contributing Guide](.github/CONTRIBUTING.md) for details.

### Development Workflow

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests (`bun test`)
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to your branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## Support

- 🎮 Discord: [Join our community](https://discord.gg/SBwX6VeqCY)
- 💬 Discussions: [GitHub Discussions](https://github.com/kriasoft/better-auth/discussions)
- 🐛 Issues: [GitHub Issues](https://github.com/kriasoft/better-auth/issues)
- 💖 Sponsor: [GitHub Sponsors](https://github.com/sponsors/koistya)

## License

Open source and free to use! This project is licensed under the MIT License - feel free to use it in your personal and commercial projects.
