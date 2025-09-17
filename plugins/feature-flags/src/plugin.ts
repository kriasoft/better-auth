// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import type { BetterAuthPlugin } from "better-auth";
import { createFlagEndpoints } from "./endpoints";
import { LRUCache } from "./lru-cache";
import {
  createAdminProtectionMiddleware,
  createAuditMiddleware,
  createCacheInvalidationMiddleware,
} from "./middleware/admin";
import { createUnifiedMiddleware } from "./middleware/unified";
import { featureFlagsSchema } from "./schema";
import { createStorageAdapter } from "./storage";
import type { StorageAdapter } from "./storage/types";
import type { FeatureFlagsOptions, PluginContext } from "./types";

/** Creates Better Auth plugin for feature flags with full configuration */
export function createFeatureFlagsPlugin(options: FeatureFlagsOptions = {}) {
  // Plugin configuration with defaults
  const config = {
    storage: options.storage || "database",
    debug: options.debug ?? false,
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
      maxSize: options.caching?.maxSize ?? 1000, // 1000 entries default
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

  // Lazy initialization: components created in init() hook
  // IMPORTANT: null until Better Auth calls init(), check in endpoints
  let storage: StorageAdapter | null = null;
  let pluginContext: PluginContext | null = null;

  // Static endpoints must be present at plugin construction time. We use a
  // lazy proxy that resolves to the real plugin context after init(). This
  // avoids route-registration timing issues in Better Auth.
  const getPluginContext = (): PluginContext => {
    if (!pluginContext) {
      throw new Error(
        "[feature-flags] Plugin context not initialized yet. Make sure auth.init() has run before calling endpoints.",
      );
    }
    return pluginContext;
  };

  const lazyPluginContext = new Proxy({} as PluginContext, {
    get(_target, prop: string) {
      const ctx = getPluginContext();
      return (ctx as any)[prop];
    },
  });

  // Build endpoints once with lazy context so they are always present
  const staticEndpoints = createFlagEndpoints(lazyPluginContext);

  // Middleware instances cached for performance
  let minimalMiddleware: any = null;
  let sessionMiddleware: any = null;
  let fullMiddleware: any = null;
  let adminMiddleware: any = null;
  let auditMiddleware: any = null;
  let cacheInvalidationMiddleware: any = null;

  return {
    id: "feature-flags",
    schema: featureFlagsSchema,

    init(auth) {
      // Setup storage adapter with DB connection
      storage = createStorageAdapter(config.storage, {
        db: (auth as any).db || (auth as any).adapter,
        caching: config.caching,
      });

      // Plugin context with secure cache
      pluginContext = {
        auth,
        storage,
        config,
        cache: new LRUCache({
          maxSize: config.caching.maxSize || 1000,
          defaultTTL: (config.caching.ttl || 60) * 1000, // seconds → ms
        }),
      };

      // Pre-create middleware for performance
      minimalMiddleware = createUnifiedMiddleware(pluginContext, {
        mode: "minimal",
      });
      sessionMiddleware = createUnifiedMiddleware(pluginContext, {
        mode: "session",
      });
      fullMiddleware = createUnifiedMiddleware(pluginContext, { mode: "full" });
      adminMiddleware = createAdminProtectionMiddleware(pluginContext);
      auditMiddleware = createAuditMiddleware(pluginContext);
      cacheInvalidationMiddleware =
        createCacheInvalidationMiddleware(pluginContext);

      // Async storage setup (tables, connections)
      storage.initialize?.().catch((error) => {
        console.error("[feature-flags] Failed to initialize storage:", error);
      });

      return {
        // Auth extensions if needed
      };
    },

    get hooks() {
      // Guard against pre-initialization access
      if (!pluginContext || !minimalMiddleware) {
        console.warn(
          "[feature-flags] Hooks accessed before plugin initialization. Middleware will not be available until after init().",
        );
        return {
          before: [],
          after: [],
        };
      }

      return {
        before: [
          // Base context for all flag endpoints
          {
            matcher: (ctx: any) => ctx.path.startsWith("/feature-flags"),
            handler: async (ctx: any) => {
              if (!minimalMiddleware) {
                console.warn(
                  "[feature-flags] Minimal middleware not initialized",
                );
                return;
              }
              return minimalMiddleware(ctx);
            },
          },

          // Session context for user-specific flags
          {
            matcher: (ctx: any) => ctx.path === "/session",
            handler: async (ctx: any) => {
              if (!sessionMiddleware) {
                console.warn(
                  "[feature-flags] Session middleware not initialized",
                );
                return;
              }
              return sessionMiddleware(ctx);
            },
          },

          // Rich context for flag evaluation
          {
            matcher: (ctx: any) =>
              ctx.path.startsWith("/feature-flags/evaluate"),
            handler: async (ctx: any) => {
              if (!fullMiddleware) {
                console.warn("[feature-flags] Full middleware not initialized");
                return;
              }
              return fullMiddleware(ctx);
            },
          },

          // Admin access control
          {
            matcher: (ctx: any) => ctx.path.startsWith("/feature-flags/admin"),
            handler: async (ctx: any) => {
              if (!adminMiddleware) {
                console.warn(
                  "[feature-flags] Admin middleware not initialized",
                );
                return;
              }
              return adminMiddleware(ctx);
            },
          },
        ],

        after: [
          // Audit trail for admin actions
          {
            matcher: (ctx: any) => ctx.path.startsWith("/feature-flags/admin"),
            handler: async (ctx: any) => {
              if (!auditMiddleware || !config.audit.enabled) return;
              return auditMiddleware(ctx);
            },
          },

          // Cache invalidation on flag mutations
          {
            matcher: (ctx: any) =>
              ctx.path.startsWith("/feature-flags/admin") &&
              ["PATCH", "DELETE", "POST"].includes(ctx.method),
            handler: async (ctx: any) => {
              if (!cacheInvalidationMiddleware || !config.caching.enabled)
                return;
              return cacheInvalidationMiddleware(ctx);
            },
          },
        ],
      };
    },

    // Expose static endpoints object (handlers resolve context lazily)
    endpoints: staticEndpoints,

    rateLimit: [
      {
        window: 60,
        max: 100, // Individual flag evaluations
        pathMatcher: (path) => path.startsWith("/feature-flags/evaluate"),
      },
      {
        window: 60,
        max: 1000, // Batch evaluations (higher limit)
        pathMatcher: (path) => path === "/feature-flags/evaluate-batch",
      },
      {
        window: 60,
        max: 20, // Admin operations (strict limit)
        pathMatcher: (path) => path.startsWith("/feature-flags/admin"),
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
      INVALID_INPUT: "Invalid input data",
      ADMIN_ACCESS_DISABLED: "Admin access is disabled",
      ORGANIZATION_REQUIRED: "Organization ID is required",
    },
  } satisfies BetterAuthPlugin;
}

// Useful for client-side typing without importing from index.ts
export type FeatureFlagsServerPlugin = ReturnType<
  typeof createFeatureFlagsPlugin
>;
