// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import type { BetterAuthPlugin } from "better-auth";
import { createAuthEndpoint, sessionMiddleware } from "better-auth/api";
import { z } from "zod";
import type { PluginContext } from "../../types";
import {
  ensureFlagOwnership,
  jsonError,
  resolveEffectiveOrgId,
  validateAnalyticsDateRange,
} from "../shared";

/** Better Auth plugin endpoints type, avoids import cycles with endpoints/index.ts */
export type FlagEndpoints = NonNullable<BetterAuthPlugin["endpoints"]>;

/**
 * Creates admin endpoints for feature flag analytics and metrics.
 *
 * REST API:
 * - GET /admin/flags/:flagId/stats - Statistics for specific flag
 * - GET /admin/metrics/usage - Usage metrics across all flags
 *
 * Stats scoped to individual flags, metrics provide organizational overview.
 *
 * SECURITY: Multi-tenant analytics boundaries:
 * - Flag stats: Validate flag ownership before returning metrics
 * - Usage metrics: Auto-scope to user's organization
 * - Date range filtering: Consistent across all endpoints
 *
 * Users only see analytics for their own flags and organization.
 *
 * @param pluginContext - Plugin context with DB, config, and utilities
 * @returns Analytics endpoints with validation
 * @see plugins/feature-flags/src/endpoints/shared.ts
 */
export function createAdminAnalyticsEndpoints(
  pluginContext: PluginContext,
): FlagEndpoints {
  // GET /feature-flags/admin/flags/{flagId}/stats (canonical RESTful)
  const getFeatureFlagStatsHandler = createAuthEndpoint(
    "/feature-flags/admin/flags/:flagId/stats",
    {
      method: "GET",
      use: [sessionMiddleware],
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
      metadata: {
        openapi: {
          operationId: "auth.api.getFeatureFlagStats",
          summary: "Get Flag Statistics",
          description:
            "Get usage statistics for a feature flag with optional date range validation (max 90 days) and selective metrics projection (admin only)",
        },
      },
    },
    async (ctx) => {
      try {
        const flagId = ctx.params?.flagId;
        const { granularity, start, end, timezone, metrics } = ctx.query || {};

        if (pluginContext.config.multiTenant.enabled) {
          const res = await ensureFlagOwnership(ctx, pluginContext, flagId);
          if (!res.ok) return res.response;
        }

        // Validate date range with business rules
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
        console.error("[feature-flags] Error getting stats:", error);
        return jsonError(
          ctx,
          "STORAGE_ERROR",
          "Failed to retrieve statistics",
          500,
        );
      }
    },
  );

  // GET /feature-flags/admin/metrics/usage (canonical RESTful)
  const getFeatureFlagsUsageMetricsHandler = createAuthEndpoint(
    "/feature-flags/admin/metrics/usage",
    {
      method: "GET",
      use: [sessionMiddleware],
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
      metadata: {
        openapi: {
          operationId: "auth.api.getFeatureFlagsUsageMetrics",
          summary: "Get Usage Metrics",
          description:
            "Get operational usage metrics across all flags with optional date range validation (max 90 days) and selective metrics projection (admin only)",
        },
      },
    },
    async (ctx) => {
      try {
        const { start, end, organizationId, metrics } = ctx.query || {};

        // SECURITY: Multi-tenant organization access validation
        const orgResult = resolveEffectiveOrgId(
          ctx,
          pluginContext,
          organizationId,
        );
        if (!orgResult.ok) return orgResult.response;
        const effectiveOrgId = orgResult.organizationId;

        // Validate date range with business rules
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
        console.error("[feature-flags] Error getting usage metrics:", error);
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
    // Analytics
    getFeatureFlagStats: getFeatureFlagStatsHandler,
    getFeatureFlagsUsageMetrics: getFeatureFlagsUsageMetricsHandler,
  } as FlagEndpoints;
}
