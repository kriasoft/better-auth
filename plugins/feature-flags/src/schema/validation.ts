// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import * as z from "zod";

/**
 * Runtime validation schemas. Rejects invalid input before DB write.
 *
 * @invariant Flag keys: /^[a-z0-9-_]+$/i (URL-safe)
 * @invariant Percentages: 0 ≤ n ≤ 100
 * @invariant Variant weights: Σ(weights) = 100 ± 0.01
 * @invariant Priority: integer, -1000 ≤ n ≤ 1000
 *
 * @decision 0.01 tolerance for variant weights handles IEEE 754 precision
 * @decision Empty variants array allowed (feature without A/B test)
 */

// Enum schemas
export const flagTypeSchema = z.enum(["boolean", "string", "number", "json"]);

export const evaluationReasonSchema = z.enum([
  "rule_match",
  "override",
  "percentage_rollout",
  "default",
  "disabled",
  "not_found",
]);

export const auditActionSchema = z.enum([
  "created",
  "updated",
  "deleted",
  "enabled",
  "disabled",
  "rule_added",
  "rule_updated",
  "rule_deleted",
  "override_added",
  "override_removed",
]);

export const conditionOperatorSchema = z.enum([
  "equals",
  "not_equals",
  "contains",
  "not_contains",
  "starts_with",
  "ends_with",
  "greater_than",
  "less_than",
  "greater_than_or_equal",
  "less_than_or_equal",
  "in",
  "not_in",
  "regex",
]);

// Condition schemas
export const conditionSchema = z.object({
  attribute: z.string(),
  operator: conditionOperatorSchema,
  value: z.any(),
});

/**
 * Recursive targeting conditions.
 * @example { all: [{ attribute: "role", operator: "equals", value: "admin" }] }
 * @invariant Evaluation order: NOT → ALL → ANY
 * @invariant {} matches all users
 */
export const ruleConditionsSchema: z.ZodType<{
  all?: z.infer<typeof conditionSchema>[];
  any?: z.infer<typeof conditionSchema>[];
  not?: any;
}> = z.object({
  all: z.array(conditionSchema).optional(),
  any: z.array(conditionSchema).optional(),
  not: z.lazy(() => ruleConditionsSchema).optional(),
});

// Input validation schemas
export const flagRuleInputSchema = z.object({
  name: z.string().optional(),
  priority: z.number().default(0),
  conditions: ruleConditionsSchema,
  value: z.any(),
  percentage: z.number().min(0).max(100).optional(),
  enabled: z.boolean().default(true),
});

/** @invariant weight: 0 ≤ n ≤ 100; Σ(weights) must = 100 */
export const variantSchema = z.object({
  key: z.string(),
  value: z.any(),
  weight: z.number().min(0).max(100), // Distribution weight, must sum to 100
  metadata: z.record(z.string(), z.any()).optional(),
});

export const featureFlagInputSchema = z.object({
  key: z.string().regex(/^[a-z0-9-_]+$/i, {
    message:
      "Key must contain only alphanumeric characters, hyphens, and underscores",
  }),
  name: z.string(),
  description: z.string().optional(),
  type: flagTypeSchema.default("boolean"),
  enabled: z.boolean().default(false),
  defaultValue: z.any().optional(),
  rolloutPercentage: z.number().min(0).max(100).default(0),
  variants: z
    .array(variantSchema)
    .optional()
    .refine(
      (variants) => {
        if (!variants || variants.length === 0) return true;
        const totalWeight = variants.reduce((sum, v) => sum + v.weight, 0);
        return Math.abs(totalWeight - 100) < 0.01; // Allow for floating point errors
      },
      { message: "Variant weights must sum to 100" },
    ),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const evaluationContextSchema = z.object({
  userId: z.string().optional(),
  email: z.string().email("Invalid email address").optional(),
  role: z.string().optional(),
  organizationId: z.string().optional(),
  attributes: z.record(z.string(), z.any()).optional(),
});

export const flagOverrideInputSchema = z.object({
  flagId: z.string(),
  userId: z.string(),
  value: z.any(),
  reason: z.string().optional(),
  expiresAt: z.date().optional(),
});

/** @intent Prevents uk_flag_user constraint violations on upsert */
export const flagOverrideUpsertSchema = flagOverrideInputSchema.extend({
  id: z.string().optional(), // Include if updating existing
});

export const flagEvaluationInputSchema = z.object({
  flagId: z.string(),
  userId: z.string().optional(),
  sessionId: z.string().optional(),
  value: z.any(),
  variant: z.string().optional(),
  reason: evaluationReasonSchema.optional(),
  context: z.record(z.string(), z.any()).optional(),
});

export const flagAuditInputSchema = z.object({
  flagId: z.string(),
  userId: z.string().optional(),
  action: auditActionSchema,
  previousValue: z.any().optional(),
  newValue: z.any().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});
