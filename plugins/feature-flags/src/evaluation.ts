// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import type {
  FeatureFlag,
  FlagRule,
  EvaluationContext,
  EvaluationResult,
} from "./schema";
import type { PluginContext } from "./types";
import { calculateRollout, evaluateCondition } from "./utils";

/**
 * Core flag evaluation engine
 *
 * @important Evaluation order matters for predictable behavior:
 * 1. Disabled flags return immediately (fail-safe)
 * 2. User overrides have highest priority (explicit control)
 * 3. Rules evaluated by priority field (0 = highest)
 * 4. Percentage rollout (gradual release)
 * 5. Default value (fallback)
 *
 * @performance Checks are ordered by likelihood and cost:
 * - Cheap checks (enabled, default) come first
 * - Database lookups (overrides, rules) are cached
 * - Hash calculations (rollout) only when needed
 */
export async function evaluateFlags(
  flag: FeatureFlag,
  context: EvaluationContext,
  pluginContext: PluginContext,
): Promise<EvaluationResult> {
  // Check if flag is disabled
  if (!flag.enabled) {
    return {
      value: flag.defaultValue,
      reason: "disabled",
    };
  }

  // Check for user overrides first (highest priority)
  const override = await checkOverride(flag, context, pluginContext);
  if (override) {
    return override;
  }

  // Evaluate rules in priority order
  const ruleResult = await evaluateRules(flag, context, pluginContext);
  if (ruleResult) {
    return ruleResult;
  }

  // Check percentage rollout
  const rolloutResult = checkRollout(flag, context);
  if (rolloutResult) {
    return rolloutResult;
  }

  // Return default value
  return {
    value: flag.defaultValue,
    variant: flag.defaultVariant,
    reason: "default",
  };
}

/**
 * Check for user-specific overrides
 */
async function checkOverride(
  flag: FeatureFlag,
  context: EvaluationContext,
  pluginContext: PluginContext,
): Promise<EvaluationResult | null> {
  const { storage } = pluginContext;

  try {
    const override = await storage.getOverride(flag.id, context.userId);
    if (override && override.enabled) {
      return {
        value: override.value,
        variant: override.variant,
        reason: "override",
        metadata: {
          overrideId: override.id,
        },
      };
    }
  } catch (error) {
    console.error(`[feature-flags] Error checking override: ${error}`);
  }

  return null;
}

/**
 * Evaluate flag rules
 */
async function evaluateRules(
  flag: FeatureFlag,
  context: EvaluationContext,
  pluginContext: PluginContext,
): Promise<EvaluationResult | null> {
  const { storage } = pluginContext;

  try {
    // Get all rules for this flag
    const rules = await storage.getRulesForFlag(flag.id);

    // Rules are already sorted by priority
    for (const rule of rules) {
      if (!rule.enabled) continue;

      const matches = evaluateRuleConditions(rule, context);
      if (matches) {
        // Select variant if specified
        const variant = selectVariant(rule, flag, context);

        return {
          value: rule.value !== undefined ? rule.value : flag.defaultValue,
          variant: variant || rule.variant,
          reason: "rule_match",
          metadata: {
            ruleId: rule.id,
            ruleName: rule.name,
            priority: rule.priority,
          },
        };
      }
    }
  } catch (error) {
    console.error(`[feature-flags] Error evaluating rules: ${error}`);
  }

  return null;
}

/**
 * Evaluate rule conditions
 */
function evaluateRuleConditions(
  rule: FlagRule,
  context: EvaluationContext,
): boolean {
  const { conditions } = rule;

  if (!conditions || conditions.conditions.length === 0) {
    // No conditions means rule always matches
    return true;
  }

  const results = conditions.conditions.map((condition) => {
    const attributeValue = getAttributeValue(context, condition.attribute);
    return evaluateCondition(
      attributeValue,
      condition.operator,
      condition.value,
    );
  });

  // Apply logical operator
  if (conditions.operator === "AND") {
    return results.every((r) => r === true);
  } else {
    // OR
    return results.some((r) => r === true);
  }
}

/**
 * Get attribute value from context
 */
function getAttributeValue(context: EvaluationContext, attribute: string): any {
  // Handle nested attributes with dot notation
  const parts = attribute.split(".");
  let value: any = context;

  for (const part of parts) {
    if (value && typeof value === "object") {
      value = value[part];
    } else {
      return undefined;
    }
  }

  return value;
}

/**
 * Check percentage rollout
 *
 * @important Uses consistent hashing to ensure:
 * - Same user always gets same result (sticky sessions)
 * - Even distribution across user population
 * - Deterministic without external state
 *
 * @note Hash input combines userId:flagKey to ensure different
 * flags can have independent rollout percentages for same user
 */
function checkRollout(
  flag: FeatureFlag,
  context: EvaluationContext,
): EvaluationResult | null {
  if (flag.rolloutPercentage === undefined || flag.rolloutPercentage === 100) {
    return null;
  }

  if (flag.rolloutPercentage === 0) {
    return {
      value: flag.defaultValue,
      reason: "percentage_rollout",
      metadata: {
        percentage: 0,
        included: false,
      },
    };
  }

  // Use consistent hashing based on user ID and flag key
  const hashInput = `${context.userId}:${flag.key}`;
  const included = calculateRollout(hashInput, flag.rolloutPercentage);

  if (included) {
    // Select variant for included users
    const variant = selectVariantByPercentage(flag, context);

    return {
      value: flag.defaultValue !== false ? flag.defaultValue : true,
      variant,
      reason: "percentage_rollout",
      metadata: {
        percentage: flag.rolloutPercentage,
        included: true,
      },
    };
  }

  return {
    value: flag.type === "boolean" ? false : flag.defaultValue,
    reason: "percentage_rollout",
    metadata: {
      percentage: flag.rolloutPercentage,
      included: false,
    },
  };
}

/**
 * Select variant based on rule configuration
 */
function selectVariant(
  rule: FlagRule,
  flag: FeatureFlag,
  context: EvaluationContext,
): string | undefined {
  // If rule specifies a variant, use it
  if (rule.variant) {
    return rule.variant;
  }

  // If flag has variants, select based on user
  if (flag.variants && Object.keys(flag.variants).length > 0) {
    return selectVariantByPercentage(flag, context);
  }

  return undefined;
}

/**
 * Select variant based on percentage distribution
 *
 * @important Variant assignment is deterministic:
 * - Same user always gets same variant (consistency)
 * - Uses separate hash seed (:variant suffix) from rollout
 * - Distribution is uniform across variants
 *
 * @note This is NOT weighted distribution - all variants
 * have equal probability. For weighted variants, use rules.
 */
function selectVariantByPercentage(
  flag: FeatureFlag,
  context: EvaluationContext,
): string | undefined {
  if (!flag.variants || Object.keys(flag.variants).length === 0) {
    return undefined;
  }

  const variants = Object.keys(flag.variants);
  if (variants.length === 0) return undefined;

  // Use consistent hashing to assign variant
  const hashInput = `${context.userId}:${flag.key}:variant`;
  const hashValue = simpleHash(hashInput);
  const variantIndex = hashValue % variants.length;

  return variants[variantIndex];
}

/**
 * Simple hash function for consistent variant assignment
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Batch evaluate multiple flags
 */
export async function evaluateFlagsBatch(
  keys: string[],
  context: EvaluationContext,
  pluginContext: PluginContext,
): Promise<Record<string, EvaluationResult>> {
  const { storage, config } = pluginContext;
  const results: Record<string, EvaluationResult> = {};

  // Get organization ID if multi-tenant
  const organizationId = config.multiTenant.enabled
    ? context.organizationId
    : undefined;

  // Fetch all flags in parallel
  const flagPromises = keys.map((key) => storage.getFlag(key, organizationId));
  const flags = await Promise.all(flagPromises);

  // Evaluate each flag
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const flag = flags[i];

    if (!flag) {
      results[key] = {
        value: undefined,
        reason: "not_found",
      };
      continue;
    }

    try {
      results[key] = await evaluateFlags(flag, context, pluginContext);
    } catch (error) {
      console.error(`[feature-flags] Error evaluating flag ${key}:`, error);
      results[key] = {
        value: flag.defaultValue,
        reason: "error",
      };
    }
  }

  return results;
}
