# Connect Plugin - Type System Implementation

> **📋 See [Plugin Type Conventions](/specs/plugin-type-conventions.md) for the complete guide**

## Implementation Status

✅ **Applied** - This plugin was refactored to implement type system patterns for safe composition.

## Plugin-Specific Implementation

### Type Structure

- **Endpoints**: `ConnectEndpoints = ReturnType<typeof createConnectEndpoints>`
- **Plugin Surface**: `BetterAuthPlugin & { endpoints: ConnectEndpoints }`

### Key Files

- `src/internal/define-plugin.ts` - Type boundary utility
- `src/endpoints/index.ts` - Endpoint composition from modular structure
- `src/plugin.ts` - Core plugin logic (extracted from index)
- `src/types.ts` - Interface definitions
- `src/index.ts` - Plugin export with `definePlugin<ConnectEndpoints>()`

### Refactoring Applied

- **Modularization**: Extracted 500+ LOC monolithic structure into organized modules
- **Endpoint organization**: Moved inline endpoints to dedicated `src/endpoints/` structure
- **Type extraction**: Separated interfaces to `src/types.ts`
- **Shallow composition**: Used `ReturnType<typeof createConnectEndpoints>` pattern

## Multi-Provider OAuth Complexity

This plugin manages complex OAuth flows for multiple data sources:

- Google Drive, Gmail, GitHub, OneDrive, Dropbox
- Connection lifecycle (authorize, callback, disconnect, sync)
- Webhook processing and metadata management

The modular structure and type boundaries prevent TypeScript from exploring deep OAuth configuration literals during plugin composition.
