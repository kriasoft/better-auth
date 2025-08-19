# Better Auth Plugins

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
bun add better-auth better-auth-feature-flags

# Using npm
npm install better-auth better-auth-feature-flags

# Using pnpm
pnpm add better-auth better-auth-feature-flags
```

### Basic Setup

```typescript
import { betterAuth } from "better-auth";
import { featureFlagsPlugin } from "better-auth-feature-flags";

export const auth = betterAuth({
  database: {
    provider: "postgresql",
    url: process.env.DATABASE_URL,
  },
  plugins: [
    // Feature flags and access control
    featureFlagsPlugin({
      flags: {
        "premium-features": {
          description: "Access to premium features",
          defaultValue: false,
        },
        "beta-ui": {
          description: "New beta UI design",
          defaultValue: false,
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

// Check feature flags
const hasPremiumFeatures =
  await authClient.featureFlags.isEnabled("premium-features");
const canUseBetaUI = await authClient.featureFlags.isEnabled("beta-ui");

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

# Build all packages
bun run build

# Run development mode
bun run dev

# Type check all packages
bun run typecheck
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
