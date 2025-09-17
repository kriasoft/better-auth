// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import { createMiddleware } from "better-call";
import type { EvaluationContext } from "../schema";
import type { PluginContext } from "../types";

/**
 * Context collection modes with increasing data availability vs performance trade-offs.
 *
 * @security Choose the minimal mode that satisfies your flag evaluation rules.
 *
 * **`minimal`**: Basic request metadata only
 * - Available: `requestPath`, `requestMethod`, `userId`, `organizationId`, `timestamp`
 * - Use for: Simple boolean flags, percentage rollouts, user-based targeting
 * - Rules that work: userId equality, organization scoping, basic conditions
 * - Rules that fail: Email-based rules, role-based rules, device/geo targeting
 *
 * **`session`**: User session attributes + request context
 * - Available: All minimal + `email`, `name`, `roles` (from session)
 * - Use for: Role-based access, email domain rules, user attribute targeting
 * - Rules that work: All minimal + role checks, email patterns, user metadata
 * - Rules that fail: Device detection, IP geolocation, custom headers
 *
 * **`full`**: Comprehensive context via buildEvaluationContext()
 * - Available: All session + device info, geo data, custom headers, client metadata
 * - Use for: Advanced targeting, A/B testing, personalization, compliance rules
 * - Rules that work: All rules supported, full context collection
 * - Performance: Slower due to UA parsing, header processing, additional lookups
 */
export type MiddlewareMode = "minimal" | "session" | "full";

export interface UnifiedMiddlewareOptions {
  /** Context collection mode: 'minimal', 'session', or 'full' */
  mode?: MiddlewareMode;
  /** Whether to expose evaluation context for debugging/analytics */
  collectContext?: boolean;
}

/** Context injected into request for feature flag evaluation. */
export interface FeatureFlagsContext {
  featureFlags: {
    evaluate: (key: string, defaultValue?: any) => Promise<EvaluationResult>;
    evaluateFlags: (
      keys: string[],
    ) => Promise<Record<string, EvaluationResult>>;
    isEnabled: (key: string) => Promise<boolean>;
    getVariant: (key: string) => Promise<string | undefined>;
    context?: EvaluationContext;
  };
}

export interface EvaluationResult {
  value: any;
  variant?: string;
  reason: string;
}

/**
 * Creates middleware that injects feature flag evaluation into request context.
 *
 * @param pluginContext - Plugin context with storage, config, and cache
 * @param options - Middleware configuration including context collection mode
 * @returns Middleware function that adds featureFlags to request context
 *
 * @example
 * ```typescript
 * // Minimal mode for basic flags
 * app.use(createUnifiedMiddleware(pluginContext, { mode: "minimal" }));
 *
 * // Session mode for role-based rules
 * app.use(createUnifiedMiddleware(pluginContext, { mode: "session" }));
 *
 * // Full mode for advanced targeting
 * app.use(createUnifiedMiddleware(pluginContext, { mode: "full" }));
 * ```
 *
 * @warning If your flag rules require attributes not available in the selected mode,
 * evaluation may fail silently or return default values. Review the MiddlewareMode
 * documentation to ensure your mode provides sufficient context.
 *
 * @see MiddlewareMode for detailed context availability by mode
 * @see ../types.ts for PluginContext structure
 */
export function createUnifiedMiddleware(
  pluginContext: PluginContext,
  options: UnifiedMiddlewareOptions = {},
) {
  return createMiddleware(async (ctx: any) => {
    const mode = options.mode || "minimal";

    const evaluationContext = await buildContextForMode(
      ctx,
      pluginContext,
      mode,
    );

    const evaluate = createEvaluator(pluginContext, evaluationContext);
    const evaluateFlags = createBatchEvaluator(
      pluginContext,
      evaluationContext,
    );

    const isEnabled = async (key: string): Promise<boolean> => {
      const result = await evaluate(key, false);
      return Boolean(result.value);
    };

    const getVariant = async (key: string): Promise<string | undefined> => {
      const result = await evaluate(key);
      return result.variant;
    };

    const context: FeatureFlagsContext = {
      featureFlags: {
        evaluate,
        evaluateFlags,
        isEnabled,
        getVariant,
      },
    };

    // Expose evaluation context for debugging/analytics
    if (mode !== "minimal" || options.collectContext) {
      context.featureFlags.context = evaluationContext;
    }

    return context;
  });
}

// Builds evaluation context with performance-optimized data collection per mode
async function buildContextForMode(
  ctx: any,
  pluginContext: PluginContext,
  mode: MiddlewareMode,
): Promise<EvaluationContext> {
  const context: EvaluationContext = {
    userId: "anonymous",
    attributes: {},
  };

  // Handle multiple session access patterns across frameworks
  const getSession = ctx.getSession || ctx.auth?.getSession;
  const session = ctx.session || (getSession ? await getSession() : null);

  if (session?.user?.id) {
    context.userId = session.user.id;
  }

  switch (mode) {
    case "minimal":
      // Basic request context only
      if (ctx.path && context.attributes) {
        context.attributes.requestPath = ctx.path;
      }
      if (ctx.method && context.attributes) {
        context.attributes.requestMethod = ctx.method;
      }
      break;

    case "session":
      // User attributes + request context
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
      // Full context via dedicated builder. See: ./context.ts
      const { buildEvaluationContext } = await import("./context");
      return await buildEvaluationContext(
        ctx,
        session,
        pluginContext,
        pluginContext.config.contextCollection,
      );
  }

  // Multi-tenant organization context
  if (pluginContext.config.multiTenant.enabled) {
    const organizationId = getOrganizationId(session, pluginContext);
    if (organizationId) {
      context.organizationId = organizationId;
      if (context.attributes) {
        context.attributes.organizationId = organizationId;
      }
    }
  }

  if (context.attributes) {
    context.attributes.timestamp = new Date().toISOString();
  }

  return context;
}

/**
 * Validates if the current context mode provides sufficient data for flag rules.
 *
 * @param mode - Current middleware mode
 * @param requiredAttributes - Attributes needed for flag evaluation
 * @returns Validation result with missing attributes and recommendations
 *
 * @example
 * ```typescript
 * const validation = validateContextMode("minimal", ["email", "roles"]);
 * if (!validation.sufficient) {
 *   console.warn(`Context mode insufficient: ${validation.message}`);
 * }
 * ```
 */
export function validateContextMode(
  mode: MiddlewareMode,
  requiredAttributes: string[] = [],
): {
  sufficient: boolean;
  missing: string[];
  message: string;
  recommendedMode?: MiddlewareMode;
} {
  const modeCapabilities = {
    minimal: [
      "userId",
      "organizationId",
      "requestPath",
      "requestMethod",
      "timestamp",
    ],
    session: [
      "userId",
      "organizationId",
      "requestPath",
      "requestMethod",
      "timestamp",
      "email",
      "name",
      "roles",
    ],
    full: ["*"], // All attributes supported
  };

  if (mode === "full") {
    return {
      sufficient: true,
      missing: [],
      message: "Full context provides all attributes",
    };
  }

  const available = modeCapabilities[mode];
  const missing = requiredAttributes.filter(
    (attr) => !available.includes(attr),
  );

  if (missing.length === 0) {
    return {
      sufficient: true,
      missing: [],
      message: `Mode '${mode}' provides sufficient context`,
    };
  }

  const recommendedMode = missing.some(
    (attr) => !modeCapabilities.session.includes(attr),
  )
    ? "full"
    : "session";

  return {
    sufficient: false,
    missing,
    message: `Mode '${mode}' missing required attributes: ${missing.join(", ")}. Consider using '${recommendedMode}' mode.`,
    recommendedMode,
  };
}

// Extracts org ID from session based on multi-tenant config
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

// Creates cached flag evaluator with analytics tracking
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

      // LRU cache lookup with hashed key
      const cacheKeyData = {
        flag: key,
        context: evaluationContext,
        organizationId,
      };

      if (config.caching.enabled) {
        const cached = pluginContext.cache.get(cacheKeyData);
        if (cached) {
          return cached.value;
        }
      }

      const flag = await storage.getFlag(key, organizationId);

      if (!flag || !flag.enabled) {
        return {
          value: defaultValue,
          reason: flag ? "disabled" : "not_found",
        };
      }

      // Rule-based evaluation. See: ../evaluation.ts
      const { evaluateFlags } = await import("../evaluation");
      const result = await evaluateFlags(
        flag,
        evaluationContext,
        pluginContext,
      );

      if (config.caching.enabled) {
        pluginContext.cache.set(cacheKeyData, {
          value: result,
          timestamp: Date.now(),
          ttl: config.caching.ttl,
          reason: result.reason,
        });
      }

      // Fire-and-forget analytics tracking
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

// Batch evaluator with parallel processing for performance
function createBatchEvaluator(
  pluginContext: PluginContext,
  evaluationContext: EvaluationContext,
) {
  return async (keys: string[]): Promise<Record<string, EvaluationResult>> => {
    const evaluate = createEvaluator(pluginContext, evaluationContext);
    const results: Record<string, EvaluationResult> = {};

    // Parallel evaluation to avoid sequential DB calls
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
