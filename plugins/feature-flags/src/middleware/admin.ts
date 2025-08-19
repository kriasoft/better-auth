// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import "../augmentation"; // Import type augmentations
import { createMiddleware } from "better-call";
import type { PluginContext } from "../types";

/**
 * Admin protection middleware for securing admin endpoints
 */
export function createAdminProtectionMiddleware(pluginContext: PluginContext) {
  return createMiddleware(async (ctx: any) => {
    const { config } = pluginContext;

    // Check if admin access is enabled
    if (!config.adminAccess.enabled) {
      throw new Error("Admin access is disabled");
    }

    // Get session (type-safe access)
    const getSession = ctx.getSession || ctx.auth?.getSession;
    const session = ctx.session || (getSession ? await getSession() : null);

    if (!session?.user) {
      throw new Error("Unauthorized: No active session");
    }

    // Check if user has required admin role
    const userRoles = session.user.roles || [];
    const hasAdminRole = config.adminAccess.roles.some((role: string) =>
      userRoles.includes(role),
    );

    if (!hasAdminRole) {
      throw new Error("Insufficient permissions: Admin role required");
    }

    // Add admin context for downstream use
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
 * Audit logging middleware for tracking admin actions
 */
export function createAuditMiddleware(pluginContext: PluginContext) {
  return createMiddleware(async (ctx: any) => {
    const { config, storage } = pluginContext;

    if (!config.audit.enabled) {
      return {};
    }

    // Get session
    const getSession = ctx.getSession || ctx.auth?.getSession;
    const session = ctx.session || (getSession ? await getSession() : null);

    // Determine action type
    const action =
      ctx.method === "POST"
        ? "create"
        : ctx.method === "PATCH"
          ? "update"
          : ctx.method === "DELETE"
            ? "delete"
            : "read";

    // Extract flag key from params or body
    const flagKey = ctx.params?.key || ctx.body?.key;

    // Get client IP
    const ip =
      ctx.headers?.get?.("x-forwarded-for") ||
      ctx.headers?.get?.("x-real-ip") ||
      ctx.headers?.get?.("cf-connecting-ip") ||
      ctx.request?.ip ||
      "unknown";

    // Log the audit entry
    await storage
      .logAudit({
        userId: session?.user?.id || "anonymous",
        action,
        flagKey,
        metadata: {
          path: ctx.path,
          method: ctx.method,
          ip: ip.split(",")[0].trim(),
          userAgent: ctx.headers?.get?.("user-agent"),
          timestamp: new Date().toISOString(),
        },
      })
      .catch((error) => {
        console.error("[feature-flags] Failed to log audit:", error);
      });

    return {};
  });
}

/**
 * Cache invalidation middleware for flag updates
 */
export function createCacheInvalidationMiddleware(
  pluginContext: PluginContext,
) {
  return createMiddleware(async (ctx: any) => {
    const { cache, config } = pluginContext;

    if (!config.caching.enabled || !cache) {
      return {};
    }

    // Only invalidate on mutations
    if (!["PATCH", "DELETE", "POST"].includes(ctx.method)) {
      return {};
    }

    // Extract flag key
    const flagKey = ctx.params?.key || ctx.body?.key;

    if (flagKey) {
      // Clear all cache entries for this flag
      let clearedCount = 0;
      for (const key of cache.keys()) {
        if (key.includes(flagKey)) {
          cache.delete(key);
          clearedCount++;
        }
      }

      if (clearedCount > 0) {
        console.log(
          `[feature-flags] Cleared ${clearedCount} cache entries for flag: ${flagKey}`,
        );
      }
    }

    return {};
  });
}
