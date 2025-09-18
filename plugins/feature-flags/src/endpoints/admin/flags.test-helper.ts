// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import type { BetterAuthPlugin } from "better-auth";
import { createAuthEndpoint } from "better-auth/api";
import { z } from "zod";
import { featureFlagInputSchema } from "../../schema/validation";
import type { PluginContext } from "../../types";
import {
  ensureFlagOwnership,
  jsonError,
  resolveEffectiveOrgId,
} from "../shared";

export type FlagEndpoints = NonNullable<BetterAuthPlugin["endpoints"]>;

// Test-only variant of admin flags endpoints without session middleware
export function createAdminFlagsEndpointsForTest(
  pluginContext: PluginContext,
): FlagEndpoints {
  const listFeatureFlagsHandler = createAuthEndpoint(
    "/feature-flags/admin/flags",
    {
      method: "GET",
      query: z
        .object({
          organizationId: z.string().optional(),
          cursor: z.string().optional(),
          limit: z.coerce.number().min(1).max(100).optional(),
          q: z.string().optional(),
          sort: z.string().optional(),
          type: z.enum(["boolean", "string", "number", "json"]).optional(),
          enabled: z.coerce.boolean().optional(),
          prefix: z.string().optional(),
          include: z.enum(["stats"]).optional(),
        })
        .optional(),
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

        const parseSort = (
          s?: string,
        ): { orderBy?: string; orderDirection?: "asc" | "desc" } => {
          if (!s) return {} as any;
          const desc = s.startsWith("-");
          const field = desc ? s.slice(1) : s;
          if (!field) return {} as any;
          return {
            orderBy: field,
            orderDirection: desc ? "desc" : "asc",
          } as any;
        };
        const sortSpec = parseSort(sort);

        // Fetch all, then filter/sort/paginate to compute nextCursor correctly
        let allFlags = await pluginContext.storage.listFlags(effectiveOrgId);

        // Server-side filters
        let filtered = allFlags.filter((f: any) => {
          if (type && f.type !== type) return false;
          if (enabled !== undefined && f.enabled !== enabled) return false;
          if (
            prefix &&
            !(f.key || "").toLowerCase().startsWith(prefix.toLowerCase())
          )
            return false;
          if (q && q.trim().length > 0) {
            const needle = q.toLowerCase();
            const text = ((f.key || "") + " " + (f.name || "")).toLowerCase();
            if (!text.includes(needle)) return false;
          }
          return true;
        });

        // Sort
        if ((sortSpec as any).orderBy) {
          const { orderBy, orderDirection } = sortSpec as any;
          filtered = filtered.sort((a: any, b: any) => {
            const av = a[orderBy];
            const bv = b[orderBy];
            const cmp = av < bv ? -1 : av > bv ? 1 : 0;
            return orderDirection === "desc" ? -cmp : cmp;
          });
        }

        const total = filtered.length;
        const pageItems = filtered.slice(offset, offset + pageSize);
        const items = await applyIncludeStats(pageItems);
        const nextCursor =
          total > offset + pageSize
            ? encodeCursor(offset + pageSize)
            : undefined;

        return ctx.json({ flags: items, nextCursor });
      } catch (error) {
        return jsonError(ctx, "STORAGE_ERROR", "Failed to list flags", 500);
      }
    },
  );

  // Only list is needed for these tests
  return {
    listFeatureFlags: listFeatureFlagsHandler,
  } as FlagEndpoints;
}
