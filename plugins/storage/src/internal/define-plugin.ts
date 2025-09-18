// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

/**
 * TypeScript utilities to solve deep type instantiation issues in Better Auth plugins.
 *
 * Context: Better Auth's core uses UnionToIntersection to merge plugin $Infer types,
 * causing "Type instantiation is excessively deep" errors when plugins expose large
 * object literals. This module provides controlled type boundaries to prevent depth blowup.
 */

import type { BetterAuthPlugin } from "better-auth";

/**
 * Controls TypeScript inference depth by hiding complex plugin internals behind
 * a shallow interface boundary. Preserves endpoint names for auth.api.* typing
 * while preventing Better Auth's UnionToIntersection from exploring deep types.
 *
 * @param plugin - The raw plugin implementation with complex internal types
 * @returns Plugin with controlled type surface for safe composition
 *
 * @example
 * ```typescript
 * // Before: Type instantiation error with complex plugin
 * export const storagePlugin = () => createComplexPlugin() // ❌ Deep types exposed
 *
 * // After: Controlled boundary prevents depth issues
 * export const storagePlugin = () => definePlugin<StorageEndpoints>(createComplexPlugin()) // ✅
 * ```
 */
export function definePlugin<E extends Record<string, unknown>>(
  plugin: any,
): BetterAuthPlugin & { endpoints: E } {
  // NOTE: Type assertion is intentional - we're creating a controlled boundary
  // to prevent TypeScript's UnionToIntersection from exploring plugin internals
  return plugin as BetterAuthPlugin & { endpoints: E };
}

/**
 * Helper for type-safe plugin array composition. Prevents TypeScript from
 * widening plugin array types during betterAuth({ plugins }) initialization.
 *
 * @param plugins - Plugin instances to compose
 * @returns Strongly-typed plugin array preserving individual plugin signatures
 *
 * @example
 * ```typescript
 * // Prevents type widening in plugin composition
 * const auth = betterAuth({
 *   plugins: withPlugins(organization(), storagePlugin()) // Type-safe
 * });
 * ```
 */
export function withPlugins<T extends BetterAuthPlugin[]>(...plugins: T): T {
  return plugins;
}
