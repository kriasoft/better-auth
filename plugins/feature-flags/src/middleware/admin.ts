// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import { createAuthMiddleware } from "better-auth/plugins";
import type {} from "../augmentation"; // Import type augmentations for Better Auth context extensions (types-only)
import type { PluginContext } from "../types";

/**
 * Creates middleware to protect admin endpoints with role-based access control.
 *
 * @param pluginContext - Plugin configuration and storage context
 * @returns Better-call middleware with admin protection
 * @throws {Response} 401/403 for auth failures or insufficient permissions
 * @see src/types.ts for admin access configuration
 */
export function createAdminProtectionMiddleware(pluginContext: PluginContext) {
  return createAuthMiddleware(async (ctx: any) => {
    const { config } = pluginContext;

    // SECURITY: Global admin access toggle - first line of defense
    if (!config.adminAccess.enabled) {
      return ctx.json(
        {
          error: "ADMIN_ACCESS_DISABLED",
          message: "Admin access is disabled",
        },
        { status: 403 },
      );
    }

    // Fallback session retrieval for different Better Auth integrations
    // REF: https://better-auth.com/docs/concepts/session-management
    const getSession = ctx.getSession || ctx.auth?.getSession;
    const session = ctx.session || (getSession ? await getSession() : null);

    if (!session?.user) {
      return ctx.json(
        {
          error: "UNAUTHORIZED_ACCESS",
          message: "Authentication required",
        },
        { status: 401 },
      );
    }

    // SECURITY: Role-based authorization - empty roles array = no restrictions
    const userRoles = session.user.roles || [];
    const hasAdminRole = config.adminAccess.roles.some((role: string) =>
      userRoles.includes(role),
    );

    if (!hasAdminRole) {
      return ctx.json(
        {
          error: "UNAUTHORIZED_ACCESS",
          message: "Admin role required",
        },
        { status: 403 },
      );
    }

    // Inject validated admin context for downstream middleware
    return {
      admin: {
        userId: session.user.id,
        roles: userRoles,
        isAdmin: true,
      },
    };
  });
}

/**
 * Creates middleware for audit logging of admin actions.
 *
 * @param pluginContext - Plugin configuration and storage context
 * @returns Better-call middleware that logs admin actions
 * @see src/storage/types.ts for audit entry structure
 * @see src/schema/tables.ts for audit table schema
 */
export function createAuditMiddleware(pluginContext: PluginContext) {
  return createAuthMiddleware(async (ctx: any) => {
    const { config, storage } = pluginContext;

    // Early exit if audit disabled - reduces performance overhead
    if (!config.audit.enabled) {
      return {};
    }

    // Same session retrieval pattern as admin protection middleware
    const getSession = ctx.getSession || ctx.auth?.getSession;
    const session = ctx.session || (getSession ? await getSession() : null);

    // Map HTTP methods to semantic action types for audit trail
    const action =
      ctx.method === "POST"
        ? "create"
        : ctx.method === "PATCH"
          ? "update"
          : ctx.method === "DELETE"
            ? "delete"
            : "read";

    // Extract flag identifier from URL params or request body
    // Prioritize flagId for admin endpoints, fallback to flagKey
    const flagId = ctx.params?.id || ctx.body?.flagId;
    const flagKey = ctx.params?.key || ctx.body?.key;

    // Extract organization ID for multi-tenant scoping
    const organizationId =
      ctx.params?.organizationId ||
      ctx.body?.organizationId ||
      ctx.session?.user?.organizationId;

    // SECURITY: Extract real client IP - handles nginx/Cloudflare/AWS ALB proxies
    const ip =
      ctx.headers?.get?.("x-forwarded-for") ||
      ctx.headers?.get?.("x-real-ip") ||
      ctx.headers?.get?.("cf-connecting-ip") ||
      ctx.request?.ip ||
      "unknown";

    // PERF: Async fire-and-forget logging - audit failures don't block requests
    await storage
      .logAudit({
        userId: session?.user?.id || "anonymous",
        action,
        flagKey,
        flagId,
        organizationId,
        metadata: {
          path: ctx.path,
          method: ctx.method,
          ip: ip.split(",")[0].trim(), // First IP from comma-separated list
          userAgent: ctx.headers?.get?.("user-agent"),
          timestamp: new Date().toISOString(),
          // Include both identifiers in metadata for debugging
          extractedFlagId: flagId,
          extractedFlagKey: flagKey,
          extractedOrgId: organizationId,
        },
      })
      .catch((error) => {
        // Log audit failures but don't throw - maintains API availability
        console.error("[feature-flags] Failed to log audit:", error);
      });

    return {};
  });
}

/**
 * Creates middleware for cache invalidation on flag mutations.
 *
 * @param pluginContext - Plugin configuration and storage context with cache instance
 * @returns Better-call middleware that invalidates cache on mutations
 * @see src/lru-cache.ts for cache implementation
 * @see src/types.ts for caching configuration
 */
export function createCacheInvalidationMiddleware(
  pluginContext: PluginContext,
) {
  return createAuthMiddleware(async (ctx: any) => {
    const { cache, config } = pluginContext;

    // Early exit if caching disabled or unavailable (serverless environments)
    if (!config.caching.enabled || !cache) {
      return {};
    }

    // PERF: Only invalidate on mutations - GET requests don't modify flags
    if (!["PATCH", "DELETE", "POST"].includes(ctx.method)) {
      return {};
    }

    // Extract flag identifier - same pattern as audit middleware
    const flagId = ctx.params?.id || ctx.body?.flagId;
    const flagKey = ctx.params?.key || ctx.body?.key;
    const organizationId =
      ctx.params?.organizationId ||
      ctx.body?.organizationId ||
      ctx.session?.user?.organizationId;

    // Invalidate cache for the modified flag
    if (flagKey) {
      // Direct flag key invalidation
      const clearedCount = cache.invalidateByFlag(flagKey);
      if (clearedCount > 0) {
        console.log(
          `[feature-flags] Cleared ${clearedCount} cache entries for flag: ${flagKey}`,
        );
      }
    } else if (flagId) {
      // Lookup flagKey from flagId for selective cache invalidation
      try {
        const flag = await pluginContext.storage.getFlagById(flagId);
        if (flag) {
          const clearedCount = cache.invalidateByFlag(flag.key);
          if (clearedCount > 0) {
            console.log(
              `[feature-flags] Cleared ${clearedCount} cache entries for flag: ${flag.key} (ID: ${flagId})`,
            );
          }
        } else {
          console.log(
            `[feature-flags] Flag with ID ${flagId} not found, skipping cache invalidation`,
          );
        }
      } catch (error) {
        console.error(
          `[feature-flags] Failed to lookup flag by ID ${flagId}:`,
          error,
        );
        // Fall back to clearing all cache to ensure consistency
        cache.clear();
        console.log(
          `[feature-flags] Cleared entire cache due to lookup failure`,
        );
      }
    }

    return {};
  });
}
