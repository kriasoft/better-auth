// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

// Type augmentations only - no runtime imports to preserve tree-shaking
import type {} from "./augmentation";

import type { BetterAuthPlugin } from "better-auth";
import type { FlagEndpoints } from "./endpoints";
import { definePlugin } from "./internal/define-plugin";
import { createFeatureFlagsPlugin } from "./plugin";
import type { FeatureFlagsOptions, ValidateFlagSchema } from "./types";

/** Infers a schema from the `flags` option */
export type InferFlagSchemaFromOptions<TOptions extends FeatureFlagsOptions> =
  TOptions extends { flags: infer F }
    ? F extends Record<string, any>
      ? { [K in keyof F]: F[K] extends { default: infer D } ? D : any }
      : Record<string, any>
    : Record<string, any>;

/**
 * Better Auth Feature Flags Plugin
 *
 * Provides comprehensive feature flag management with:
 * - Multiple storage backends (memory, database, redis)
 * - Advanced targeting and segmentation
 * - Percentage-based rollouts
 * - A/B testing with variants
 * - Real-time evaluation and caching
 * - Audit logging and analytics
 * - Multi-tenancy support
 *
 * @example
 * ```typescript
 * import { betterAuth } from "better-auth";
 * import { featureFlags } from "better-auth-feature-flags";
 *
 * // Infer schema from options.flags
 * export const auth = betterAuth({
 *   plugins: [
 *     featureFlags({
 *       storage: "database",
 *       flags: {
 *         "dark-mode": { default: false },
 *         "theme": { default: "light" }
 *       }
 *     })
 *   ]
 * });
 *
 * // Or provide explicit schema
 * interface MyFlags {
 *   "feature-a": boolean;
 *   "theme": "light" | "dark";
 * }
 *
 * export const authTyped = betterAuth({
 *   plugins: [featureFlags<MyFlags>({ storage: "database" })]
 * });
 * ```
 */

// Overload for explicit schema type
export function featureFlags<TSchema extends Record<string, any>>(
  options?: FeatureFlagsOptions,
): BetterAuthPlugin & {
  endpoints: FlagEndpoints;
  $Infer: {
    FlagSchema: ValidateFlagSchema<TSchema>;
  };
};

// Overload for schema inference from options.flags
export function featureFlags<
  TOptions extends FeatureFlagsOptions = FeatureFlagsOptions,
>(
  options: TOptions,
): BetterAuthPlugin & {
  endpoints: FlagEndpoints;
  $Infer: {
    FlagSchema: InferFlagSchemaFromOptions<TOptions>;
  };
};

// Implementation
export function featureFlags(
  options: FeatureFlagsOptions = {},
): BetterAuthPlugin & {
  endpoints: FlagEndpoints;
  $Infer: any;
} {
  // Hide complex internal types while preserving endpoint keys for API typing
  const plugin = definePlugin<FlagEndpoints>(createFeatureFlagsPlugin(options));

  // CRITICAL: DO NOT use spread operator as it converts getters to static properties!
  // We must preserve the original plugin object with its live getters (especially 'hooks').
  // Instead, attach $Infer directly to the plugin instance.
  Object.defineProperty(plugin, "$Infer", {
    value: {
      FlagSchema: {} as any,
    },
    enumerable: true,
    configurable: true,
    writable: true,
  });

  return plugin as BetterAuthPlugin & {
    endpoints: FlagEndpoints;
    $Infer: any;
  };
}

export default featureFlags;

// Core schema types for external consumers
export type {
  AuditAction,
  ConditionOperator,
  EvaluationContext,
  EvaluationReason,
  FeatureFlag,
  FlagAudit,
  FlagEvaluation,
  FlagOverride,
  FlagRule,
  FlagType,
  RuleConditions,
} from "./schema";

// Middleware configuration types
export type { ContextCollectionOptions } from "./middleware/context";

// Validation utilities and configuration
export { DEFAULT_HEADER_CONFIG } from "./middleware/validation";
export type { HeaderConfig, ValidationConfig } from "./middleware/validation";
// Main plugin configuration interface
export type { FeatureFlagsOptions } from "./types";

// Client types for application developers
export type {
  FeatureFlagResult,
  FeatureFlagsClient,
  FeatureFlagsClientOptions,
  FeatureFlagVariant,
} from "./client";
