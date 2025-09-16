// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import type { BetterAuthPlugin } from "better-auth";
import { createAuthEndpoint, sessionMiddleware } from "better-auth/api";
import { z } from "zod";
import { flagOverrideInputSchema } from "../../schema/validation";
import type { PluginContext } from "../../types";
import { ensureFlagOwnership, jsonError } from "../shared";

/** Better Auth plugin endpoints type, avoids import cycles with endpoints/index.ts */
export type FlagEndpoints = NonNullable<BetterAuthPlugin["endpoints"]>;

/**
 * Creates admin endpoints for feature flag overrides management.
 *
 * REST API:
 * - GET /admin/overrides - List overrides (with optional filtering)
 * - POST /admin/overrides - Create new override
 * - GET /admin/overrides/:id - Get specific override
 * - PATCH /admin/overrides/:id - Update override
 * - DELETE /admin/overrides/:id - Delete override
 *
 * Overrides are independent resources but validate flag ownership for security.
 *
 * SECURITY: All operations validate user owns the associated flag:
 * - Create/Update: Validate flag ownership before override creation
 * - Get/Delete: Validate flag ownership through associated flag
 * - List: flagId filter validated for ownership
 *
 * Prevents users from creating overrides for flags they don't own.
 *
 * @param pluginContext - Plugin context with DB, config, and utilities
 * @returns Override management endpoints with validation
 * @see plugins/feature-flags/src/endpoints/shared.ts
 * @see plugins/feature-flags/src/schema/validation.ts
 */
export function createAdminOverridesEndpoints(
  pluginContext: PluginContext,
): FlagEndpoints {
  // GET /feature-flags/admin/overrides (canonical RESTful)
  const listFeatureFlagOverridesHandler = createAuthEndpoint(
    "/feature-flags/admin/overrides",
    {
      method: "GET",
      use: [sessionMiddleware],
      query: z
        .object({
          organizationId: z.string().optional(),
          cursor: z.string().optional(),
          limit: z.coerce.number().min(1).max(100).optional(),
          q: z.string().optional(),
          sort: z.string().optional(), // e.g., "-createdAt", "flagId"
          flagId: z.string().optional(),
          userId: z.string().optional(),
        })
        .optional(),
      metadata: {
        openapi: {
          operationId: "auth.api.listFeatureFlagOverrides",
          summary: "List Flag Overrides",
          description: "Get flag overrides (admin only)",
        },
      },
    },
    async (ctx) => {
      try {
        const { organizationId, cursor, limit, q, sort, flagId, userId } =
          ctx.query || {};

        // SECURITY: Multi-tenant organization access validation
        if (pluginContext.config.multiTenant.enabled && flagId) {
          const res = await ensureFlagOwnership(ctx, pluginContext, flagId);
          if (!res.ok) return res.response;
        }

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

        // Build filter criteria
        const buildFilters = (overrides: any[]) => {
          let filtered = overrides;

          // Search filter (q parameter)
          if (q && q.trim().length > 0) {
            const needle = q.toLowerCase();
            filtered = filtered.filter(
              (o: any) =>
                (o.flagId || "").toLowerCase().includes(needle) ||
                (o.userId || "").toLowerCase().includes(needle),
            );
          }

          return filtered;
        };

        // Get overrides with basic filters
        const overrides = await pluginContext.storage.listOverrides(
          flagId,
          userId,
        );

        // Apply search filtering
        const filtered = buildFilters(overrides);

        // Apply sorting
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

        // Apply pagination
        const page = sorted.slice(offset, offset + pageSize);
        const hasMore = offset + pageSize < sorted.length;
        const nextCursor = hasMore
          ? encodeCursor(offset + pageSize)
          : undefined;

        return ctx.json({
          overrides: page,
          page: {
            nextCursor,
            limit: pageSize,
            hasMore,
          },
        });
      } catch (error) {
        console.error("[feature-flags] Error listing overrides:", error);
        return jsonError(ctx, "STORAGE_ERROR", "Failed to list overrides", 500);
      }
    },
  );

  // POST /feature-flags/admin/overrides (canonical RESTful)
  const createFeatureFlagOverrideHandler = createAuthEndpoint(
    "/feature-flags/admin/overrides",
    {
      method: "POST",
      use: [sessionMiddleware],
      body: flagOverrideInputSchema.omit({ expiresAt: true }).extend({
        expiresAt: z.string().datetime().optional(), // Accept RFC3339/ISO 8601 string
      }),
      metadata: {
        openapi: {
          operationId: "auth.api.createFeatureFlagOverride",
          summary: "Create Flag Override",
          description: "Create a user override for a feature flag (admin only)",
        },
      },
    },
    async (ctx) => {
      try {
        const overrideData = {
          ...ctx.body,
          expiresAt: ctx.body.expiresAt
            ? new Date(ctx.body.expiresAt)
            : undefined,
        };

        // SECURITY: Multi-tenant - ensure user owns the flag being overridden
        if (pluginContext.config.multiTenant.enabled) {
          const res = await ensureFlagOwnership(
            ctx,
            pluginContext,
            overrideData.flagId,
          );
          if (!res.ok) return res.response;
        }

        const override =
          await pluginContext.storage.createOverride(overrideData);
        return ctx.json(override);
      } catch (error) {
        console.error("[feature-flags] Error creating override:", error);
        return jsonError(
          ctx,
          "STORAGE_ERROR",
          "Failed to create override",
          500,
        );
      }
    },
  );

  // GET /feature-flags/admin/overrides/{id} (canonical RESTful)
  const getFeatureFlagOverrideHandler = createAuthEndpoint(
    "/feature-flags/admin/overrides/:id",
    {
      method: "GET",
      use: [sessionMiddleware],
      metadata: {
        openapi: {
          operationId: "auth.api.getFeatureFlagOverride",
          summary: "Get Flag Override",
          description: "Get a specific flag override (admin only)",
        },
      },
    },
    async (ctx) => {
      try {
        const id = ctx.params?.id;
        if (!id) {
          return jsonError(
            ctx,
            "INVALID_OVERRIDE_ID",
            "Override ID is required",
            400,
          );
        }

        const override = await pluginContext.storage.getOverrideById(id);
        if (!override) {
          return jsonError(
            ctx,
            "OVERRIDE_NOT_FOUND",
            "Override not found",
            404,
          );
        }

        // SECURITY: Multi-tenant - ensure access to own organization's overrides
        if (pluginContext.config.multiTenant.enabled) {
          const flag = await pluginContext.storage.getFlagById(override.flagId);
          if (flag) {
            const res = await ensureFlagOwnership(ctx, pluginContext, flag.id);
            if (!res.ok) return res.response;
          }
        }

        return ctx.json({ override });
      } catch (error) {
        console.error("[feature-flags] Error getting override:", error);
        return jsonError(ctx, "STORAGE_ERROR", "Failed to get override", 500);
      }
    },
  );

  // PATCH /feature-flags/admin/overrides/{id} (canonical RESTful)
  const updateFeatureFlagOverrideHandler = createAuthEndpoint(
    "/feature-flags/admin/overrides/:id",
    {
      method: "PATCH",
      use: [sessionMiddleware],
      body: flagOverrideInputSchema
        .omit({ flagId: true, userId: true, expiresAt: true })
        .partial()
        .extend({
          expiresAt: z.string().datetime().optional(), // Accept RFC3339/ISO 8601 string
        }),
      metadata: {
        openapi: {
          operationId: "auth.api.updateFeatureFlagOverride",
          summary: "Update Flag Override",
          description: "Update a flag override (admin only)",
        },
      },
    },
    async (ctx) => {
      try {
        const id = ctx.params?.id;
        if (!id) {
          return jsonError(
            ctx,
            "INVALID_OVERRIDE_ID",
            "Override ID is required",
            400,
          );
        }

        // Validate override exists before update
        const existingOverride =
          await pluginContext.storage.getOverrideById(id);
        if (!existingOverride) {
          return jsonError(
            ctx,
            "OVERRIDE_NOT_FOUND",
            "Override not found",
            404,
          );
        }

        // SECURITY: Multi-tenant - ensure can only update own org's overrides
        if (pluginContext.config.multiTenant.enabled) {
          const flag = await pluginContext.storage.getFlagById(
            existingOverride.flagId,
          );
          if (flag) {
            const res = await ensureFlagOwnership(ctx, pluginContext, flag.id);
            if (!res.ok) return res.response;
          }
        }

        const updates = {
          ...ctx.body,
          expiresAt: ctx.body.expiresAt
            ? new Date(ctx.body.expiresAt)
            : undefined,
        };

        const updatedOverride = await pluginContext.storage.updateOverride(
          id,
          updates,
        );

        return ctx.json({ override: updatedOverride });
      } catch (error) {
        console.error("[feature-flags] Error updating override:", error);
        return jsonError(
          ctx,
          "STORAGE_ERROR",
          "Failed to update override",
          500,
        );
      }
    },
  );

  // DELETE /feature-flags/admin/overrides/{id} (canonical RESTful)
  const deleteFeatureFlagOverrideHandler = createAuthEndpoint(
    "/feature-flags/admin/overrides/:id",
    {
      method: "DELETE",
      use: [sessionMiddleware],
      metadata: {
        openapi: {
          operationId: "auth.api.deleteFeatureFlagOverride",
          summary: "Delete Flag Override",
          description: "Delete a flag override (admin only)",
        },
      },
    },
    async (ctx) => {
      try {
        const id = ctx.params?.id;

        // SECURITY: Multi-tenant - ensure user owns the flag being overridden
        if (pluginContext.config.multiTenant.enabled) {
          const existingOverride =
            await pluginContext.storage.getOverrideById(id);
          if (existingOverride) {
            const res = await ensureFlagOwnership(
              ctx,
              pluginContext,
              existingOverride.flagId,
            );
            if (!res.ok) return res.response;
          }
        }

        await pluginContext.storage.deleteOverride(id);
        return new Response(null, { status: 204 });
      } catch (error) {
        console.error("[feature-flags] Error deleting override:", error);
        return jsonError(
          ctx,
          "STORAGE_ERROR",
          "Failed to delete override",
          500,
        );
      }
    },
  );

  return {
    // Overrides CRUD
    listFeatureFlagOverrides: listFeatureFlagOverridesHandler,
    createFeatureFlagOverride: createFeatureFlagOverrideHandler,
    getFeatureFlagOverride: getFeatureFlagOverrideHandler,
    updateFeatureFlagOverride: updateFeatureFlagOverrideHandler,
    deleteFeatureFlagOverride: deleteFeatureFlagOverrideHandler,
  } as FlagEndpoints;
}
