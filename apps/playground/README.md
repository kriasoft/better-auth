# Better Auth Playground

Interactive web application for testing and experimenting with Better Auth plugins in development.

## What's Included

- **Full-stack playground** with client and server components
- **Plugin testing environment** for all 18 Better Auth plugins
- **Live configuration** via environment variables
- **Development tools** for rapid plugin iteration

## Getting Started

```bash
# From project root
bun run dev

# Or run playground specifically
cd apps/playground
bun run dev
```

The playground runs on `http://localhost:5173` and provides a complete Better Auth setup for testing plugin functionality, authentication flows, and integration patterns.

## Plugin Configuration

Enable/disable plugins via environment variables in the root `.env` file:

```bash
BETTER_AUTH_FEATURE_FLAGS=1    # Enable feature flags
BETTER_AUTH_STORAGE=0          # Disable storage
# ... see .env for all available plugins
```

## Development

This playground serves as both a testing ground and reference implementation for Better Auth plugin development.
