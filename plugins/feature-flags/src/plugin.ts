// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import type { BetterAuthPlugin } from "better-auth";
import { featureFlagsSchema } from "./schema";
import type { FeatureFlagsOptions } from "./index";
import { createStorageAdapter } from "./storage";
import { createUnifiedMiddleware } from "./middleware/unified";
import {
  createAdminProtectionMiddleware,
  createAuditMiddleware,
  createCacheInvalidationMiddleware,
} from "./middleware/admin";
import { createLifecycleHooks } from "./hooks";
import { createFlagEndpoints } from "./endpoints";
import type { StorageAdapter } from "./storage/types";
import type { PluginContext } from "./types";

/**
 * Initialize the feature flags plugin with options
 */
export function createFeatureFlagsPlugin(
  options: FeatureFlagsOptions = {},
): BetterAuthPlugin {
  // Default configuration
  const config = {
    storage: options.storage || "database",
    analytics: {
      trackUsage: options.analytics?.trackUsage ?? true,
      trackPerformance: options.analytics?.trackPerformance ?? false,
    },
    adminAccess: {
      enabled: options.adminAccess?.enabled ?? true,
      roles: options.adminAccess?.roles || ["admin"],
    },
    multiTenant: {
      enabled: options.multiTenant?.enabled ?? false,
      useOrganizations: options.multiTenant?.useOrganizations ?? false,
    },
    caching: {
      enabled: options.caching?.enabled ?? true,
      ttl: options.caching?.ttl ?? 60, // 60 seconds default
    },
    audit: {
      enabled: options.audit?.enabled ?? false,
      retentionDays: options.audit?.retentionDays ?? 90,
    },
    contextCollection: {
      collectDevice: options.contextCollection?.collectDevice ?? false,
      collectGeo: options.contextCollection?.collectGeo ?? false,
      collectCustomHeaders:
        options.contextCollection?.collectCustomHeaders ?? false,
      collectClientInfo: options.contextCollection?.collectClientInfo ?? false,
      allowedAttributes: options.contextCollection?.allowedAttributes,
    },
    customHeaders: {
      enabled:
        options.customHeaders?.enabled ??
        options.contextCollection?.collectCustomHeaders ??
        false,
      whitelist: options.customHeaders?.whitelist,
      strict: options.customHeaders?.strict ?? false,
      logInvalid: options.customHeaders?.logInvalid ?? false,
    },
    contextValidation: options.contextValidation || {
      maxStringLength: 10240,
      maxObjectDepth: 5,
      maxArrayLength: 100,
      maxTotalSize: 51200,
    },
    flags: options.flags || {},
  };

  // Storage adapter will be initialized in the init hook
  // @important These are null until init() runs, which happens
  // after Better Auth setup but before first request. Always
  // check for null in endpoints/hooks that might run early.
  let storage: StorageAdapter | null = null;
  let pluginContext: PluginContext | null = null;

  return {
    id: "feature-flags",
    schema: featureFlagsSchema,

    init(auth) {
      // Initialize storage adapter
      storage = createStorageAdapter(config.storage, {
        db: (auth as any).db || (auth as any).adapter,
        caching: config.caching,
      });

      // Create plugin context
      pluginContext = {
        auth,
        storage,
        config,
        cache: new Map(), // @memory Unbounded growth risk - consider LRU cache in production
      };

      // Initialize storage (create tables if needed, setup connections)
      storage.initialize?.().catch((error) => {
        console.error("[feature-flags] Failed to initialize storage:", error);
      });

      return {
        // Return any auth extensions if needed
      };
    },

    hooks: {
      before: [
        // Minimal context for all flag endpoints
        ...(pluginContext
          ? [
              {
                matcher: (ctx: any) => ctx.path.startsWith("/api/flags"),
                handler: createUnifiedMiddleware(pluginContext, {
                  mode: "minimal",
                }) as any,
              },
            ]
          : []),

        // Session-enhanced context for session endpoints
        ...(pluginContext
          ? [
              {
                matcher: (ctx: any) => ctx.path === "/session",
                handler: createUnifiedMiddleware(pluginContext, {
                  mode: "session",
                }) as any,
              },
            ]
          : []),

        // Full context for evaluation endpoints
        ...(pluginContext
          ? [
              {
                matcher: (ctx: any) =>
                  ctx.path.startsWith("/api/flags/evaluate"),
                handler: createUnifiedMiddleware(pluginContext, {
                  mode: "full",
                }) as any,
              },
            ]
          : []),

        // Admin access control
        ...(pluginContext
          ? [
              {
                matcher: (ctx: any) => ctx.path.startsWith("/api/admin/flags"),
                handler: createAdminProtectionMiddleware(pluginContext) as any,
              },
            ]
          : []),

        // Add lifecycle hooks if available
        ...(pluginContext
          ? createLifecycleHooks(pluginContext, "before") || []
          : []),
      ],

      after: [
        // Audit logging for flag changes
        ...(pluginContext && config.audit.enabled
          ? [
              {
                matcher: (ctx: any) =>
                  ctx.path.startsWith("/api/admin/flags") ||
                  ctx.path.startsWith("/api/flags/override"),
                handler: createAuditMiddleware(pluginContext) as any,
              },
            ]
          : []),

        // Cache invalidation on flag updates
        ...(pluginContext && config.caching.enabled
          ? [
              {
                matcher: (ctx: any) =>
                  ctx.path.startsWith("/api/admin/flags") &&
                  ["PATCH", "DELETE", "POST"].includes(ctx.method),
                handler: createCacheInvalidationMiddleware(
                  pluginContext,
                ) as any,
              },
            ]
          : []),

        // Add lifecycle hooks if available
        ...(pluginContext
          ? createLifecycleHooks(pluginContext, "after") || []
          : []),
      ],
    },

    endpoints: createFlagEndpoints(pluginContext!),

    rateLimit: [
      {
        window: 60,
        max: 100,
        pathMatcher: (path) => path.startsWith("/api/flags/evaluate"),
      },
      {
        window: 60,
        max: 1000,
        pathMatcher: (path) => path === "/api/flags/evaluate/batch",
      },
      {
        window: 60,
        max: 20,
        pathMatcher: (path) => path.startsWith("/api/admin/flags"),
      },
    ],

    $ERROR_CODES: {
      FLAG_NOT_FOUND: "Feature flag not found",
      INVALID_FLAG_TYPE: "Invalid flag type",
      EVALUATION_ERROR: "Failed to evaluate flag",
      STORAGE_ERROR: "Storage operation failed",
      UNAUTHORIZED_ACCESS: "Not authorized to access this flag",
      INVALID_CONTEXT: "Invalid evaluation context",
      QUOTA_EXCEEDED: "Flag evaluation quota exceeded",
    },
  };
}
