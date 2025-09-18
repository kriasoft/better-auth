# Feature Flags Plugin - Type System Implementation

> **📋 See [Plugin Type Conventions](/specs/plugin-type-conventions.md) for the complete guide**

## Implementation Status

✅ **Applied** - This plugin implements the full type system patterns to resolve TypeScript "excessively deep" errors.

## Plugin-Specific Implementation

### Type Structure

- **Server Plugin**: Returns `{ id, endpoints, $Infer, ... } satisfies BetterAuthPlugin`
- **Client Plugin**: References server via `$InferServerPlugin: {} as ReturnType<typeof featureFlags<TSchema>>`
- **Endpoints**: `FlagEndpoints = ReturnType<typeof createPublicEndpoints> & ReturnType<typeof createAdminEndpoints>`
- **Middleware**: Uses `createAuthMiddleware` (migrated from `better-call`)
- **Type Flow**: `featureFlags<TSchema>` → `$Infer` → `featureFlagsClient<TSchema>` → `$InferServerPlugin`

### Key Files

- `src/internal/define-plugin.ts` - Type boundary utility
- `src/endpoints/index.ts` - Shallow endpoint composition
- `src/middleware/` - Better Auth middleware (5 files migrated)
- `src/index.ts` - Server plugin with `$Infer` type exports
- `src/client.ts` - Client plugin with `$InferServerPlugin` reference

### Unique Aspects

- **Dual endpoint groups**: Public + Admin endpoint composition
- **Middleware migration**: Removed `better-call` peer dependency
- **Complex evaluation context**: Deep type boundaries for rule evaluation
- **Generic schema support**: `<TSchema>` parameter enables typed flag schemas
- **Type inference chain**: Server `$Infer` → Client `$InferServerPlugin` → Full type safety

## Original Problem Solved

This was the **first plugin** to exhibit "Type instantiation is excessively deep" errors due to:

- Large object literals in endpoint definitions
- Deep Zod schemas for flag evaluation
- Complex middleware composition patterns

The `definePlugin<FlagEndpoints>()` pattern with `$Infer` exports and `$InferServerPlugin` references successfully resolved these issues while preserving full `auth.api.*` typing and enabling proper server-client type flow.

## Implementation Pattern

```typescript
// Server exports types via $Infer, including TSchema flow
export function featureFlags<
  TSchema extends Record<string, any> = Record<string, any>,
>(options: FeatureFlagsOptions = {}) {
  const plugin = definePlugin<FlagEndpoints>(createFeatureFlagsPlugin(options));
  return {
    ...plugin,
    $Infer: {
      FeatureFlag: {} as FeatureFlag,
      FlagEvaluation: {} as FlagEvaluation,
      FlagSchema: {} as ValidateFlagSchema<TSchema>, // Enables schema type flow
    },
  } satisfies BetterAuthPlugin;
}

// Client references server via $InferServerPlugin - now captures TSchema
export function featureFlagsClient<
  TSchema extends Record<string, any> = Record<string, any>,
>(options: FeatureFlagsClientOptions<TSchema> = {}) {
  return {
    id: "feature-flags",
    $InferServerPlugin: {} as ReturnType<typeof featureFlags<TSchema>>,
  } satisfies BetterAuthClientPlugin;
}
```

**Critical Fix**: Added `FlagSchema: ValidateFlagSchema<TSchema>` to `$Infer` so that `ReturnType<typeof featureFlags<TSchema>>` carries the actual schema type, enabling true server-to-client type inference.
