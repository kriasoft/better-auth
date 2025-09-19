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

Export plugins with controlled type boundaries and type inference support:

```typescript
// plugins/{name}/src/index.ts
export function myPlugin<
  TSchema extends Record<string, any> = Record<string, any>,
>(options: MyPluginOptions = {}) {
  const plugin = definePlugin<MyEndpoints>(createMyPlugin(options));
  return {
    ...plugin,
    $Infer: {
      MyType: {} as MyType,
      AnotherType: {} as AnotherType,
    },
  } satisfies BetterAuthPlugin;
}
```

### Client Plugin Type Safety

Client plugins MUST reference their server plugin via `$InferServerPlugin`:

```typescript
// ❌ Breaks type inference
export function myPluginClient<TSchema>() {
  return {
    id: "my-plugin",
    // Missing $InferServerPlugin
  };
}

// ✅ Enables type safety
export function myPluginClient<TSchema>() {
  return {
    id: "my-plugin",
    $InferServerPlugin: {} as ReturnType<typeof myPlugin<TSchema>>,
  };
}
```

This enables server-to-client type flow for endpoints, schemas, and inference types.

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

4. **Apply `definePlugin` wrapper with `$Infer` exports**

```typescript
export function myPlugin<TSchema>() {
  const plugin = definePlugin<MyEndpoints>(createMyPlugin());
  return {
    ...plugin,
    $Infer: { MyType: {} as MyType },
  } satisfies BetterAuthPlugin;
}
```

5. **Create corresponding client plugin with `$InferServerPlugin`**

```typescript
// plugins/{name}/src/client.ts
export function myPluginClient<
  TSchema extends Record<string, any> = Record<string, any>,
>(options: MyPluginClientOptions<TSchema> = {}) {
  return {
    id: "my-plugin",
    $InferServerPlugin: {} as ReturnType<typeof myPlugin<TSchema>>,
    pathMethods: {
      /* ... */
    },
    getActions: (fetch) => ({
      /* ... */
    }),
  } satisfies BetterAuthClientPlugin;
}
```

6. **Create plugin-specific type spec**

```
plugins/{name}/specs/types-spec.md
```

7. **Add a Compositional Type Test**

To prevent regressions that break `better-auth`'s type inference, add a dedicated type test file that simulates plugin composition. This is the _only_ reliable way to catch "excessively deep type instantiation" errors.

- Create a test file (e.g., `src/type-regression.test.ts`).
- In this file, initialize `betterAuth` with your plugin _and_ at least one other complex plugin (e.g., `organization`).
- Write a test that asserts that the core `auth.api` methods and the methods from both plugins are present and correctly typed.
- This test serves as a canary; if it compiles and passes, type composition is healthy.

**Example (`type-regression.test.ts`):**

```typescript
import { test, expect } from "bun:test";
import { betterAuth } from "better-auth";
import { organization } from "better-auth/plugins";
import { myPlugin } from "./index";

test("Plugin composition does not break type inference", () => {
  const auth = betterAuth({
    plugins: [
      organization(),
      myPlugin({
        /* options */
      }),
    ],
  });

  // Verify methods from all sources are available
  expect(typeof auth.api.getSession).toBe("function"); // Core
  expect(typeof auth.api.createOrganization).toBe("function"); // Other plugin
  expect(typeof auth.api.myPluginMethod).toBe("function"); // Your plugin

  // A high method count indicates successful type merging
  expect(Object.keys(auth.api).length).toBeGreaterThan(50);
});
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

## Complete Example

Server and client type flow:

```typescript
// Server Plugin
export function myPlugin<
  TSchema extends Record<string, any> = Record<string, any>,
>(options: MyPluginOptions = {}) {
  const plugin = definePlugin<MyEndpoints>(createMyPlugin(options));
  return {
    ...plugin,
    $Infer: { MyEntity: {} as MyEntity },
  } satisfies BetterAuthPlugin;
}

// Client Plugin
export function myPluginClient<
  TSchema extends Record<string, any> = Record<string, any>,
>(options: MyPluginClientOptions<TSchema> = {}) {
  return {
    id: "my-plugin",
    $InferServerPlugin: {} as ReturnType<typeof myPlugin<TSchema>>,
    getActions: (fetch) => ({
      myPlugin: {
        async doAction(data: MyEntity) {
          // TypeScript infers MyEntity from server
          return await fetch("/my-plugin/action", {
            method: "POST",
            body: data,
          });
        },
      },
    }),
  } satisfies BetterAuthClientPlugin;
}
```

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
