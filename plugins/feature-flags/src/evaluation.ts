// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import type {
  EvaluationContext,
  EvaluationResult,
  FeatureFlag,
  FlagRule,
  RuleConditions,
} from "./schema";
import type { PluginContext } from "./types";
import { calculateRollout, evaluateCondition } from "./utils";

/**
 * Core flag evaluation engine with deterministic priority cascade.
 *
 * Order: Disabled → Overrides → Rules → Rollout → Default
 * Performance: Cheap checks first, DB cached, hash-based consistency
 *
 * @see src/storage/ for caching implementation
 */
export async function evaluateFlags(
  flag: FeatureFlag,
  context: EvaluationContext,
  pluginContext: PluginContext,
  debug = false,
  environment?: string,
): Promise<EvaluationResult> {
  const startTime = debug ? Date.now() : 0;
  const debugInfo = debug
    ? {
        evaluationPath: [] as string[],
        steps: [] as Array<{
          step: string;
          matched?: boolean;
          [key: string]: any;
        }>,
      }
    : null;

  // Fail-safe: disabled flags bypass all logic
  if (!flag.enabled) {
    if (debug) {
      debugInfo!.evaluationPath.push("disabled");
      debugInfo!.steps.push({ step: "disabled", flagEnabled: false });
    }
    return {
      value: flag.defaultValue,
      reason: "disabled",
      ...(debug && {
        metadata: {
          debug: {
            ...debugInfo,
            processingTime: Date.now() - startTime,
            flagId: flag.id,
            environment,
          },
        },
      }),
    };
  }

  // User-specific overrides (highest priority after disabled check)
  const override = await checkOverride(flag, context, pluginContext);
  if (override) {
    if (debug) {
      debugInfo!.evaluationPath.push("override");
      debugInfo!.steps.push({
        step: "override",
        matched: true,
        overrideId: override.metadata?.overrideId,
        userId: context.userId,
      });
      // Add debug metadata to existing override result
      return {
        ...override,
        metadata: {
          ...override.metadata,
          debug: {
            ...debugInfo,
            processingTime: Date.now() - startTime,
            flagId: flag.id,
            environment,
          },
        },
      };
    }
    return override;
  }

  // Rules evaluation (priority-ordered, 0 = highest)
  const ruleResult = await evaluateRules(flag, context, pluginContext);
  if (ruleResult) {
    if (debug) {
      debugInfo!.evaluationPath.push("rule");
      debugInfo!.steps.push({
        step: "rule",
        matched: true,
        ruleId: ruleResult.metadata?.ruleId,
      });
      return {
        ...ruleResult,
        metadata: {
          ...ruleResult.metadata,
          debug: {
            ...debugInfo,
            processingTime: Date.now() - startTime,
            flagId: flag.id,
            environment,
          },
        },
      };
    }
    return ruleResult;
  }

  if (debug) {
    debugInfo!.steps.push({ step: "rules", matched: false });
  }

  // Percentage rollout using consistent hashing
  const rolloutResult = checkRollout(flag, context);
  if (rolloutResult) {
    if (debug) {
      debugInfo!.evaluationPath.push("rollout");
      debugInfo!.steps.push({
        step: "rollout",
        matched: true,
        rolloutPercentage: flag.rolloutPercentage,
      });
      return {
        ...rolloutResult,
        metadata: {
          ...rolloutResult.metadata,
          debug: {
            ...debugInfo,
            processingTime: Date.now() - startTime,
            flagId: flag.id,
            environment,
          },
        },
      };
    }
    return rolloutResult;
  }

  if (debug) {
    debugInfo!.steps.push({ step: "rollout", matched: false });
  }

  // Fallback to configured default
  if (debug) {
    debugInfo!.evaluationPath.push("default");
    debugInfo!.steps.push({ step: "default", matched: true });
  }

  return {
    value: flag.defaultValue,
    reason: "default",
    ...(debug && {
      metadata: {
        debug: {
          ...debugInfo,
          processingTime: Date.now() - startTime,
          flagId: flag.id,
          environment,
        },
      },
    }),
  };
}

// Individual user overrides - admin-configured exceptions
async function checkOverride(
  flag: FeatureFlag,
  context: EvaluationContext,
  pluginContext: PluginContext,
): Promise<EvaluationResult | null> {
  const { storage } = pluginContext;

  try {
    // Anonymous users cannot have personal overrides
    if (!context.userId) return null;

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

// Rule-based targeting: segment users by attributes/behavior
async function evaluateRules(
  flag: FeatureFlag,
  context: EvaluationContext,
  pluginContext: PluginContext,
): Promise<EvaluationResult | null> {
  const { storage } = pluginContext;

  try {
    // Fetch rules pre-sorted by priority (0 = highest precedence)
    const rules = await storage.getRulesForFlag(flag.id);
    for (const rule of rules) {
      if (!rule.enabled) continue;

      const matches = evaluateRuleConditions(rule, context);
      if (matches) {
        // First matching rule wins (priority-based evaluation)
        const variant = selectVariant(rule, flag, context);

        return {
          value: rule.value !== undefined ? rule.value : flag.defaultValue,
          variant,
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

// Condition evaluation with boolean logic (all/any/not recursion)
function evaluateRuleConditions(
  rule: FlagRule,
  context: EvaluationContext,
): boolean {
  const { conditions } = rule;

  // No conditions = unconditional match (allows simple percentage rollouts)
  if (!conditions) {
    return true;
  }

  return evaluateConditionsRecursive(conditions, context);
}

// Recursive boolean evaluation supporting complex targeting logic
function evaluateConditionsRecursive(
  conditions: RuleConditions | any,
  context: EvaluationContext,
): boolean {
  // Legacy support: flat conditions array with single operator
  if (conditions.conditions && conditions.operator) {
    const results = conditions.conditions.map((condition: any) => {
      const attributeValue = getAttributeValue(context, condition.attribute);
      return evaluateCondition(
        attributeValue,
        condition.operator,
        condition.value,
      );
    });

    if (conditions.operator === "AND") {
      return results.every(Boolean);
    } else {
      // OR
      return results.some(Boolean);
    }
  }

  // Modern structure: nested all/any/not conditions
  let result = true; // Default passes (no constraints = universal match)

  // Process 'all' conditions (AND logic)
  if (conditions.all && conditions.all.length > 0) {
    const allResults = conditions.all.map((condition: any) => {
      const attributeValue = getAttributeValue(context, condition.attribute);
      return evaluateCondition(
        attributeValue,
        condition.operator,
        condition.value,
      );
    });
    result = result && allResults.every(Boolean);
  }

  // Process 'any' conditions (OR logic)
  if (conditions.any && conditions.any.length > 0) {
    const anyResults = conditions.any.map((condition: any) => {
      const attributeValue = getAttributeValue(context, condition.attribute);
      return evaluateCondition(
        attributeValue,
        condition.operator,
        condition.value,
      );
    });
    result = result && anyResults.some(Boolean);
  }

  // Process 'not' condition (negation)
  if (conditions.not) {
    const notResult = evaluateConditionsRecursive(conditions.not, context);
    result = result && !notResult;
  }

  return result;
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
 * Consistent percentage rollout with sticky user assignment.
 * Hash-based distribution ensures same user gets same result across sessions.
 * Format: userId:flagKey for per-flag independence
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

  // Deterministic inclusion via hash: same user + flag = same result
  const hashInput = `${context.userId}:${flag.key}`;
  const included = calculateRollout(hashInput, flag.rolloutPercentage);

  if (included) {
    // Select variant for included users
    const variant = selectVariantByWeight(flag, context);

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
  // If flag has variants, select based on user
  if (flag.variants && flag.variants.length > 0) {
    return selectVariantByWeight(flag, context);
  }

  return undefined;
}

/**
 * Deterministic variant selection with optional weighting.
 *
 * Consistency: Same user gets same variant across sessions
 * Hash suffix ":variant" ensures independence from rollout calculation
 * Supports both weighted and equal distribution strategies
 */
function selectVariantByWeight(
  flag: FeatureFlag,
  context: EvaluationContext,
): string | undefined {
  if (!flag.variants || flag.variants.length === 0) {
    return undefined;
  }

  const variants = flag.variants;
  if (variants.length === 0) return undefined;

  // Hash with :variant suffix to ensure independence from rollout
  const hashInput = `${context.userId}:${flag.key}:variant`;
  const hashValue = simpleHash(hashInput);

  // Detect weight configuration
  const hasWeights = variants.some((v) => typeof v.weight === "number");

  if (hasWeights) {
    // Weighted selection
    const totalWeight = variants.reduce((sum, v) => sum + (v.weight || 0), 0);
    if (totalWeight <= 0) {
      // Fallback to equal distribution if invalid weights
      const variantIndex = hashValue % variants.length;
      return variants[variantIndex]!.key;
    }

    // Map hash to weighted selection
    const targetWeight = hashValue % totalWeight;
    let cumulativeWeight = 0;

    for (const variant of variants) {
      cumulativeWeight += variant.weight || 0;
      if (targetWeight < cumulativeWeight) {
        return variant.key;
      }
    }

    // Fallback to last variant
    return variants[variants.length - 1]!.key;
  } else {
    // Equal distribution
    const variantIndex = hashValue % variants.length;
    return variants[variantIndex]!.key;
  }
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
 * Batch flag evaluation with parallel fetching and error isolation.
 * Individual flag failures don't affect other evaluations.
 */
export async function evaluateFlagsBatch(
  keys: string[],
  context: EvaluationContext,
  pluginContext: PluginContext,
  debug = false,
  environment?: string,
): Promise<Record<string, EvaluationResult>> {
  const { storage, config } = pluginContext;
  const results: Record<string, EvaluationResult> = {};

  // Multi-tenant org scoping when enabled
  const organizationId = config.multiTenant.enabled
    ? context.organizationId
    : undefined;

  // Parallel flag fetching for performance
  const flagPromises = keys.map((key) => storage.getFlag(key, organizationId));
  const flags = await Promise.all(flagPromises);

  // Evaluate each flag
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]!;
    const flag = flags[i];

    if (!flag) {
      results[key] = {
        value: undefined,
        reason: "not_found",
      };
      continue;
    }

    try {
      results[key] = await evaluateFlags(
        flag,
        context,
        pluginContext,
        debug,
        environment,
      );
    } catch (error) {
      console.error(`[feature-flags] Error evaluating flag ${key}:`, error);
      results[key] = {
        value: flag.defaultValue,
        reason: "default",
        metadata: { error: true },
      };
    }
  }

  return results;
}
