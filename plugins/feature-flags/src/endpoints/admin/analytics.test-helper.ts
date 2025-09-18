// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import type { BetterAuthPlugin } from "better-auth";
import { createAuthEndpoint } from "better-auth/api";
import { z } from "zod";
import type { PluginContext } from "../../types";
import {
  ensureFlagOwnership,
  jsonError,
  resolveEffectiveOrgId,
  validateAnalyticsDateRange,
} from "../shared";

export type FlagEndpoints = NonNullable<BetterAuthPlugin["endpoints"]>;

// Test-only variant of admin analytics endpoints without session middleware
export function createAdminAnalyticsEndpointsForTest(
  pluginContext: PluginContext,
): FlagEndpoints {
  const getFeatureFlagStatsHandler = createAuthEndpoint(
    "/feature-flags/admin/flags/:flagId/stats",
    {
      method: "GET",
      // NOTE: no sessionMiddleware in tests
      query: z
        .object({
          granularity: z.enum(["hour", "day", "week", "month"]).optional(),
          start: z.string().optional(),
          end: z.string().optional(),
          timezone: z.string().optional(),
          metrics: z
            .array(
              z.enum([
                "total",
                "uniqueUsers",
                "errorRate",
                "avgLatency",
                "variants",
                "reasons",
              ]),
            )
            .optional(),
        })
        .optional(),
    },
    async (ctx) => {
      try {
        const flagId = ctx.params?.flagId;
        const { granularity, start, end, timezone, metrics } = ctx.query || {};

        if (pluginContext.config.multiTenant.enabled) {
          const res = await ensureFlagOwnership(ctx, pluginContext, flagId);
          if (!res.ok) return res.response;
        }

        const dateValidation = validateAnalyticsDateRange(
          { startDate: start, endDate: end },
          { maxDays: 90 },
        );
        if (!dateValidation.ok) {
          return jsonError(ctx, dateValidation.code, dateValidation.error, 400);
        }
        const dateRange = dateValidation.dateRange;
        const stats = await pluginContext.storage.getEvaluationStats(
          flagId,
          dateRange,
          { granularity, timezone, metrics },
        );
        return ctx.json({ stats });
      } catch (error) {
        return jsonError(
          ctx,
          "STORAGE_ERROR",
          "Failed to retrieve statistics",
          500,
        );
      }
    },
  );

  const getFeatureFlagsUsageMetricsHandler = createAuthEndpoint(
    "/feature-flags/admin/metrics/usage",
    {
      method: "GET",
      // NOTE: no sessionMiddleware in tests
      query: z
        .object({
          start: z.string().optional(),
          end: z.string().optional(),
          timezone: z.string().optional(),
          organizationId: z.string().optional(),
          metrics: z
            .array(
              z.enum([
                "total",
                "uniqueUsers",
                "errorRate",
                "avgLatency",
                "variants",
                "reasons",
              ]),
            )
            .optional(),
        })
        .optional(),
    },
    async (ctx) => {
      try {
        const { start, end, organizationId, metrics } = ctx.query || {};

        const orgResult = resolveEffectiveOrgId(
          ctx,
          pluginContext,
          organizationId,
        );
        if (!orgResult.ok) return orgResult.response;
        const effectiveOrgId = orgResult.organizationId;

        const dateValidation = validateAnalyticsDateRange(
          { startDate: start, endDate: end },
          { maxDays: 90 },
        );
        if (!dateValidation.ok) {
          return jsonError(ctx, dateValidation.code, dateValidation.error, 400);
        }
        const period = dateValidation.dateRange;

        const usageMetrics = await pluginContext.storage.getUsageMetrics(
          effectiveOrgId,
          period,
          { metrics },
        );

        return ctx.json({
          metrics: {
            ...usageMetrics,
            organizationId: effectiveOrgId,
            timeRange: { start, end },
          },
        });
      } catch (error) {
        return jsonError(
          ctx,
          "STORAGE_ERROR",
          "Failed to retrieve usage metrics",
          500,
        );
      }
    },
  );

  return {
    getFeatureFlagStats: getFeatureFlagStatsHandler,
    getFeatureFlagsUsageMetrics: getFeatureFlagsUsageMetricsHandler,
  } as FlagEndpoints;
}
