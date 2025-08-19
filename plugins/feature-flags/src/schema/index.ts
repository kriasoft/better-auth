// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

/**
 * Central schema export. Import from here, not submodules.
 *
 * @structure
 * - tables.ts: DB schema + constraints
 * - validation.ts: Runtime validation
 * - types.ts: TypeScript types
 *
 * @invariant Add unique constraints manually after table creation:
 * - flag_overrides(flag_id, user_id)
 * - feature_flags(organization_id, key)
 *
 * @decision Scheduled rollouts via external cron, not DB fields (performance)
 * @decision No flag dependencies in v1 (complexity vs usage)
 */

// Database schema
export { featureFlagsSchema } from "./tables";

// Validation schemas
export {
  // Enum schemas
  flagTypeSchema,
  evaluationReasonSchema,
  auditActionSchema,
  conditionOperatorSchema,

  // Condition schemas
  conditionSchema,
  ruleConditionsSchema,

  // Variant schemas
  variantSchema,

  // Input validation schemas
  featureFlagInputSchema,
  flagRuleInputSchema,
  flagOverrideInputSchema,
  flagOverrideUpsertSchema,
  flagEvaluationInputSchema,
  flagAuditInputSchema,
  evaluationContextSchema,
} from "./validation";

// TypeScript types
export type {
  // Base types
  FlagType,
  EvaluationReason,
  AuditAction,
  ConditionOperator,
  RuleConditions,
  EvaluationContext,
  Variant,

  // Entity types
  FeatureFlag,
  FlagRule,
  FlagOverride,
  FlagEvaluation,
  FlagAudit,

  // API types
  EvaluationResult,
  BatchEvaluationResult,

  // Query types
  FlagQuery,
  FlagWithRules,
  FlagWithOverrides,
  FlagWithStats,

  // Configuration types
  CacheConfig,
  AuditConfig,
  AnalyticsConfig,
} from "./types";
