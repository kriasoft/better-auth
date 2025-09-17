// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

/**
 * TypeScript type definitions for compile-time safety.
 *
 * @decision Entity types = Zod infer + DB fields (id, timestamps)
 * @decision Date objects not strings for type safety
 * @performance CacheConfig.ttl: 60-300s (freshness vs load)
 * @performance AnalyticsConfig.sampleRate: 0.01-0.1 (high traffic)
 * @see ./validation.ts for Zod schemas
 */

import type * as z from "zod";
import type {
  auditActionSchema,
  conditionOperatorSchema,
  environmentParamSchema,
  evaluationContextSchema,
  evaluationReasonSchema,
  featureFlagInputSchema,
  fieldsSchema,
  flagAuditInputSchema,
  flagEvaluationInputSchema,
  flagEventBatchInputSchema,
  flagEventInputSchema,
  flagOverrideInputSchema,
  flagRuleInputSchema,
  flagTypeSchema,
  ruleConditionsSchema,
  shapeModeSchema,
  variantSchema,
} from "./validation";

// Base types from validation schemas
export type FlagType = z.infer<typeof flagTypeSchema>;
export type EvaluationReason = z.infer<typeof evaluationReasonSchema>;
export type AuditAction = z.infer<typeof auditActionSchema>;
export type ConditionOperator = z.infer<typeof conditionOperatorSchema>;
export type RuleConditions = z.infer<typeof ruleConditionsSchema>;
export type EvaluationContext = z.infer<typeof evaluationContextSchema>;
export type SelectMode = z.infer<typeof shapeModeSchema>;
export type EnvironmentParam = z.infer<typeof environmentParamSchema>;
export type Fields = z.infer<typeof fieldsSchema>;
export type Variant = z.infer<typeof variantSchema>;

// Entity types with database fields
export type FeatureFlag = z.infer<typeof featureFlagInputSchema> & {
  id: string;
  organizationId?: string;
  createdAt: Date;
  updatedAt: Date;
};

export type FlagRule = z.infer<typeof flagRuleInputSchema> & {
  id: string;
  flagId: string;
  createdAt: Date;
};

export type FlagOverride = z.infer<typeof flagOverrideInputSchema> & {
  id: string;
  createdAt: Date;
};

export type FlagEvaluation = z.infer<typeof flagEvaluationInputSchema> & {
  id: string;
  evaluatedAt: Date;
};

export type FlagAudit = z.infer<typeof flagAuditInputSchema> & {
  id: string;
  createdAt: Date;
};

export type FlagEvent = z.infer<typeof flagEventInputSchema> & {
  id: string;
  userId: string;
  sessionId?: string;
  eventId: string;
  idempotencyKey?: string;
  createdAt: Date;
};

export type FlagEventBatch = z.infer<typeof flagEventBatchInputSchema> & {
  batchId: string;
  userId: string;
  sessionId?: string;
  createdAt: Date;
};

// Evaluation precedence: not_found > disabled > override > rule_match > percentage_rollout > default
// metadata contains ruleId, percentage for debugging
export type EvaluationResult = {
  value: any;
  variant?: string;
  reason: EvaluationReason;
  metadata?: Record<string, any>;
};

export type BatchEvaluationResult = {
  flags: Record<string, EvaluationResult>;
  context: EvaluationContext;
  evaluatedAt: Date;
};

// Query types
export type FlagQuery = {
  key?: string;
  enabled?: boolean;
  type?: FlagType;
  organizationId?: string;
  limit?: number;
  offset?: number;
};

export type FlagWithRules = FeatureFlag & {
  rules: FlagRule[];
};

export type FlagWithOverrides = FeatureFlag & {
  overrides: FlagOverride[];
};

export type FlagWithStats = FeatureFlag & {
  evaluationCount: number;
  uniqueUsers: number;
  lastEvaluated?: Date;
};

// Configuration types
export type CacheConfig = {
  enabled: boolean;
  ttl: number; // Recommended: 60-300s for production
  maxSize?: number; // Prevent unbounded memory growth
};

export type AuditConfig = {
  enabled: boolean;
  retentionDays: number;
  includeContext?: boolean;
};

export type AnalyticsConfig = {
  trackUsage: boolean;
  trackPerformance: boolean;
  sampleRate?: number; // 0 < n ≤ 1; fraction to track
};
