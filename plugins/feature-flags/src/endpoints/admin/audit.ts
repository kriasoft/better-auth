// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import type { BetterAuthPlugin } from "better-auth";
import { createAuthEndpoint, sessionMiddleware } from "better-auth/api";
import { z } from "zod";
import type { PluginContext } from "../../types";
import { ensureFlagOwnership, jsonError, parseDateRange } from "../shared";

/** Better Auth plugin endpoints type, avoids import cycles with endpoints/index.ts */
export type FlagEndpoints = NonNullable<BetterAuthPlugin["endpoints"]>;

/**
 * Creates admin endpoints for feature flag audit log management.
 *
 * REST API:
 * - GET /admin/audit - List audit entries (with filtering)
 * - GET /admin/audit/:id - Get specific audit entry
 *
 * Audit logs are read-only - entries created automatically during flag operations.
 *
 * SECURITY: Multi-tenant audit boundaries:
 * - List: flagId filter validated for ownership
 * - Get: Returns entry only if user owns associated flag
 * - Date range filtering: Helps scope queries for performance
 *
 * Users only see audit logs for their own flags.
 *
 * @param pluginContext - Plugin context with DB, config, and utilities
 * @returns Audit log endpoints with validation
 * @see plugins/feature-flags/src/endpoints/shared.ts
 */
export function createAdminAuditEndpoints(
  pluginContext: PluginContext,
): FlagEndpoints {
  // GET /feature-flags/admin/audit (canonical RESTful)
  const listFeatureFlagAuditEntriesHandler = createAuthEndpoint(
    "/feature-flags/admin/audit",
    {
      method: "GET",
      use: [sessionMiddleware],
      query: z
        .object({
          flagId: z.string().optional(),
          userId: z.string().optional(),
          action: z.enum(["create", "update", "delete", "evaluate"]).optional(),
          start: z.string().optional(),
          end: z.string().optional(),
          cursor: z.string().optional(),
          limit: z.coerce.number().min(1).max(100).optional(),
          q: z.string().optional(),
          sort: z.string().optional(), // e.g., "-timestamp", "action"
        })
        .optional(),
      metadata: {
        openapi: {
          operationId: "auth.api.listFeatureFlagAuditEntries",
          summary: "List Audit Entries",
          description: "Retrieve audit log entries (admin only)",
        },
      },
    },
    async (ctx) => {
      try {
        const { flagId, userId, action, start, end, cursor, limit, q, sort } =
          ctx.query || {};

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

        const range = parseDateRange({ startDate: start, endDate: end });
        const filters = {
          flagId,
          userId,
          action,
          startDate: range?.start,
          endDate: range?.end,
        };

        // Get audit logs with basic filters
        const allEntries = await pluginContext.storage.getAuditLogs(filters);

        // Apply search filtering (q parameter)
        let filtered = allEntries;
        if (q && q.trim().length > 0) {
          const needle = q.toLowerCase();
          filtered = filtered.filter(
            (entry: any) =>
              (entry.flagId || "").toLowerCase().includes(needle) ||
              (entry.userId || "").toLowerCase().includes(needle) ||
              (entry.action || "").toLowerCase().includes(needle),
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
          entries: page,
          page: {
            nextCursor,
            limit: pageSize,
            hasMore,
          },
        });
      } catch (error) {
        console.error("[feature-flags] Error getting audit log:", error);
        return jsonError(
          ctx,
          "STORAGE_ERROR",
          "Failed to retrieve audit log",
          500,
        );
      }
    },
  );

  // GET /feature-flags/admin/audit/{id} (canonical RESTful)
  const getFeatureFlagAuditEntryHandler = createAuthEndpoint(
    "/feature-flags/admin/audit/:id",
    {
      method: "GET",
      use: [sessionMiddleware],
      metadata: {
        openapi: {
          operationId: "auth.api.getFeatureFlagAuditEntry",
          summary: "Get Audit Entry",
          description: "Get a specific audit log entry (admin only)",
        },
      },
    },
    async (ctx) => {
      try {
        const id = ctx.params?.id;
        if (!id) {
          return jsonError(
            ctx,
            "INVALID_AUDIT_ID",
            "Audit entry ID is required",
            400,
          );
        }

        const entry = await pluginContext.storage.getAuditEntry(id);
        if (!entry) {
          return jsonError(
            ctx,
            "AUDIT_NOT_FOUND",
            "Audit entry not found",
            404,
          );
        }

        return ctx.json({ entry });
      } catch (error) {
        console.error("[feature-flags] Error getting audit entry:", error);
        return jsonError(
          ctx,
          "STORAGE_ERROR",
          "Failed to retrieve audit entry",
          500,
        );
      }
    },
  );

  return {
    // Audit
    listFeatureFlagAuditEntries: listFeatureFlagAuditEntriesHandler,
    getFeatureFlagAuditEntry: getFeatureFlagAuditEntryHandler,
  } as FlagEndpoints;
}
