// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import type { BetterAuthPlugin } from "better-auth";
import { createAuthEndpoint } from "better-auth/api";
import { createHash } from "crypto";
import type { PluginContext } from "../../types";

/** Better Auth plugin endpoints type, avoids import cycles with endpoints/index.ts */
export type FlagEndpoints = NonNullable<BetterAuthPlugin["endpoints"]>;

/**
 * Creates public endpoint for feature flag configuration.
 *
 * ENDPOINT: GET /feature-flags/config - Public-safe configuration introspection
 *
 * Allows clients to understand server capabilities without exposing sensitive settings.
 *
 * SECURITY: Only public-safe configuration exposed:
 * - Multi-tenant status (needed for client behavior)
 * - Analytics capabilities (needed for client tracking)
 * - Version info (needed for compatibility)
 * - Capability flags (needed for feature detection)
 *
 * Internal config like DB credentials, API keys, etc. never exposed.
 *
 * @param pluginContext - Plugin context with DB, config, and utilities
 * @returns Configuration endpoint for client introspection
 * @see plugins/feature-flags/src/types.ts
 */
export function createPublicConfigEndpoints(
  pluginContext: PluginContext,
): FlagEndpoints {
  // GET /feature-flags/config (canonical)
  const getFeatureFlagsConfigHandler = createAuthEndpoint(
    "/feature-flags/config",
    {
      method: "GET",
      metadata: {
        openapi: {
          operationId: "auth.api.getFeatureFlagsConfig",
          summary: "Get Feature Flags Configuration",
          description:
            "Returns public-safe configuration for client introspection",
        },
      },
    },
    async (ctx) => {
      try {
        const config = {
          // SECURITY: Only expose public-safe configuration
          multiTenant: {
            enabled: pluginContext.config.multiTenant.enabled,
          },
          analytics: {
            trackUsage: pluginContext.config.analytics.trackUsage,
            trackPerformance: pluginContext.config.analytics.trackPerformance,
          },
          // Version info for client compatibility
          version: "0.3.0",
          capabilities: [
            "evaluation",
            "rules",
            "overrides",
            "analytics",
            "audit",
            pluginContext.config.multiTenant.enabled && "multiTenant",
          ].filter(Boolean),
        };

        // Generate ETag from config content for caching
        const configJson = JSON.stringify(config);
        const etag = `"${createHash("md5").update(configJson).digest("hex")}"`;

        // Check If-None-Match header for conditional request
        const ifNoneMatch = ctx.headers?.get("if-none-match");
        if (ifNoneMatch === etag) {
          return new Response(null, { status: 304 });
        }

        // Return config with caching headers
        return ctx.json(config, {
          headers: {
            ETag: etag,
            "Cache-Control": "public, max-age=300, stale-while-revalidate=60", // 5 min cache, 1 min stale
          },
        });
      } catch (error) {
        console.error("[feature-flags] Error getting config:", error);
        return ctx.json(
          {
            error: "CONFIG_ERROR",
            message: "Failed to retrieve configuration",
          },
          { status: 500 },
        );
      }
    },
  );

  return {
    // === CORE ENDPOINTS ===
    getFeatureFlagsConfig: getFeatureFlagsConfigHandler,
  } as FlagEndpoints;
}
