// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import "../augmentation"; // Import type augmentations
import { createMiddleware } from "better-call";
import type { PluginContext } from "../types";
import type { EvaluationContext } from "../schema";
import { buildEvaluationContext } from "./context";
import type { EvaluationResult } from "./context";

/**
 * Session enhancement middleware that adds feature flags to session
 */
export function createSessionEnhancementMiddleware(
  pluginContext: PluginContext,
) {
  return createMiddleware(async (ctx: any) => {
    // Get session from context if available
    const session = ctx.session || (await ctx.auth?.getSession?.());

    if (!session?.user) {
      return {}; // No session to enhance
    }

    // Build evaluation context for this session
    const evaluationContext = await buildEvaluationContext(
      ctx,
      session,
      pluginContext,
      pluginContext.config.contextCollection,
    );

    // Evaluate all enabled flags for this user
    const userFlags = await evaluateUserFlags(
      session.user.id,
      evaluationContext,
      pluginContext,
    );

    // Return enhanced session
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
 * User flag evaluation result
 */
interface UserFlagResult {
  value: any;
  variant?: string;
  reason: string;
}

/**
 * Evaluate all flags for a specific user
 */
async function evaluateUserFlags(
  userId: string,
  context: EvaluationContext,
  pluginContext: PluginContext,
): Promise<Record<string, UserFlagResult>> {
  const { storage, config, cache } = pluginContext;

  // Check cache first
  const cacheKey = `user-flags:${userId}:${JSON.stringify(context)}`;
  if (config.caching.enabled && cache.has(cacheKey)) {
    const cached = cache.get(cacheKey);
    if (cached && cached.timestamp + config.caching.ttl * 1000 > Date.now()) {
      return cached.value;
    }
  }

  const flags: Record<string, UserFlagResult> = {};

  try {
    // Get organization ID if multi-tenant
    const organizationId = config.multiTenant.enabled
      ? context.organizationId
      : undefined;

    // Fetch all enabled flags
    const allFlags = await storage.listFlags(organizationId, {
      filter: { enabled: true },
    });

    // Evaluate each flag
    const { evaluateFlags } = await import("../evaluation");

    for (const flag of allFlags) {
      try {
        const result = await evaluateFlags(flag, context, pluginContext);

        flags[flag.key] = {
          value: result.value,
          variant: result.variant,
          reason: result.reason,
        };

        // Track evaluation if analytics enabled
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
        // Use default value on error
        flags[flag.key] = {
          value: flag.defaultValue,
          reason: "error",
        };
      }
    }

    // Cache the results
    if (config.caching.enabled) {
      cache.set(cacheKey, {
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
 * Create request-level feature flags middleware
 */
export function createRequestFlagsMiddleware(pluginContext: PluginContext) {
  return createMiddleware(async (ctx: any) => {
    const session = ctx.session || (await ctx.auth?.getSession?.());

    // Build evaluation context
    const evaluationContext = await buildEvaluationContext(
      ctx,
      session,
      pluginContext,
      pluginContext.config.contextCollection,
    );

    // Create flag evaluation helpers
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

    const evaluateBatch = async (
      keys: string[],
    ): Promise<Record<string, EvaluationResult>> => {
      const results: Record<string, EvaluationResult> = {};

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

    // Return context extensions
    return {
      featureFlags: {
        evaluate,
        evaluateBatch,
        isEnabled,
        getVariant,
        context: evaluationContext,
      },
    };
  });
}
