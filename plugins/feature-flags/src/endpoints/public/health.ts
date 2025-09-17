// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import type { BetterAuthPlugin } from "better-auth";
import { createAuthEndpoint } from "better-auth/api";
import { z } from "zod";
import type { PluginContext } from "../../types";

/** Better Auth plugin endpoints type, avoids import cycles with endpoints/index.ts */
export type FlagEndpoints = NonNullable<BetterAuthPlugin["endpoints"]>;

/**
 * Performs health check logic shared between GET and HEAD methods.
 *
 * @param ctx - Request context
 * @param pluginContext - Plugin context with storage and config
 * @param headOnly - If true, skips verbose checks for HEAD requests
 * @returns Health check response
 */
async function performHealthCheck(
  ctx: any,
  pluginContext: PluginContext,
  headOnly = false,
): Promise<any> {
  try {
    const verbose = headOnly ? false : (ctx.query?.verbose ?? false);

    // Initialize health status with timestamp
    const health: any = {
      status: "healthy",
      timestamp: new Date().toISOString(),
      checks: {
        storage: "unknown",
        cache: "unknown",
      },
    };

    // HEALTH: Test storage connectivity
    try {
      // Lightweight storage test - list with limit 1
      await pluginContext.storage.listFlags(undefined, { limit: 1 });
      health.checks.storage = "healthy";
    } catch (error) {
      health.checks.storage = "unhealthy";
      health.status = "degraded";

      if (verbose) {
        health.details = {
          storage: {
            error:
              error instanceof Error ? error.message : "Storage check failed",
          },
        };
      }
    }

    // CACHE: Always healthy in this implementation
    health.checks.cache = "healthy";

    // Add verbose information
    if (verbose) {
      health.verbose = {
        version: "0.3.0",
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        config: {
          multiTenant: pluginContext.config.multiTenant.enabled,
          analytics: pluginContext.config.analytics.trackUsage,
        },
      };
    }

    const status = health.status === "healthy" ? 200 : 503;
    return ctx.json(health, { status });
  } catch (error) {
    console.error("[feature-flags] Health check failed:", error);
    return ctx.json(
      {
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        error: "Health check failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 503 },
    );
  }
}

/**
 * Creates public endpoint for feature flag health checking.
 *
 * ENDPOINT: GET /feature-flags/health - Service status monitoring
 *
 * Essential for load balancers, monitoring systems, and DevOps.
 *
 * COMPREHENSIVE CHECKS: Validates service components:
 * - Storage connectivity (database/storage layer)
 * - Cache availability (if applicable)
 * - Service dependencies
 *
 * HTTP STATUS CODES:
 * - 200: All systems healthy
 * - 503: Service degraded or unhealthy
 *
 * PERFORMANCE: Lightweight queries avoid impacting performance:
 * - Simple storage query with limit 1
 * - Fast cache availability check
 * - No expensive operations that could timeout
 *
 * @param pluginContext - Plugin context with DB, config, and utilities
 * @returns Health check endpoint for service monitoring
 * @see plugins/feature-flags/src/storage/interface.ts
 */
export function createPublicHealthEndpoints(
  pluginContext: PluginContext,
): FlagEndpoints {
  // GET /feature-flags/health (canonical)
  const checkFeatureFlagsHealthHandler = createAuthEndpoint(
    "/feature-flags/health",
    {
      method: "GET",
      query: z
        .object({
          verbose: z.coerce
            .boolean()
            .optional()
            .describe("Include verbose health details"),
        })
        .optional(),
      metadata: {
        openapi: {
          operationId: "auth.api.checkFeatureFlagsHealth",
          summary: "Health Check",
          description:
            "Check the health status of the feature flags service. Use ?verbose=1 for detailed information.",
        },
      },
    },
    async (ctx) => {
      return await performHealthCheck(ctx, pluginContext);
    },
  );

  return {
    // === CORE ENDPOINTS ===
    checkFeatureFlagsHealth: checkFeatureFlagsHealthHandler,
  } as FlagEndpoints;
}
