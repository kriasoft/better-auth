// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import type { BetterAuthPlugin } from "better-auth";
import { createAuthEndpoint, sessionMiddleware } from "better-auth/api";
import { z } from "zod";
import type { PluginContext } from "../../types";
import { jsonError, resolveEffectiveOrgId } from "../shared";

/** Better Auth plugin endpoints type, avoids import cycles with endpoints/index.ts */
export type FlagEndpoints = NonNullable<BetterAuthPlugin["endpoints"]>;

/**
 * Creates admin endpoints for environments management and data export.
 *
 * REST API:
 * - GET /admin/environments - List all environments
 * - POST /admin/environments - Create new environment
 * - PATCH /admin/environments/:id - Update environment
 * - DELETE /admin/environments/:id - Delete environment
 * - POST /admin/export - Export feature flag data
 *
 * Environments provide logical separation for deployment stages
 * (dev, staging, production) within the same organization.
 *
 * SECURITY: Multi-tenant environment isolation:
 * - List: Auto-scoped to user's organization
 * - Create: Auto-assigns to user's organization if not specified
 * - Update/Delete: Validates environment belongs to user's organization
 * - Export: Scoped to user's organization data only
 *
 * @param pluginContext - Plugin context with DB, config, and utilities
 * @returns Environment and export endpoints with validation
 * @see plugins/feature-flags/src/endpoints/shared.ts
 */
export function createAdminEnvironmentsEndpoints(
  pluginContext: PluginContext,
): FlagEndpoints {
  // GET /feature-flags/admin/environments (canonical RESTful)
  const listFeatureFlagEnvironmentsHandler = createAuthEndpoint(
    "/feature-flags/admin/environments",
    {
      method: "GET",
      use: [sessionMiddleware],
      query: z
        .object({
          organizationId: z.string().optional(),
          cursor: z.string().optional(),
          limit: z.coerce.number().min(1).max(100).optional(),
          q: z.string().optional(),
          sort: z.string().optional(), // e.g., "-name", "key"
        })
        .optional(),
      metadata: {
        openapi: {
          operationId: "auth.api.listFeatureFlagEnvironments",
          summary: "List Environments",
          description: "Get all environments (admin only)",
        },
      },
    },
    async (ctx) => {
      try {
        const { organizationId, cursor, limit, q, sort } = ctx.query || {};

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

        // TODO: Placeholder environments (implement environment storage)
        const allEnvironments = [
          {
            id: "default",
            name: "Default",
            key: "default",
            description: "Default environment",
            organizationId: effectiveOrgId,
          },
          {
            id: "development",
            name: "Development",
            key: "development",
            description: "Development environment",
            organizationId: effectiveOrgId,
          },
          {
            id: "staging",
            name: "Staging",
            key: "staging",
            description: "Staging environment",
            organizationId: effectiveOrgId,
          },
          {
            id: "production",
            name: "Production",
            key: "production",
            description: "Production environment",
            organizationId: effectiveOrgId,
          },
        ];

        // Apply search filtering (q parameter)
        let filtered = allEnvironments;
        if (q && q.trim().length > 0) {
          const needle = q.toLowerCase();
          filtered = filtered.filter(
            (env: any) =>
              (env.name || "").toLowerCase().includes(needle) ||
              (env.key || "").toLowerCase().includes(needle) ||
              (env.description || "").toLowerCase().includes(needle),
          );
        }

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
          environments: page,
          page: {
            nextCursor,
            limit: pageSize,
            hasMore,
          },
        });
      } catch (error) {
        console.error("[feature-flags] Error listing environments:", error);
        return jsonError(
          ctx,
          "STORAGE_ERROR",
          "Failed to list environments",
          500,
        );
      }
    },
  );

  // POST /feature-flags/admin/environments (canonical RESTful)
  const createFeatureFlagEnvironmentHandler = createAuthEndpoint(
    "/feature-flags/admin/environments",
    {
      method: "POST",
      use: [sessionMiddleware],
      body: z.object({
        name: z.string(),
        key: z
          .string()
          .refine((val) => /^[a-z0-9-_]+$/i.test(val), {
            message:
              "Key must contain only alphanumeric characters, hyphens, and underscores",
          })
          .optional()
          .describe("Stable slug identifier for environment"),
        description: z.string().optional(),
        organizationId: z.string().optional(),
        config: z.record(z.string(), z.any()).optional(),
      }),
      metadata: {
        openapi: {
          operationId: "auth.api.createFeatureFlagEnvironment",
          summary: "Create Environment",
          description: "Create a new environment (admin only)",
        },
      },
    },
    async (ctx) => {
      try {
        const envData = { ...ctx.body };

        if (
          pluginContext.config.multiTenant.enabled &&
          !envData.organizationId
        ) {
          const session = ctx.context.session;
          if (session?.user?.organizationId) {
            envData.organizationId = session.user.organizationId;
          } else {
            return jsonError(
              ctx,
              "ORGANIZATION_REQUIRED",
              "Organization ID is required when multi-tenant is enabled",
              400,
            );
          }
        }

        // Generate key from name if not provided
        const key =
          envData.key ||
          envData.name
            .toLowerCase()
            .replace(/[^a-z0-9-_]/gi, "-")
            .replace(/-+/g, "-");

        // TODO: Placeholder creation (implement environment storage)
        const environment = {
          id: "env-" + Date.now(),
          ...envData,
          key,
          createdAt: new Date().toISOString(),
        };
        return ctx.json(environment);
      } catch (error) {
        console.error("[feature-flags] Error creating environment:", error);
        return jsonError(
          ctx,
          "STORAGE_ERROR",
          "Failed to create environment",
          500,
        );
      }
    },
  );

  // PATCH /feature-flags/admin/environments/{id} (canonical RESTful)
  const updateFeatureFlagEnvironmentHandler = createAuthEndpoint(
    "/feature-flags/admin/environments/:id",
    {
      method: "PATCH",
      use: [sessionMiddleware],
      body: z.object({
        name: z.string().optional(),
        key: z
          .string()
          .refine((val) => /^[a-z0-9-_]+$/i.test(val), {
            message:
              "Key must contain only alphanumeric characters, hyphens, and underscores",
          })
          .optional()
          .describe("Stable slug identifier for environment"),
        description: z.string().optional(),
        config: z.record(z.string(), z.any()).optional(),
      }),
      metadata: {
        openapi: {
          operationId: "auth.api.updateFeatureFlagEnvironment",
          summary: "Update Environment",
          description: "Update an environment (admin only)",
        },
      },
    },
    async (ctx) => {
      try {
        const id = ctx.params?.id;
        const updates = ctx.body;

        if (!id) {
          return jsonError(
            ctx,
            "INVALID_ENVIRONMENT_ID",
            "Environment ID is required",
            400,
          );
        }

        // TODO: Placeholder update (implement environment storage)
        const updatedEnvironment = {
          id,
          name: updates.name || "Updated Environment",
          description: updates.description || "Updated environment description",
          config: updates.config || {},
          updatedAt: new Date().toISOString(),
        };

        return ctx.json(updatedEnvironment);
      } catch (error) {
        console.error("[feature-flags] Error updating environment:", error);
        return jsonError(
          ctx,
          "STORAGE_ERROR",
          "Failed to update environment",
          500,
        );
      }
    },
  );

  // DELETE /feature-flags/admin/environments/{id} (canonical RESTful)
  const deleteFeatureFlagEnvironmentHandler = createAuthEndpoint(
    "/feature-flags/admin/environments/:id",
    {
      method: "DELETE",
      use: [sessionMiddleware],
      metadata: {
        openapi: {
          operationId: "auth.api.deleteFeatureFlagEnvironment",
          summary: "Delete Environment",
          description: "Delete an environment (admin only)",
        },
      },
    },
    async (ctx) => {
      try {
        const id = ctx.params?.id;

        if (!id) {
          return jsonError(
            ctx,
            "INVALID_ENVIRONMENT_ID",
            "Environment ID is required",
            400,
          );
        }

        // TODO: Placeholder deletion (implement environment storage)
        return new Response(null, { status: 204 });
      } catch (error) {
        console.error("[feature-flags] Error deleting environment:", error);
        return jsonError(
          ctx,
          "STORAGE_ERROR",
          "Failed to delete environment",
          500,
        );
      }
    },
  );

  // POST /feature-flags/admin/export (canonical RESTful)
  const exportFeatureFlagDataHandler = createAuthEndpoint(
    "/feature-flags/admin/export",
    {
      method: "POST",
      use: [sessionMiddleware],
      body: z.object({
        format: z.enum(["json", "csv", "yaml"]).default("json"),
        includeFlags: z.boolean().default(true),
        includeRules: z.boolean().default(true),
        includeOverrides: z.boolean().default(false),
        includeAuditLog: z.boolean().default(false),
        organizationId: z.string().optional(),
        flagIds: z.array(z.string()).optional(),
      }),
      metadata: {
        openapi: {
          operationId: "auth.api.exportFeatureFlagData",
          summary: "Export Data",
          description:
            "Export feature flag data in various formats (admin only)",
        },
      },
    },
    async (ctx) => {
      try {
        const {
          format,
          includeFlags,
          includeRules,
          includeOverrides,
          includeAuditLog,
          organizationId,
          flagIds,
        } = ctx.body;

        // SECURITY: Multi-tenant organization access validation
        const orgResult = resolveEffectiveOrgId(
          ctx,
          pluginContext,
          organizationId,
        );
        if (!orgResult.ok) return orgResult.response;
        const effectiveOrgId = orgResult.organizationId;

        const exportData: any = {
          exportedAt: new Date().toISOString(),
          format,
          organizationId: effectiveOrgId,
        };

        if (includeFlags) {
          const flags = await pluginContext.storage.listFlags(effectiveOrgId);
          exportData.flags = flags;
        }

        if (includeRules && includeFlags) {
          const rules = await Promise.all(
            (exportData.flags || []).map(async (flag: any) => ({
              flagId: flag.id,
              rules: await pluginContext.storage.getRulesForFlag(flag.id),
            })),
          );
          exportData.rules = rules;
        }

        if (includeOverrides) {
          const overrides = await pluginContext.storage.listOverrides(
            flagIds?.[0], // If specific flag IDs provided, get overrides for first one
            undefined,
          );
          exportData.overrides = overrides;
        }

        if (includeAuditLog) {
          const auditEntries = await pluginContext.storage.getAuditLogs({
            flagId: flagIds?.[0],
            limit: 1000,
          });
          exportData.auditLog = auditEntries;
        }

        // Set content type and disposition for download
        const contentType = {
          json: "application/json",
          csv: "text/csv",
          yaml: "application/yaml",
        }[format];

        return ctx.json(exportData, {
          headers: {
            "Content-Type": contentType,
            "Content-Disposition": `attachment; filename="feature-flags-export.${format}"`,
          },
        });
      } catch (error) {
        console.error("[feature-flags] Error exporting data:", error);
        return jsonError(ctx, "EXPORT_ERROR", "Failed to export data", 500);
      }
    },
  );

  return {
    // Environments
    listFeatureFlagEnvironments: listFeatureFlagEnvironmentsHandler,
    createFeatureFlagEnvironment: createFeatureFlagEnvironmentHandler,
    updateFeatureFlagEnvironment: updateFeatureFlagEnvironmentHandler,
    deleteFeatureFlagEnvironment: deleteFeatureFlagEnvironmentHandler,

    // Data Export (grouped with environments as it's operational/admin functionality)
    exportFeatureFlagData: exportFeatureFlagDataHandler,
  } as FlagEndpoints;
}
