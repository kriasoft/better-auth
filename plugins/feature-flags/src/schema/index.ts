// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

/**
 * Schema module exports. Import from here, not submodules.
 *
 * REQUIRED CONSTRAINTS (add manually after table creation):
 * - flag_overrides(flag_id, user_id) - unique
 * - feature_flags(organization_id, key) - unique
 *
 * @decision External cron for scheduled rollouts (performance)
 * @decision No flag dependencies in v1 (complexity vs usage)
 * @see tables.ts - DB schema, validation.ts - runtime validation, types.ts - TS types
 */

// Database schema
export { featureFlagsSchema } from "./tables";

// Validation schemas
export {
  auditActionSchema,
  conditionOperatorSchema,

  // Condition schemas
  conditionSchema,
  evaluationContextSchema,
  evaluationReasonSchema,
  // Input validation schemas
  featureFlagInputSchema,
  flagAuditInputSchema,
  flagEvaluationInputSchema,
  flagOverrideInputSchema,
  flagOverrideUpsertSchema,
  flagRuleInputSchema,
  // Enum schemas
  flagTypeSchema,
  ruleConditionsSchema,

  // Variant schemas
  variantSchema,
} from "./validation";

// TypeScript types
export type {
  AnalyticsConfig,
  AuditAction,
  AuditConfig,
  BatchEvaluationResult,
  // Configuration types
  CacheConfig,
  ConditionOperator,
  EvaluationContext,
  EvaluationReason,
  // API types
  EvaluationResult,
  // Entity types
  FeatureFlag,
  FlagAudit,
  FlagEvaluation,
  FlagOverride,
  // Query types
  FlagQuery,
  FlagRule,
  // Base types
  FlagType,
  FlagWithOverrides,
  FlagWithRules,
  FlagWithStats,
  RuleConditions,
  Variant,
} from "./types";
