// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import type { BetterAuthPlugin } from "better-auth";
import { createAuthEndpoint, sessionMiddleware } from "better-auth/api";
import { z } from "zod";
import { flagRuleInputSchema } from "../../schema/validation";
import type { PluginContext } from "../../types";
import { ensureFlagOwnership, jsonError } from "../shared";

/** Better Auth plugin endpoints type, avoids import cycles with endpoints/index.ts */
export type FlagEndpoints = NonNullable<BetterAuthPlugin["endpoints"]>;

/**
 * Creates admin endpoints for feature flag rules management.
 *
 * REST API:
 * - GET /admin/flags/:flagId/rules - List rules for flag
 * - POST /admin/flags/:flagId/rules - Create new rule
 * - GET /admin/flags/:flagId/rules/:ruleId - Get specific rule
 * - PATCH /admin/flags/:flagId/rules/:ruleId - Update rule
 * - DELETE /admin/flags/:flagId/rules/:ruleId - Delete rule
 * - POST /admin/flags/:flagId/rules/reorder - Reorder rules
 *
 * Rules always scoped to parent flag for security and logical organization.
 *
 * PRIORITY: Rules evaluated in priority order (1 = highest).
 * Reorder endpoint enables bulk priority updates for predictable evaluation.
 *
 * @param pluginContext - Plugin context with DB, config, and utilities
 * @returns Rule management endpoints with validation
 * @see plugins/feature-flags/src/endpoints/shared.ts
 * @see plugins/feature-flags/src/schema/validation.ts
 */
export function createAdminRulesEndpoints(
  pluginContext: PluginContext,
): FlagEndpoints {
  // GET /feature-flags/admin/flags/{flagId}/rules (canonical RESTful)
  const listFeatureFlagRulesHandler = createAuthEndpoint(
    "/feature-flags/admin/flags/:flagId/rules",
    {
      method: "GET",
      use: [sessionMiddleware],
      metadata: {
        openapi: {
          operationId: "auth.api.listFeatureFlagRules",
          summary: "List Flag Rules",
          description: "Get all rules for a feature flag (admin only)",
        },
      },
    },
    async (ctx) => {
      try {
        const flagId = ctx.params?.flagId;
        if (pluginContext.config.multiTenant.enabled) {
          const res = await ensureFlagOwnership(ctx, pluginContext, flagId);
          if (!res.ok) return res.response;
        }
        const rules = await pluginContext.storage.getRulesForFlag(flagId);
        return ctx.json({ rules });
      } catch (error) {
        console.error("[feature-flags] Error listing rules:", error);
        return jsonError(ctx, "STORAGE_ERROR", "Failed to list rules", 500);
      }
    },
  );

  // POST /feature-flags/admin/flags/{flagId}/rules (canonical RESTful)
  const createFeatureFlagRuleHandler = createAuthEndpoint(
    "/feature-flags/admin/flags/:flagId/rules",
    {
      method: "POST",
      use: [sessionMiddleware],
      body: flagRuleInputSchema.omit({ name: true }), // API rules don't require names
      metadata: {
        openapi: {
          operationId: "auth.api.createFeatureFlagRule",
          summary: "Create Flag Rule",
          description: "Create a new rule for a feature flag (admin only)",
        },
      },
    },
    async (ctx) => {
      try {
        const flagId = ctx.params?.flagId;
        if (pluginContext.config.multiTenant.enabled) {
          const res = await ensureFlagOwnership(ctx, pluginContext, flagId);
          if (!res.ok) return res.response;
        }
        const ruleData = { ...ctx.body, flagId, enabled: true };
        const rule = await pluginContext.storage.createRule(ruleData);
        return ctx.json(rule);
      } catch (error) {
        console.error("[feature-flags] Error creating rule:", error);
        return jsonError(ctx, "STORAGE_ERROR", "Failed to create rule", 500);
      }
    },
  );

  // GET /feature-flags/admin/flags/{flagId}/rules/{ruleId} (canonical RESTful)
  const getFeatureFlagRuleHandler = createAuthEndpoint(
    "/feature-flags/admin/flags/:flagId/rules/:ruleId",
    {
      method: "GET",
      use: [sessionMiddleware],
      metadata: {
        openapi: {
          operationId: "auth.api.getFeatureFlagRule",
          summary: "Get Flag Rule",
          description: "Get a specific rule for a feature flag (admin only)",
        },
      },
    },
    async (ctx) => {
      try {
        const { flagId, ruleId } = ctx.params || {};
        if (pluginContext.config.multiTenant.enabled) {
          const res = await ensureFlagOwnership(ctx, pluginContext, flagId);
          if (!res.ok) return res.response;
        }
        // Fetch flag rules and find specific rule by ID
        const rules = await pluginContext.storage.getRulesForFlag(flagId);
        const rule = rules.find((r) => r.id === ruleId);
        if (!rule) {
          return jsonError(ctx, "NOT_FOUND", "Rule not found", 404);
        }
        return ctx.json(rule);
      } catch (error) {
        console.error("[feature-flags] Error getting rule:", error);
        return jsonError(ctx, "STORAGE_ERROR", "Failed to get rule", 500);
      }
    },
  );

  // PATCH /feature-flags/admin/flags/{flagId}/rules/{ruleId} (canonical RESTful)
  const updateFeatureFlagRuleHandler = createAuthEndpoint(
    "/feature-flags/admin/flags/:flagId/rules/:ruleId",
    {
      method: "PATCH",
      use: [sessionMiddleware],
      body: flagRuleInputSchema.omit({ name: true }).partial(), // Partial updates for rules
      metadata: {
        openapi: {
          operationId: "auth.api.updateFeatureFlagRule",
          summary: "Update Flag Rule",
          description: "Update a rule for a feature flag (admin only)",
        },
      },
    },
    async (ctx) => {
      try {
        const { flagId, ruleId } = ctx.params || {};
        if (pluginContext.config.multiTenant.enabled) {
          const res = await ensureFlagOwnership(ctx, pluginContext, flagId);
          if (!res.ok) return res.response;
        }
        const rule = await pluginContext.storage.updateRule(ruleId, ctx.body);
        return ctx.json(rule);
      } catch (error) {
        console.error("[feature-flags] Error updating rule:", error);
        return jsonError(ctx, "STORAGE_ERROR", "Failed to update rule", 500);
      }
    },
  );

  // DELETE /feature-flags/admin/flags/{flagId}/rules/{ruleId} (canonical RESTful)
  const deleteFeatureFlagRuleHandler = createAuthEndpoint(
    "/feature-flags/admin/flags/:flagId/rules/:ruleId",
    {
      method: "DELETE",
      use: [sessionMiddleware],
      metadata: {
        openapi: {
          operationId: "auth.api.deleteFeatureFlagRule",
          summary: "Delete Flag Rule",
          description: "Delete a rule for a feature flag (admin only)",
        },
      },
    },
    async (ctx) => {
      try {
        const { flagId, ruleId } = ctx.params || {};
        if (pluginContext.config.multiTenant.enabled) {
          const res = await ensureFlagOwnership(ctx, pluginContext, flagId);
          if (!res.ok) return res.response;
        }
        await pluginContext.storage.deleteRule(ruleId);
        return new Response(null, { status: 204 });
      } catch (error) {
        console.error("[feature-flags] Error deleting rule:", error);
        return jsonError(ctx, "STORAGE_ERROR", "Failed to delete rule", 500);
      }
    },
  );

  // POST /feature-flags/admin/flags/{flagId}/rules/reorder (canonical RESTful)
  const reorderFeatureFlagRulesHandler = createAuthEndpoint(
    "/feature-flags/admin/flags/:flagId/rules/reorder",
    {
      method: "POST",
      use: [sessionMiddleware],
      body: z.object({
        ids: z.array(z.string()).describe("Array of rule IDs in new order"),
      }),
      metadata: {
        openapi: {
          operationId: "auth.api.reorderFeatureFlagRules",
          summary: "Reorder Flag Rules",
          description: "Reorder rules for a feature flag (admin only)",
        },
      },
    },
    async (ctx) => {
      try {
        const flagId = ctx.params?.flagId;
        const { ids } = ctx.body;

        if (pluginContext.config.multiTenant.enabled) {
          const res = await ensureFlagOwnership(ctx, pluginContext, flagId);
          if (!res.ok) return res.response;
        }

        // SECURITY: Validate all rule IDs belong to this flag
        const existingRules =
          await pluginContext.storage.getRulesForFlag(flagId);
        const existingIds = new Set(existingRules.map((r) => r.id));
        const providedIds = new Set(ids);

        if (
          existingIds.size !== providedIds.size ||
          !Array.from(existingIds).every((id) => providedIds.has(id))
        ) {
          return jsonError(
            ctx,
            "INVALID_INPUT",
            "Rule IDs don't match existing rules",
            400,
          );
        }

        // Priority assignment: index + 1 (1 = highest priority)
        const updates = ids.map((id, index) => ({ id, priority: index + 1 }));
        await Promise.all(
          updates.map(({ id, priority }) =>
            pluginContext.storage.updateRule(id, { priority }),
          ),
        );

        const reorderedRules =
          await pluginContext.storage.getRulesForFlag(flagId);
        return ctx.json({ rules: reorderedRules });
      } catch (error) {
        console.error("[feature-flags] Error reordering rules:", error);
        return jsonError(ctx, "STORAGE_ERROR", "Failed to reorder rules", 500);
      }
    },
  );

  return {
    // Rules CRUD + reorder
    listFeatureFlagRules: listFeatureFlagRulesHandler,
    createFeatureFlagRule: createFeatureFlagRuleHandler,
    getFeatureFlagRule: getFeatureFlagRuleHandler,
    updateFeatureFlagRule: updateFeatureFlagRuleHandler,
    deleteFeatureFlagRule: deleteFeatureFlagRuleHandler,
    reorderFeatureFlagRules: reorderFeatureFlagRulesHandler,
  } as FlagEndpoints;
}
