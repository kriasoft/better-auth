// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import type { BetterAuthPlugin } from "better-auth";
import type { PluginContext } from "../types";
import { evaluateFlags, evaluateFlagsBatch } from "../evaluation";
import { buildEvaluationContext } from "../middleware/context";

/**
 * Endpoint handlers type
 */
export type FlagEndpoints = NonNullable<BetterAuthPlugin["endpoints"]>;

/**
 * Create API endpoints for the feature flags plugin
 */
export function createFlagEndpoints(
  pluginContext: PluginContext,
): FlagEndpoints {
  return {
    // User-facing endpoints for flag evaluation
    "/api/flags/evaluate/:key": {
      GET: async (ctx: any) => {
        const { key } = ctx.params;
        const session = await ctx.getSession();

        // Build evaluation context from session
        const baseContext =
          ctx.featureFlags?.context ||
          (await buildEvaluationContext(ctx, session, pluginContext));

        // Merge additional context from query params if provided
        const additionalContext = ctx.query.context
          ? JSON.parse(ctx.query.context)
          : {};

        const evaluationContext = {
          ...baseContext,
          attributes: {
            ...baseContext.attributes,
            ...additionalContext.attributes,
          },
          ...additionalContext,
        };

        // Get the flag
        const organizationId = pluginContext.config.multiTenant.enabled
          ? evaluationContext.organizationId
          : undefined;
        const flag = await pluginContext.storage.getFlag(key, organizationId);

        if (!flag) {
          return {
            value: ctx.query.default || undefined,
            reason: "not_found",
          };
        }

        // Evaluate the flag
        const result = await evaluateFlags(
          flag,
          evaluationContext,
          pluginContext,
        );

        // Track evaluation if analytics enabled
        if (pluginContext.config.analytics.trackUsage) {
          await pluginContext.storage
            .trackEvaluation({
              flagKey: key,
              userId: evaluationContext.userId,
              context: evaluationContext,
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

        return result;
      },
    },

    "/api/flags/evaluate/batch": {
      POST: async (ctx: any) => {
        const {
          keys,
          defaults = {},
          context: additionalContext = {},
        } = ctx.body;

        if (!Array.isArray(keys)) {
          throw new Error("Keys must be an array");
        }

        const session = await ctx.getSession();

        // Build evaluation context from session
        const baseContext =
          ctx.featureFlags?.context ||
          (await buildEvaluationContext(ctx, session, pluginContext));

        // Merge additional context from body
        const evaluationContext = {
          ...baseContext,
          attributes: {
            ...baseContext.attributes,
            ...additionalContext.attributes,
          },
          ...additionalContext,
        };

        // Evaluate all flags
        const results = await evaluateFlagsBatch(
          keys,
          evaluationContext,
          pluginContext,
        );

        // Apply defaults for missing flags
        for (const key of keys) {
          if (
            results[key]?.reason === "not_found" &&
            defaults[key] !== undefined
          ) {
            results[key].value = defaults[key];
          }
        }

        return {
          flags: results,
          context: evaluationContext,
          evaluatedAt: new Date(),
        };
      },
    },

    "/api/flags/all": {
      GET: async (ctx: any) => {
        const session = await ctx.getSession();

        // Build evaluation context from session
        const baseContext =
          ctx.featureFlags?.context ||
          (await buildEvaluationContext(ctx, session, pluginContext));

        // Merge additional context from query params if provided
        const additionalContext = ctx.query.context
          ? JSON.parse(ctx.query.context)
          : {};

        const evaluationContext = {
          ...baseContext,
          attributes: {
            ...baseContext.attributes,
            ...additionalContext.attributes,
          },
          ...additionalContext,
        };

        // Get organization ID if multi-tenant
        const organizationId = pluginContext.config.multiTenant.enabled
          ? evaluationContext.organizationId
          : undefined;

        // Get all enabled flags
        const flags = await pluginContext.storage.listFlags(organizationId, {
          filter: { enabled: true },
        });

        // Evaluate each flag
        const results: Record<string, any> = {};
        for (const flag of flags) {
          const result = await evaluateFlags(
            flag,
            evaluationContext,
            pluginContext,
          );
          results[flag.key] = result;
        }

        return {
          flags: results,
          context: evaluationContext,
          evaluatedAt: new Date(),
        };
      },
    },

    "/api/flags/track": {
      POST: async (ctx: any) => {
        const { flagKey, event, data } = ctx.body;

        if (!flagKey || !event) {
          throw new Error("flagKey and event are required");
        }

        const session = await ctx.getSession();
        const userId = session?.user?.id || "anonymous";

        // Store tracking event (implementation depends on analytics backend)
        // For now, just log it
        const trackingData = {
          flagKey,
          userId,
          event,
          data,
          timestamp: new Date(),
          sessionId: session?.id,
        };

        console.log("[feature-flags] Tracking event:", trackingData);

        return { success: true };
      },
    },

    // Admin endpoints for flag management
    "/api/admin/flags": {
      GET: async (ctx: any) => {
        const organizationId = ctx.query.organizationId;
        const flags = await pluginContext.storage.listFlags(organizationId, {
          limit: ctx.query.limit ? parseInt(ctx.query.limit) : undefined,
          offset: ctx.query.offset ? parseInt(ctx.query.offset) : undefined,
        });

        // Add statistics if requested
        if (ctx.query.includeStats === "true") {
          const flagsWithStats = await Promise.all(
            flags.map(async (flag) => {
              const stats = await pluginContext.storage.getEvaluationStats(
                flag.id,
              );
              return { ...flag, stats };
            }),
          );
          return { flags: flagsWithStats };
        }

        return { flags };
      },

      POST: async (ctx: any) => {
        const flagData = ctx.body;

        // Add organization ID if multi-tenant
        if (pluginContext.config.multiTenant.enabled) {
          const session = await ctx.getSession();
          flagData.organizationId =
            session?.organization?.id || session?.user?.organizationId;
        }

        const flag = await pluginContext.storage.createFlag(flagData);
        return flag;
      },
    },

    "/api/admin/flags/:id": {
      GET: async (ctx: any) => {
        const { id } = ctx.params;
        const flag = await pluginContext.storage.getFlagById(id);

        if (!flag) {
          ctx.response.status = 404;
          return { error: "Flag not found" };
        }

        // Include rules and overrides if requested
        if (ctx.query.include === "all") {
          const rules = await pluginContext.storage.getRulesForFlag(id);
          const overrides = await pluginContext.storage.listOverrides(id);
          return { ...flag, rules, overrides };
        }

        return flag;
      },

      PATCH: async (ctx: any) => {
        const { id } = ctx.params;
        const updates = ctx.body;

        const flag = await pluginContext.storage.updateFlag(id, updates);
        return flag;
      },

      DELETE: async (ctx: any) => {
        const { id } = ctx.params;
        await pluginContext.storage.deleteFlag(id);
        return { success: true };
      },
    },

    "/api/admin/flags/:id/rules": {
      GET: async (ctx: any) => {
        const { id } = ctx.params;
        const rules = await pluginContext.storage.getRulesForFlag(id);
        return { rules };
      },

      POST: async (ctx: any) => {
        const { id } = ctx.params;
        const ruleData = { ...ctx.body, flagId: id };

        const rule = await pluginContext.storage.createRule(ruleData);
        return rule;
      },
    },

    "/api/admin/rules/:id": {
      PATCH: async (ctx: any) => {
        const { id } = ctx.params;
        const updates = ctx.body;

        const rule = await pluginContext.storage.updateRule(id, updates);
        return rule;
      },

      DELETE: async (ctx: any) => {
        const { id } = ctx.params;
        await pluginContext.storage.deleteRule(id);
        return { success: true };
      },
    },

    "/api/admin/rules/:id/reorder": {
      PATCH: async (ctx: any) => {
        const { flagId, ruleIds } = ctx.body;

        if (!flagId || !Array.isArray(ruleIds)) {
          throw new Error("flagId and ruleIds are required");
        }

        await pluginContext.storage.reorderRules(flagId, ruleIds);
        return { success: true };
      },
    },

    "/api/admin/flags/:id/overrides": {
      GET: async (ctx: any) => {
        const { id } = ctx.params;
        const overrides = await pluginContext.storage.listOverrides(id);
        return { overrides };
      },

      POST: async (ctx: any) => {
        const { id } = ctx.params;
        const overrideData = { ...ctx.body, flagId: id };

        // Check if override already exists
        const existing = await pluginContext.storage.getOverride(
          id,
          overrideData.userId,
        );
        if (existing) {
          // Update existing override
          const updated = await pluginContext.storage.updateOverride(
            existing.id,
            overrideData,
          );
          return updated;
        }

        const override =
          await pluginContext.storage.createOverride(overrideData);
        return override;
      },
    },

    "/api/admin/overrides/:id": {
      DELETE: async (ctx: any) => {
        const { id } = ctx.params;
        await pluginContext.storage.deleteOverride(id);
        return { success: true };
      },
    },

    "/api/admin/overrides": {
      GET: async (ctx: any) => {
        const { flagId, userId } = ctx.query;
        const overrides = await pluginContext.storage.listOverrides(
          flagId,
          userId,
        );
        return { overrides };
      },
    },

    "/api/admin/audit": {
      GET: async (ctx: any) => {
        const options = {
          userId: ctx.query.userId,
          flagId: ctx.query.flagId,
          action: ctx.query.action,
          startDate: ctx.query.startDate
            ? new Date(ctx.query.startDate)
            : undefined,
          endDate: ctx.query.endDate ? new Date(ctx.query.endDate) : undefined,
          limit: ctx.query.limit ? parseInt(ctx.query.limit) : 100,
          offset: ctx.query.offset ? parseInt(ctx.query.offset) : 0,
        };

        const logs = await pluginContext.storage.getAuditLogs(options);
        return { logs };
      },
    },

    "/api/admin/flags/:id/stats": {
      GET: async (ctx: any) => {
        const { id } = ctx.params;

        const period = ctx.query.period
          ? {
              start: new Date(
                ctx.query.startDate || Date.now() - 7 * 24 * 60 * 60 * 1000,
              ),
              end: new Date(ctx.query.endDate || Date.now()),
            }
          : undefined;

        const stats = await pluginContext.storage.getEvaluationStats(
          id,
          period,
        );
        return stats;
      },
    },
  };
}
