// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import type { BetterAuthPlugin } from "better-auth";
import { createAuthEndpoint, sessionMiddleware } from "better-auth/api";
import { z } from "zod";
import { featureFlagInputSchema } from "../../schema/validation";
import type { PluginContext } from "../../types";
import {
  ensureFlagOwnership,
  jsonError,
  resolveEffectiveOrgId,
} from "../shared";

/** Better Auth plugin endpoints type, avoids import cycles with endpoints/index.ts */
export type FlagEndpoints = NonNullable<BetterAuthPlugin["endpoints"]>;

/**
 * Creates admin endpoints for feature flag CRUD operations.
 *
 * REST API:
 * - GET /admin/flags - List all flags
 * - POST /admin/flags - Create new flag
 * - GET /admin/flags/:id - Get specific flag
 * - PATCH /admin/flags/:id - Update flag
 * - DELETE /admin/flags/:id - Delete flag
 * - POST /admin/flags/:id/enable - Enable flag
 * - POST /admin/flags/:id/disable - Disable flag
 *
 * SECURITY: Defense-in-depth multi-tenant access control:
 * - List: resolveEffectiveOrgId() validates organization access
 * - Resource: ensureFlagOwnership() verifies flag ownership
 * - Single-tenant bypasses when multiTenant.enabled = false
 *
 * @param pluginContext - Plugin context with DB, config, and utilities
 * @returns Flag management endpoints with validation
 * @see plugins/feature-flags/src/endpoints/shared.ts
 * @see plugins/feature-flags/src/schema/validation.ts
 */
export function createAdminFlagsEndpoints(
  pluginContext: PluginContext,
): FlagEndpoints {
  // GET /feature-flags/admin/flags (canonical RESTful)
  const listFeatureFlagsHandler = createAuthEndpoint(
    "/feature-flags/admin/flags",
    {
      method: "GET",
      use: [sessionMiddleware],
      query: z
        .object({
          organizationId: z.string().optional(),
          cursor: z.string().optional(),
          limit: z.coerce.number().min(1).max(100).optional(),
          q: z.string().optional(),
          sort: z.string().optional(), // e.g., "-updatedAt", "key"
          type: z.enum(["boolean", "string", "number", "json"]).optional(),
          enabled: z.coerce.boolean().optional(),
          prefix: z.string().optional(),
          include: z.enum(["stats"]).optional(),
        })
        .optional(),
      metadata: {
        openapi: {
          operationId: "auth.api.listFeatureFlags",
          summary: "List Feature Flags",
          description:
            "List feature flags with pagination, search, filtering, and sorting (admin only). Supports type, enabled, and prefix filters.",
        },
      },
    },
    async (ctx) => {
      try {
        const {
          organizationId,
          cursor,
          limit,
          q,
          sort,
          type,
          enabled,
          prefix,
          include,
        } = ctx.query || {};

        // SECURITY: Multi-tenant organization access validation
        const orgResult = resolveEffectiveOrgId(
          ctx,
          pluginContext,
          organizationId,
        );
        if (!orgResult.ok) return orgResult.response;
        const effectiveOrgId = orgResult.organizationId;

        const pageSize = limit ?? 50;
        const decodeCursor = (c?: string): number => {
          if (!c) return 0;
          try {
            const s = Buffer.from(c, "base64").toString("utf8");
            const n = Number(s);
            return Number.isFinite(n) && n >= 0 ? n : 0;
          } catch {
            return 0;
          }
        };
        const encodeCursor = (n: number) =>
          Buffer.from(String(n), "utf8").toString("base64");
        const offset = decodeCursor(cursor);

        const applyIncludeStats = async (items: any[]) => {
          if (include !== "stats") return items;
          return Promise.all(
            items.map(async (flag) => {
              const stats = await pluginContext.storage.getEvaluationStats(
                flag.id,
              );
              return { ...flag, stats };
            }),
          );
        };

        // Parse sort into orderBy/orderDirection
        const parseSort = (
          s?: string,
        ): { orderBy?: string; orderDirection?: "asc" | "desc" } => {
          if (!s) return {};
          const desc = s.startsWith("-");
          const field = desc ? s.slice(1) : s;
          if (!field) return {};
          return {
            orderBy: field,
            orderDirection: desc ? "desc" : "asc",
          } as any;
        };
        const sortSpec = parseSort(sort);

        // Build filter criteria for first-class filters
        const buildFilters = (flags: any[]) => {
          let filtered = flags;

          // Search filter (q parameter)
          if (q && q.trim().length > 0) {
            const needle = q.toLowerCase();
            filtered = filtered.filter(
              (f: any) =>
                (f.key || "").toLowerCase().includes(needle) ||
                (f.name || "").toLowerCase().includes(needle),
            );
          }

          // Type filter
          if (type) {
            filtered = filtered.filter((f: any) => f.type === type);
          }

          // Enabled filter
          if (enabled !== undefined) {
            filtered = filtered.filter((f: any) => f.enabled === enabled);
          }

          // Prefix filter
          if (prefix) {
            filtered = filtered.filter((f: any) =>
              (f.key || "").toLowerCase().startsWith(prefix.toLowerCase()),
            );
          }

          return filtered;
        };

        // When search or complex filtering is needed, do in-memory processing
        const needsInMemoryFiltering =
          q || type || enabled !== undefined || prefix;

        if (needsInMemoryFiltering) {
          const all = await pluginContext.storage.listFlags(effectiveOrgId);
          const filtered = buildFilters(all);
          const sorted = sortSpec.orderBy
            ? [...filtered].sort((a: any, b: any) => {
                const dir =
                  (sortSpec.orderDirection || "asc") === "desc" ? -1 : 1;
                const av = a[sortSpec.orderBy!];
                const bv = b[sortSpec.orderBy!];
                if (av === bv) return 0;
                return av > bv ? dir : -dir;
              })
            : filtered;
          const page = sorted.slice(offset, offset + pageSize);
          const withStats = await applyIncludeStats(page);
          const hasMore = offset + pageSize < sorted.length;
          const nextCursor = hasMore
            ? encodeCursor(offset + pageSize)
            : undefined;

          return ctx.json({
            flags: withStats,
            page: {
              nextCursor,
              limit: pageSize,
              hasMore,
            },
          });
        }

        // Storage-level pagination + sort + filtering
        const filter: Record<string, any> = {};
        if (type) filter.type = type;
        if (enabled !== undefined) filter.enabled = enabled;
        if (prefix) filter.keyPrefix = prefix; // Assuming storage can handle key prefix filtering

        const flags = await pluginContext.storage.listFlags(effectiveOrgId, {
          limit: pageSize,
          offset,
          orderBy: sortSpec.orderBy,
          orderDirection: sortSpec.orderDirection,
          filter: Object.keys(filter).length > 0 ? filter : undefined,
        });

        const withStats = await applyIncludeStats(flags);
        const hasMore = flags.length === pageSize;
        const nextCursor = hasMore
          ? encodeCursor(offset + pageSize)
          : undefined;

        return ctx.json({
          flags: withStats,
          page: {
            nextCursor,
            limit: pageSize,
            hasMore,
          },
        });
      } catch (error) {
        console.error("[feature-flags] Error listing flags:", error);
        return jsonError(ctx, "STORAGE_ERROR", "Failed to list flags", 500);
      }
    },
  );

  // POST /feature-flags/admin/flags (canonical RESTful)
  const createFeatureFlagHandler = createAuthEndpoint(
    "/feature-flags/admin/flags",
    {
      method: "POST",
      use: [sessionMiddleware],
      body: featureFlagInputSchema.extend({
        organizationId: z.string().optional(), // Multi-tenant org ID
      }),
      metadata: {
        openapi: {
          operationId: "auth.api.createFeatureFlag",
          summary: "Create Feature Flag",
          description: "Create a new feature flag (admin only)",
        },
      },
    },
    async (ctx) => {
      try {
        const parseResult = featureFlagInputSchema
          .extend({
            organizationId: z.string().optional(),
          })
          .safeParse(ctx.body);

        if (!parseResult.success) {
          return jsonError(
            ctx,
            "INVALID_INPUT",
            "Invalid flag data",
            400,
            parseResult.error.issues,
          );
        }

        const flagData = parseResult.data as any;
        if (
          pluginContext.config.multiTenant.enabled &&
          !flagData.organizationId
        ) {
          const session = ctx.context.session;
          if (session?.user?.organizationId) {
            flagData.organizationId = session.user.organizationId;
          } else {
            return jsonError(
              ctx,
              "ORGANIZATION_REQUIRED",
              "Organization ID is required when multi-tenant is enabled",
              400,
            );
          }
        }

        const flag = await pluginContext.storage.createFlag(flagData);
        return ctx.json(flag);
      } catch (error) {
        console.error("[feature-flags] Error creating flag:", error);
        const errorMessage =
          error instanceof Error ? error.message : "Storage operation failed";
        const isValidationError =
          errorMessage.includes("duplicate") ||
          errorMessage.includes("unique") ||
          errorMessage.includes("constraint");

        return jsonError(
          ctx,
          "STORAGE_ERROR",
          isValidationError
            ? "Flag key already exists"
            : "Storage operation failed",
          isValidationError ? 409 : 500,
        );
      }
    },
  );

  // PATCH /feature-flags/admin/flags/{id} (canonical RESTful)
  const updateFeatureFlagHandler = createAuthEndpoint(
    "/feature-flags/admin/flags/:id",
    {
      method: "PATCH",
      use: [sessionMiddleware],
      body: featureFlagInputSchema.partial(), // Reuse schema, allow partial updates
      metadata: {
        openapi: {
          operationId: "auth.api.updateFeatureFlag",
          summary: "Update Feature Flag",
          description: "Update an existing feature flag (admin only)",
        },
      },
    },
    async (ctx) => {
      try {
        const id = ctx.params?.id;
        const updates = ctx.body;

        if (pluginContext.config.multiTenant.enabled) {
          const res = await ensureFlagOwnership(ctx, pluginContext, id);
          if (!res.ok) return res.response;
        }

        const flag = await pluginContext.storage.updateFlag(id, updates);
        return ctx.json(flag);
      } catch (error) {
        console.error("[feature-flags] Error updating flag:", error);
        return jsonError(ctx, "STORAGE_ERROR", "Failed to update flag", 500);
      }
    },
  );

  // DELETE /feature-flags/admin/flags/{id} (canonical RESTful)
  const deleteFeatureFlagHandler = createAuthEndpoint(
    "/feature-flags/admin/flags/:id",
    {
      method: "DELETE",
      use: [sessionMiddleware],
      metadata: {
        openapi: {
          operationId: "auth.api.deleteFeatureFlag",
          summary: "Delete Feature Flag",
          description: "Delete a feature flag (admin only)",
        },
      },
    },
    async (ctx) => {
      try {
        const id = ctx.params?.id;
        if (pluginContext.config.multiTenant.enabled) {
          const res = await ensureFlagOwnership(ctx, pluginContext, id);
          if (!res.ok) return res.response;
        }
        await pluginContext.storage.deleteFlag(id);
        return new Response(null, { status: 204 });
      } catch (error) {
        console.error("[feature-flags] Error deleting flag:", error);
        return jsonError(ctx, "STORAGE_ERROR", "Failed to delete flag", 500);
      }
    },
  );

  // GET /feature-flags/admin/flags/{id} (canonical RESTful)
  const getFeatureFlagHandler = createAuthEndpoint(
    "/feature-flags/admin/flags/:id",
    {
      method: "GET",
      use: [sessionMiddleware],
      metadata: {
        openapi: {
          operationId: "auth.api.getFeatureFlag",
          summary: "Get Feature Flag",
          description: "Get a specific feature flag (admin only)",
        },
      },
    },
    async (ctx) => {
      try {
        const id = ctx.params?.id;
        if (pluginContext.config.multiTenant.enabled) {
          const res = await ensureFlagOwnership(ctx, pluginContext, id);
          if (!res.ok) return res.response;
        }
        const flag = await pluginContext.storage.getFlag(id);
        if (!flag) {
          return jsonError(ctx, "NOT_FOUND", "Flag not found", 404);
        }
        return ctx.json(flag);
      } catch (error) {
        console.error("[feature-flags] Error getting flag:", error);
        return jsonError(ctx, "STORAGE_ERROR", "Failed to get flag", 500);
      }
    },
  );

  // POST /feature-flags/admin/flags/{id}/enable (canonical RESTful)
  const enableFeatureFlagHandler = createAuthEndpoint(
    "/feature-flags/admin/flags/:id/enable",
    {
      method: "POST",
      use: [sessionMiddleware],
      metadata: {
        openapi: {
          operationId: "auth.api.enableFeatureFlag",
          summary: "Enable Feature Flag",
          description: "Enable a feature flag (admin only)",
        },
      },
    },
    async (ctx) => {
      try {
        const id = ctx.params?.id;
        if (pluginContext.config.multiTenant.enabled) {
          const res = await ensureFlagOwnership(ctx, pluginContext, id);
          if (!res.ok) return res.response;
        }
        const flag = await pluginContext.storage.updateFlag(id, {
          enabled: true,
        });
        return ctx.json(flag);
      } catch (error) {
        console.error("[feature-flags] Error enabling flag:", error);
        return jsonError(ctx, "STORAGE_ERROR", "Failed to enable flag", 500);
      }
    },
  );

  // POST /feature-flags/admin/flags/{id}/disable (canonical RESTful)
  const disableFeatureFlagHandler = createAuthEndpoint(
    "/feature-flags/admin/flags/:id/disable",
    {
      method: "POST",
      use: [sessionMiddleware],
      metadata: {
        openapi: {
          operationId: "auth.api.disableFeatureFlag",
          summary: "Disable Feature Flag",
          description: "Disable a feature flag (admin only)",
        },
      },
    },
    async (ctx) => {
      try {
        const id = ctx.params?.id;
        if (pluginContext.config.multiTenant.enabled) {
          const res = await ensureFlagOwnership(ctx, pluginContext, id);
          if (!res.ok) return res.response;
        }
        const flag = await pluginContext.storage.updateFlag(id, {
          enabled: false,
        });
        return ctx.json(flag);
      } catch (error) {
        console.error("[feature-flags] Error disabling flag:", error);
        return jsonError(ctx, "STORAGE_ERROR", "Failed to disable flag", 500);
      }
    },
  );

  return {
    // Flags CRUD + enable/disable
    listFeatureFlags: listFeatureFlagsHandler,
    createFeatureFlag: createFeatureFlagHandler,
    getFeatureFlag: getFeatureFlagHandler,
    updateFeatureFlag: updateFeatureFlagHandler,
    deleteFeatureFlag: deleteFeatureFlagHandler,
    enableFeatureFlag: enableFeatureFlagHandler,
    disableFeatureFlag: disableFeatureFlagHandler,
  } as FlagEndpoints;
}
