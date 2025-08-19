// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

// Type augmentations must be imported first
import "./augmentation";

import type { BetterAuthPlugin } from "better-auth";
import { createFeatureFlagsPlugin } from "./plugin";
import type { ContextCollectionOptions } from "./middleware/context";
import type { HeaderConfig, ValidationConfig } from "./middleware/validation";

export interface FeatureFlagsOptions {
  flags?: {
    [key: string]: {
      enabled?: boolean;
      default?: boolean;
      rollout?: number; // Percentage 0-100
      targeting?: {
        roles?: string[];
        userIds?: string[];
        attributes?: Record<string, any>;
      };
      variants?: {
        [key: string]: any;
      };
    };
  };
  storage?: "memory" | "database" | "redis";
  analytics?: {
    trackUsage?: boolean;
    trackPerformance?: boolean;
  };
  adminAccess?: {
    enabled?: boolean;
    roles?: string[];
  };
  multiTenant?: {
    enabled?: boolean;
    useOrganizations?: boolean;
  };
  caching?: {
    enabled?: boolean;
    ttl?: number; // seconds
  };
  audit?: {
    enabled?: boolean;
    retentionDays?: number;
  };
  /**
   * Configure what context data to collect for flag evaluation.
   * By default, only basic session data is collected for privacy.
   */
  contextCollection?: ContextCollectionOptions;
  /**
   * Configure custom header processing for feature flag evaluation.
   * Provides a secure whitelist-based approach for header extraction.
   */
  customHeaders?: {
    enabled?: boolean;
    whitelist?: HeaderConfig[];
    strict?: boolean;
    logInvalid?: boolean;
  };
  /**
   * Configure validation rules for context data.
   * Helps prevent memory exhaustion and security issues.
   */
  contextValidation?: ValidationConfig;
}

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
export function featureFlags(
  options: FeatureFlagsOptions = {},
): BetterAuthPlugin {
  return createFeatureFlagsPlugin(options);
}

export default featureFlags;

// Re-export types from schema
export type {
  FeatureFlag,
  FlagRule,
  FlagOverride,
  FlagEvaluation,
  FlagAudit,
  EvaluationContext,
  FlagType,
  EvaluationReason,
  AuditAction,
  ConditionOperator,
  RuleConditions,
} from "./schema";

// Re-export context collection options
export type { ContextCollectionOptions } from "./middleware/context";

// Re-export validation types
export type { HeaderConfig, ValidationConfig } from "./middleware/validation";
export { DEFAULT_HEADER_CONFIG } from "./middleware/validation";
