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
 * @decision 0.01 tolerance handles IEEE 754 precision
 * @decision Empty variants allowed (feature without A/B test)
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

// Nested targeting conditions: NOT → ALL → ANY precedence; {} matches all
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

// Variant weight distribution
export const variantSchema = z.object({
  key: z.string(),
  value: z.any(),
  weight: z.number().min(0).max(100),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const featureFlagInputSchema = z.object({
  key: z.string().refine((val) => /^[a-z0-9-_]+$/i.test(val), {
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
        return Math.abs(totalWeight - 100) < 0.01;
      },
      { message: "Variant weights must sum to 100" },
    ),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const evaluationContextSchema = z.object({
  userId: z.string().optional(),
  email: z.string().optional(),
  role: z.string().optional(),
  organizationId: z.string().optional(),
  attributes: z.record(z.string(), z.any()).optional(),
});

// Common parameter schemas for API
export const selectSchema = z.union([
  z.enum(["value", "full"]),
  z
    .array(z.enum(["value", "variant", "reason", "metadata"]))
    .min(1)
    .max(4),
]);

export const environmentParamSchema = z
  .string()
  .min(1)
  .max(64)
  .refine((val) => /^[a-zA-Z0-9._-]+$/.test(val), {
    message:
      "Environment must contain only alphanumeric characters, dots, underscores, and hyphens",
  });

// Legacy schemas for backward compatibility (deprecated)
export const shapeModeSchema = z.enum(["value", "full"]);
export const fieldsSchema = z
  .array(z.enum(["value", "variant", "reason", "metadata"]))
  .min(1)
  .max(4);

export const flagOverrideInputSchema = z.object({
  flagId: z.string(),
  userId: z.string(),
  value: z.any(),
  enabled: z.boolean().default(true),
  variant: z.string().optional(),
  reason: z.string().optional(),
  expiresAt: z.date().optional(),
});

// Upsert schema with optional ID
export const flagOverrideUpsertSchema = flagOverrideInputSchema.extend({
  id: z.string().optional(),
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

// Event tracking schemas
export const flagEventInputSchema = z.object({
  flagKey: z.string().describe("The feature flag key that was used"),
  event: z.string().describe("The event name to track"),
  properties: z.union([z.number(), z.record(z.string(), z.any())]).optional(),
  timestamp: z.string().optional().describe("RFC3339 timestamp string"),
  sampleRate: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .describe("Client-side sampling rate (0-1). Server may clamp/override."),
});

export const flagEventBatchInputSchema = z.object({
  events: z
    .array(flagEventInputSchema)
    .min(1)
    .max(100)
    .describe("Array of events to track (max 100 per batch)"),
  sampleRate: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .describe(
      "Default sampling rate applied to entire batch if individual events don't specify sampleRate",
    ),
  idempotencyKey: z
    .string()
    .optional()
    .describe(
      "Optional idempotency key for preventing duplicate batch processing",
    ),
});
