// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

// Type augmentations only - no runtime imports to preserve tree-shaking
import type {} from "./augmentation";

import type { BetterAuthPlugin } from "better-auth";
import type { FlagEndpoints } from "./endpoints";
import { definePlugin } from "./internal/define-plugin";
import { createFeatureFlagsPlugin } from "./plugin";
import type {
  EvaluationContext,
  EvaluationReason,
  FeatureFlag,
  FlagAudit,
  FlagEvaluation,
  FlagOverride,
  FlagRule,
} from "./schema";
import type { FeatureFlagsOptions, ValidateFlagSchema } from "./types";

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
 * export const auth = betterAuth({
 *   plugins: [
 *     featureFlags({
 *       storage: "database",
 *       caching: { enabled: true, ttl: 60 },
 *       analytics: { trackUsage: true },
 *     })
 *   ]
 * });
 * ```
 */
export function featureFlags<
  TSchema extends Record<string, any> = Record<string, any>,
>(
  options: FeatureFlagsOptions = {},
): BetterAuthPlugin & {
  endpoints: FlagEndpoints;
  $Infer: {
    FeatureFlag: FeatureFlag;
    FlagEvaluation: FlagEvaluation;
    FlagOverride: FlagOverride;
    FlagRule: FlagRule;
    FlagAudit: FlagAudit;
    EvaluationContext: EvaluationContext;
    EvaluationReason: EvaluationReason;
    FlagSchema: ValidateFlagSchema<TSchema>;
  };
} {
  // Hide complex internal types while preserving endpoint keys for API typing
  const plugin = definePlugin<FlagEndpoints>(createFeatureFlagsPlugin(options));

  return {
    ...plugin,
    $Infer: {
      FeatureFlag: {} as FeatureFlag,
      FlagEvaluation: {} as FlagEvaluation,
      FlagOverride: {} as FlagOverride,
      FlagRule: {} as FlagRule,
      FlagAudit: {} as FlagAudit,
      EvaluationContext: {} as EvaluationContext,
      EvaluationReason: {} as EvaluationReason,
      FlagSchema: {} as ValidateFlagSchema<TSchema>,
    },
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
