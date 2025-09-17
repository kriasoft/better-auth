// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import { createMiddleware } from "better-call";
import type {} from "../augmentation"; // Import type augmentations (types-only)
import type { EvaluationContext } from "../schema";
import type { PluginContext } from "../types";
import type { EvaluationResult } from "./context";
import { buildEvaluationContext } from "./context";

/**
 * Enhances session with evaluated feature flags and helper methods.
 * @returns Middleware that adds featureFlags object to session
 * @see plugins/feature-flags/src/types.ts for flag interfaces
 */
export function createSessionEnhancementMiddleware(
  pluginContext: PluginContext,
) {
  return createMiddleware(async (ctx: any) => {
    const session = ctx.session || (await ctx.auth?.getSession?.());

    if (!session?.user) {
      return {}; // Skip enhancement for unauthenticated users
    }

    // Build context with user, device, location data for flag evaluation
    const evaluationContext = await buildEvaluationContext(
      ctx,
      session,
      pluginContext,
      pluginContext.config.contextCollection,
    );

    // Pre-evaluate all enabled flags for session caching
    const userFlags = await evaluateUserFlags(
      session.user.id,
      evaluationContext,
      pluginContext,
    );

    return {
      session: {
        ...session,
        featureFlags: {
          flags: userFlags,
          isEnabled: (key: string): boolean => {
            const flag = userFlags[key];
            return flag ? Boolean(flag.value) : false;
          },
          getValue: (key: string, defaultValue?: any): any => {
            const flag = userFlags[key];
            return flag ? flag.value : defaultValue;
          },
          getVariant: (key: string): string | undefined => {
            const flag = userFlags[key];
            return flag?.variant;
          },
          context: evaluationContext,
        },
      },
    };
  });
}

/**
 * Cached flag evaluation result for user session.
 */
interface UserFlagResult {
  /** The resolved flag value (boolean, string, number, object) */
  value: any;
  /** Variant name if using A/B testing or multivariate flags */
  variant?: string;
  /** Reason for this result: 'enabled', 'disabled', 'not_found', 'error' */
  reason: string;
}

/**
 * Evaluates all enabled flags for user with caching and analytics tracking.
 * @param userId - User ID for flag evaluation and tracking
 * @param context - Evaluation context with user/device/location data
 * @param pluginContext - Plugin configuration and storage
 * @returns Record of flag keys to evaluation results
 */
async function evaluateUserFlags(
  userId: string,
  context: EvaluationContext,
  pluginContext: PluginContext,
): Promise<Record<string, UserFlagResult>> {
  const { storage, config, cache } = pluginContext;

  // Check TTL cache with secure hash of user+context data
  const cacheKeyData = { userId, context, type: "user-flags" };
  if (config.caching.enabled && cache.has(cacheKeyData)) {
    const cached = cache.get(cacheKeyData);
    if (cached && cached.timestamp + config.caching.ttl * 1000 > Date.now()) {
      return cached.value;
    }
  }

  const flags: Record<string, UserFlagResult> = {};

  try {
    const organizationId = config.multiTenant.enabled
      ? context.organizationId
      : undefined;

    // Only fetch enabled flags to reduce evaluation overhead
    const allFlags = await storage.listFlags(organizationId, {
      filter: { enabled: true },
    });

    const { evaluateFlags } = await import("../evaluation");

    for (const flag of allFlags) {
      try {
        const result = await evaluateFlags(flag, context, pluginContext);

        flags[flag.key] = {
          value: result.value,
          variant: result.variant,
          reason: result.reason,
        };

        // Track evaluation for analytics and A/B test analysis
        if (config.analytics.trackUsage) {
          await storage
            .trackEvaluation({
              flagKey: flag.key,
              userId,
              context,
              timestamp: new Date(),
              value: result.value,
              variant: result.variant,
              reason: result.reason,
            })
            .catch((err) => {
              console.error(
                `[feature-flags] Failed to track evaluation: ${err.message}`,
              );
            });
        }
      } catch (error) {
        console.error(
          `[feature-flags] Error evaluating flag ${flag.key}:`,
          error,
        );
        // Fallback to default value on evaluation error
        flags[flag.key] = {
          value: flag.defaultValue,
          reason: "error",
        };
      }
    }

    // Cache results with TTL to reduce DB load on subsequent requests
    if (config.caching.enabled) {
      cache.set(cacheKeyData, {
        value: flags,
        timestamp: Date.now(),
        ttl: config.caching.ttl,
        reason: "cached",
      });
    }

    return flags;
  } catch (error) {
    console.error("[feature-flags] Error evaluating user flags:", error);
    return {};
  }
}

/**
 * Creates middleware for per-request flag evaluation (no caching).
 * Use for dynamic flags that change during request lifecycle.
 * @returns Middleware with evaluate, isEnabled, getVariant helpers
 * @see createSessionEnhancementMiddleware for cached session flags
 */
export function createRequestFlagsMiddleware(pluginContext: PluginContext) {
  return createMiddleware(async (ctx: any) => {
    const session = ctx.session || (await ctx.auth?.getSession?.());

    const evaluationContext = await buildEvaluationContext(
      ctx,
      session,
      pluginContext,
      pluginContext.config.contextCollection,
    );

    // Real-time flag evaluation helpers for dynamic flags
    const evaluate = async (
      key: string,
      defaultValue?: any,
    ): Promise<EvaluationResult> => {
      try {
        const organizationId = pluginContext.config.multiTenant.enabled
          ? evaluationContext.organizationId
          : undefined;
        const flag = await pluginContext.storage.getFlag(key, organizationId);

        if (!flag || !flag.enabled) {
          return {
            value: defaultValue,
            reason: flag ? "disabled" : "not_found",
          };
        }

        const { evaluateFlags } = await import("../evaluation");
        return await evaluateFlags(flag, evaluationContext, pluginContext);
      } catch (error) {
        console.error(`[feature-flags] Error evaluating flag ${key}:`, error);
        return {
          value: defaultValue,
          reason: "error",
        };
      }
    };

    const evaluateFlags = async (
      keys: string[],
    ): Promise<Record<string, EvaluationResult>> => {
      const results: Record<string, EvaluationResult> = {};

      // Parallel evaluation for better performance
      const evaluations = await Promise.all(
        keys.map(async (key) => {
          const result = await evaluate(key);
          return { key, result };
        }),
      );

      for (const { key, result } of evaluations) {
        results[key] = result;
      }

      return results;
    };

    const isEnabled = async (key: string): Promise<boolean> => {
      const result = await evaluate(key, false);
      return Boolean(result.value);
    };

    const getVariant = async (key: string): Promise<string | undefined> => {
      const result = await evaluate(key);
      return result.variant;
    };

    return {
      featureFlags: {
        evaluate,
        evaluateFlags,
        isEnabled,
        getVariant,
        context: evaluationContext,
      },
    };
  });
}
