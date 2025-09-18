# Better Auth Plugin Type System Conventions

This document establishes TypeScript conventions for Better Auth plugins to prevent "Type instantiation is excessively deep and possibly infinite" compilation errors while maintaining excellent developer experience.

## Problem Statement

Better Auth's core uses `UnionToIntersection` to merge plugin type contributions. When plugins expose large, nested object literal types containing builders, Zod schemas, and conditional types, TypeScript explores enormous type graphs during composition, causing compilation failures.

## Solution: Controlled Type Boundaries

### Core Pattern: `definePlugin<E>()`

Create shallow interface boundaries that hide complex plugin internals while preserving endpoint name typing for `auth.api.*` access.

```typescript
// plugins/{name}/src/internal/define-plugin.ts
export function definePlugin<E extends Record<string, unknown>>(
  plugin: any,
): BetterAuthPlugin & { endpoints: E } {
  return plugin as BetterAuthPlugin & { endpoints: E };
}
```

### Endpoint Type Composition

Use `ReturnType<typeof builder>` patterns instead of deep literal types:

```typescript
// ❌ Problematic: Deep literal type
export type BadEndpoints = NonNullable<BetterAuthPlugin["endpoints"]>;

// ✅ Good: Shallow composed type
export type GoodEndpoints = ReturnType<typeof createPublicEndpoints> &
  ReturnType<typeof createAdminEndpoints>;
```

### Plugin Surface Pattern

Export plugins with controlled type boundaries:

```typescript
// plugins/{name}/src/index.ts
export function myPlugin(
  options: MyPluginOptions = {},
): BetterAuthPlugin & { endpoints: MyEndpoints } {
  return definePlugin<MyEndpoints>(createMyPlugin(options));
}
```

## Implementation Checklist

When creating or refactoring a plugin:

### ✅ Required Changes

1. **Create `definePlugin` utility**

   ```
   plugins/{name}/src/internal/define-plugin.ts
   ```

2. **Organize endpoints with shallow types**

   ```typescript
   // plugins/{name}/src/endpoints/index.ts
   export type MyEndpoints = ReturnType<typeof createMyEndpoints>;
   ```

3. **Use Better Auth endpoint builders**

   ```typescript
   import { createAuthEndpoint } from "better-auth/plugins";
   ```

4. **Apply `definePlugin` wrapper**

   ```typescript
   export function myPlugin(): BetterAuthPlugin & { endpoints: MyEndpoints } {
     return definePlugin<MyEndpoints>(createMyPlugin());
   }
   ```

5. **Create plugin-specific type spec**
   ```
   plugins/{name}/specs/types-spec.md
   ```

### ⚠️ Conditional Application

Apply these patterns only to plugins that:

- Have complex endpoint structures (>5 endpoints)
- Use deep Zod schemas or conditional types
- Cause TypeScript compilation issues
- Are >100 lines of code

### ❌ Skip for Simple Plugins

Don't over-engineer simple plugins that:

- Have <5 endpoints
- Use basic `BetterAuthPlugin` interface
- Compile without issues
- Are <100 lines of code

## Architecture Benefits

- **Type Safety**: Full endpoint name preservation for `auth.api.*`
- **Performance**: Faster TypeScript compilation
- **Maintainability**: Clear separation of concerns
- **Compatibility**: Zero breaking changes to existing APIs
- **Scalability**: Prevents type depth issues as codebase grows

## Migration Guide

### For Existing Plugins

1. Analyze plugin complexity (endpoints, LOC, type depth)
2. If complex, apply full pattern
3. If simple, monitor for future issues
4. Test TypeScript compilation after changes
5. Verify API compatibility

### For New Plugins

1. Start with basic `BetterAuthPlugin` interface
2. Monitor complexity as development progresses
3. Apply patterns when hitting type depth limits
4. Use this guide as reference throughout development

## Examples

- **Applied**: `plugins/feature-flags/` (complex, 500+ LOC) - [Implementation details](../plugins/feature-flags/specs/types-spec.md)
- **Applied**: `plugins/connect/` (complex, multiple endpoint groups) - [Implementation details](../plugins/connect/specs/types-spec.md)
- **Applied**: `plugins/storage/` (complex, multiple providers) - [Implementation details](../plugins/storage/specs/types-spec.md)
- **Monitor**: `plugins/abuse-detection/` (200+ LOC)
- **Skip**: `plugins/webhooks/` (simple, <100 LOC)

## Reference Implementation

See plugin-specific implementation details:

- **Original solution**: [Feature Flags](../plugins/feature-flags/specs/types-spec.md) - First plugin to solve TypeScript depth issues
- **Refactoring example**: [Connect](../plugins/connect/specs/types-spec.md) - Large monolithic plugin modularization
- **Enhancement example**: [Storage](../plugins/storage/specs/types-spec.md) - Adding boundaries to existing structure
