// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import { createMiddleware } from "better-call";
import type { PluginContext } from "../types";
import type { EvaluationContext } from "../schema";

/**
 * Middleware mode configuration
 */
export type MiddlewareMode = "minimal" | "session" | "full";

/**
 * Options for the unified middleware
 */
export interface UnifiedMiddlewareOptions {
  mode?: MiddlewareMode;
  collectContext?: boolean;
}

/**
 * Feature flags context that will be added to the request
 */
export interface FeatureFlagsContext {
  featureFlags: {
    evaluate: (key: string, defaultValue?: any) => Promise<EvaluationResult>;
    evaluateBatch: (
      keys: string[],
    ) => Promise<Record<string, EvaluationResult>>;
    isEnabled: (key: string) => Promise<boolean>;
    getVariant: (key: string) => Promise<string | undefined>;
    context?: EvaluationContext;
  };
}

/**
 * Evaluation result
 */
export interface EvaluationResult {
  value: any;
  variant?: string;
  reason: string;
}

/**
 * Create unified feature flags middleware with configurable modes
 */
export function createUnifiedMiddleware(
  pluginContext: PluginContext,
  options: UnifiedMiddlewareOptions = {},
) {
  return createMiddleware(async (ctx: any) => {
    const mode = options.mode || "minimal";

    // Build evaluation context based on mode
    const evaluationContext = await buildContextForMode(
      ctx,
      pluginContext,
      mode,
    );

    // Create evaluation functions
    const evaluate = createEvaluator(pluginContext, evaluationContext);
    const evaluateBatch = createBatchEvaluator(
      pluginContext,
      evaluationContext,
    );

    // Helper functions
    const isEnabled = async (key: string): Promise<boolean> => {
      const result = await evaluate(key, false);
      return Boolean(result.value);
    };

    const getVariant = async (key: string): Promise<string | undefined> => {
      const result = await evaluate(key);
      return result.variant;
    };

    // Return context extensions
    const context: FeatureFlagsContext = {
      featureFlags: {
        evaluate,
        evaluateBatch,
        isEnabled,
        getVariant,
      },
    };

    // Add context for non-minimal modes
    if (mode !== "minimal" || options.collectContext) {
      context.featureFlags.context = evaluationContext;
    }

    return context;
  });
}

/**
 * Build evaluation context based on mode
 */
async function buildContextForMode(
  ctx: any,
  pluginContext: PluginContext,
  mode: MiddlewareMode,
): Promise<EvaluationContext> {
  const context: EvaluationContext = {
    userId: "anonymous",
    attributes: {},
  };

  // Get session if available (type-safe access)
  const getSession = ctx.getSession || ctx.auth?.getSession;
  const session = ctx.session || (getSession ? await getSession() : null);

  // Add user ID if session exists
  if (session?.user?.id) {
    context.userId = session.user.id;
  }

  // Add basic attributes based on mode
  switch (mode) {
    case "minimal":
      // Only essential context
      if (ctx.path && context.attributes) {
        context.attributes.requestPath = ctx.path;
      }
      if (ctx.method && context.attributes) {
        context.attributes.requestMethod = ctx.method;
      }
      break;

    case "session":
      // Session data + basic request info
      if (session?.user && context.attributes) {
        if (session.user.email) context.attributes.email = session.user.email;
        if (session.user.name) context.attributes.name = session.user.name;
        if (session.user.roles) context.attributes.roles = session.user.roles;
      }
      if (ctx.path && context.attributes) {
        context.attributes.requestPath = ctx.path;
      }
      if (ctx.method && context.attributes) {
        context.attributes.requestMethod = ctx.method;
      }
      break;

    case "full":
      // Full context collection based on config
      const { buildEvaluationContext } = await import("./context");
      return await buildEvaluationContext(
        ctx,
        session,
        pluginContext,
        pluginContext.config.contextCollection,
      );
  }

  // Add organization context if multi-tenant
  if (pluginContext.config.multiTenant.enabled) {
    const organizationId = getOrganizationId(session, pluginContext);
    if (organizationId) {
      context.organizationId = organizationId;
      if (context.attributes) {
        context.attributes.organizationId = organizationId;
      }
    }
  }

  // Add timestamp
  if (context.attributes) {
    context.attributes.timestamp = new Date().toISOString();
  }

  return context;
}

/**
 * Extract organization ID from session
 */
function getOrganizationId(
  session: any,
  pluginContext: PluginContext,
): string | undefined {
  if (!pluginContext.config.multiTenant.enabled) {
    return undefined;
  }

  if (pluginContext.config.multiTenant.useOrganizations) {
    return session?.organization?.id || session?.user?.organizationId;
  }

  return session?.user?.organizationId || session?.organizationId;
}

/**
 * Create single flag evaluator
 */
function createEvaluator(
  pluginContext: PluginContext,
  evaluationContext: EvaluationContext,
) {
  return async (key: string, defaultValue?: any): Promise<EvaluationResult> => {
    try {
      const { storage, config } = pluginContext;
      const organizationId = config.multiTenant.enabled
        ? evaluationContext.organizationId
        : undefined;

      // Check cache first
      const cacheKey = `flag:${key}:${JSON.stringify(evaluationContext)}`;
      if (config.caching.enabled && pluginContext.cache.has(cacheKey)) {
        const cached = pluginContext.cache.get(cacheKey);
        if (
          cached &&
          cached.timestamp + config.caching.ttl * 1000 > Date.now()
        ) {
          return cached.value;
        }
      }

      // Get flag from storage
      const flag = await storage.getFlag(key, organizationId);

      if (!flag || !flag.enabled) {
        return {
          value: defaultValue,
          reason: flag ? "disabled" : "not_found",
        };
      }

      // Evaluate flag
      const { evaluateFlags } = await import("../evaluation");
      const result = await evaluateFlags(
        flag,
        evaluationContext,
        pluginContext,
      );

      // Cache result
      if (config.caching.enabled) {
        pluginContext.cache.set(cacheKey, {
          value: result,
          timestamp: Date.now(),
          ttl: config.caching.ttl,
          reason: result.reason,
        });
      }

      // Track evaluation if analytics enabled
      if (config.analytics.trackUsage) {
        storage
          .trackEvaluation({
            flagKey: key,
            userId: evaluationContext.userId || "anonymous",
            context: evaluationContext,
            timestamp: new Date(),
            value: result.value,
            variant: result.variant,
            reason: result.reason,
          })
          .catch((err: any) => {
            console.error(
              `[feature-flags] Failed to track evaluation: ${err.message}`,
            );
          });
      }

      return result;
    } catch (error) {
      console.error(`[feature-flags] Error evaluating flag ${key}:`, error);
      return {
        value: defaultValue,
        reason: "error",
      };
    }
  };
}

/**
 * Create batch flag evaluator
 */
function createBatchEvaluator(
  pluginContext: PluginContext,
  evaluationContext: EvaluationContext,
) {
  return async (keys: string[]): Promise<Record<string, EvaluationResult>> => {
    const evaluate = createEvaluator(pluginContext, evaluationContext);
    const results: Record<string, EvaluationResult> = {};

    // Evaluate in parallel for performance
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
}
