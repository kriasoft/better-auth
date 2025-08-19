// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import { createAuthMiddleware } from "better-auth/plugins";
import type { PluginContext } from "../types";
import type { BeforeHooks, AfterHooks } from "./types";

/**
 * Create lifecycle hooks for the feature flags plugin with proper typing
 */
export function createLifecycleHooks(
  pluginContext: PluginContext,
  type: "before",
): BeforeHooks;
export function createLifecycleHooks(
  pluginContext: PluginContext,
  type: "after",
): AfterHooks;
export function createLifecycleHooks(
  pluginContext: PluginContext,
  type: "before" | "after",
): BeforeHooks | AfterHooks {
  if (type === "before") {
    return createBeforeHooks(pluginContext);
  } else {
    return createAfterHooks(pluginContext);
  }
}

/**
 * Create before hooks that run before request processing
 */
function createBeforeHooks(pluginContext: PluginContext): BeforeHooks {
  const hooks: BeforeHooks = [];

  // Rate limiting validation for evaluation endpoints
  hooks.push({
    matcher: (ctx) => ctx.path.startsWith("/api/flags/evaluate"),
    handler: createAuthMiddleware(async (ctx: any) => {
      // Validate request format
      if (ctx.method === "POST" && !ctx.body) {
        throw new Error("Request body is required");
      }
      return;
    }),
  });

  // Permission checking for admin endpoints
  if (pluginContext.config.adminAccess.enabled) {
    hooks.push({
      matcher: (ctx) => ctx.path.startsWith("/api/admin/flags"),
      handler: createAuthMiddleware(async (ctx: any) => {
        // @security Double-check pattern: First check happens in plugin.ts
        // This is defense-in-depth for admin operations
        const session = await ctx.getSession?.();

        // Check for specific admin permissions if needed
        if (session?.user?.permissions) {
          const hasPermission = session.user.permissions.includes(
            "feature_flags:admin",
          );
          if (
            !hasPermission &&
            !session.user.permissions.includes("admin:all")
          ) {
            throw new Error("Missing feature flags admin permission");
          }
        }

        // Log admin access attempt
        if (pluginContext.config.audit.enabled) {
          await pluginContext.storage
            .logAudit({
              userId: session?.user?.id || "anonymous",
              action: "admin_access",
              metadata: {
                path: ctx.path,
                method: ctx.method,
                timestamp: new Date().toISOString(),
              },
            })
            .catch((err) => {
              console.error("[feature-flags] Failed to log admin access:", err);
            });
        }

        return;
      }),
    });
  }

  // Request validation for flag operations
  hooks.push({
    matcher: (ctx) =>
      ctx.path.startsWith("/api/admin/flags") &&
      (ctx.method === "POST" || ctx.method === "PATCH"),
    handler: createAuthMiddleware(async (ctx: any) => {
      const body = ctx.body;

      if (!body) {
        throw new Error("Request body is required");
      }

      // Validate flag data
      if (ctx.method === "POST") {
        if (!body.key) {
          throw new Error("Flag key is required");
        }
        if (!body.type) {
          throw new Error("Flag type is required");
        }
        if (!["boolean", "string", "number", "json"].includes(body.type)) {
          throw new Error(`Invalid flag type: ${body.type}`);
        }
      }

      // Validate variants if provided
      if (body.variants) {
        if (typeof body.variants !== "object") {
          throw new Error("Variants must be an object");
        }
        if (Object.keys(body.variants).length === 0) {
          throw new Error("Variants object cannot be empty");
        }
      }

      // Validate rollout percentage
      if (body.rolloutPercentage !== undefined) {
        const percentage = Number(body.rolloutPercentage);
        if (isNaN(percentage) || percentage < 0 || percentage > 100) {
          throw new Error("Rollout percentage must be between 0 and 100");
        }
      }

      return;
    }),
  });

  return hooks;
}

/**
 * Create after hooks that run after request processing
 */
function createAfterHooks(pluginContext: PluginContext): AfterHooks {
  const hooks: AfterHooks = [];

  // Performance tracking for evaluations
  if (pluginContext.config.analytics.trackPerformance) {
    hooks.push({
      matcher: (ctx) => ctx.path.startsWith("/api/flags/evaluate"),
      handler: createAuthMiddleware(async (ctx: any) => {
        // Track evaluation performance
        const startTime = (ctx as any).startTime || Date.now();
        const duration = Date.now() - startTime;

        // Log slow evaluations
        if (duration > 100) {
          console.warn(
            `[feature-flags] Slow evaluation: ${duration}ms for ${ctx.path}`,
          );
        }

        // Store performance metrics
        if ((ctx as any).response?.ok) {
          const metrics = {
            path: ctx.path,
            duration,
            timestamp: new Date(),
            userId: (ctx as any).session?.user?.id || "anonymous",
          };

          // In production, send to monitoring service
          if (process.env.NODE_ENV === "development") {
            console.debug("[feature-flags] Performance:", metrics);
          }
        }

        return;
      }),
    });
  }

  // Cache warming for frequently accessed flags
  hooks.push({
    matcher: (ctx) => ctx.path === "/api/admin/flags" && ctx.method === "GET",
    handler: createAuthMiddleware(async (ctx: any) => {
      // Warm cache with frequently accessed flags
      if (pluginContext.config.caching.enabled && (ctx as any).response?.ok) {
        const flags = (ctx as any).response.body?.flags || [];

        // Cache top flags (those with high evaluation count)
        // @performance Threshold of 1000 evaluations is arbitrary
        // Adjust based on your traffic patterns. Too low = cache thrashing,
        // too high = cold cache for most flags
        const topFlags = flags
          .filter((f: any) => f.evaluationCount > 1000)
          .slice(0, 10);

        for (const flag of topFlags) {
          const cacheKey = `flag:${flag.key}`;
          pluginContext.cache.set(cacheKey, {
            value: flag,
            variant: undefined,
            reason: "cached",
            timestamp: Date.now(),
            ttl: pluginContext.config.caching.ttl,
          });
        }
      }

      return;
    }),
  });

  // Cleanup old data periodically
  hooks.push({
    matcher: (ctx) => ctx.path === "/api/admin/flags/cleanup",
    handler: createAuthMiddleware(async (ctx: any) => {
      if (!pluginContext.config.audit.enabled) {
        return;
      }

      // Clean up old audit logs
      const retentionDate = new Date();
      retentionDate.setDate(
        retentionDate.getDate() - pluginContext.config.audit.retentionDays,
      );

      try {
        const deletedCount =
          await pluginContext.storage.cleanupAuditLogs(retentionDate);
        console.log(
          `[feature-flags] Cleaned up ${deletedCount} old audit logs`,
        );
      } catch (error) {
        console.error("[feature-flags] Failed to cleanup audit logs:", error);
      }

      return;
    }),
  });

  // Real-time updates notification (preparation for WebSocket support)
  hooks.push({
    matcher: (ctx) =>
      ctx.path.startsWith("/api/admin/flags") &&
      (ctx.method === "PATCH" || ctx.method === "DELETE"),
    handler: createAuthMiddleware(async (ctx: any) => {
      if (!(ctx as any).response?.ok) {
        return;
      }

      // Prepare for real-time updates (WebSocket implementation in phase 2)
      const flagKey = (ctx as any).params?.key || ctx.body?.key;
      if (flagKey) {
        // In the future, broadcast update via WebSocket
        const updateEvent = {
          type: ctx.method === "DELETE" ? "flag_deleted" : "flag_updated",
          flagKey,
          timestamp: new Date(),
          userId: (ctx as any).session?.user?.id,
        };

        // For now, just log the event
        if (process.env.NODE_ENV === "development") {
          console.debug("[feature-flags] Flag update event:", updateEvent);
        }
      }

      return;
    }),
  });

  return hooks;
}

/**
 * Create initialization hook for plugin setup
 */
export async function createInitHook(
  pluginContext: PluginContext,
): Promise<void> {
  const { storage, config } = pluginContext;

  // Initialize storage
  if (storage.initialize) {
    await storage.initialize();
  }

  // Load static flags from configuration
  if (config.flags && Object.keys(config.flags).length > 0) {
    await loadStaticFlags(pluginContext);
  }

  // Set up periodic cleanup if audit is enabled
  if (config.audit.enabled) {
    setupPeriodicCleanup(pluginContext);
  }

  console.log("[feature-flags] Plugin initialized successfully");
}

/**
 * Load static flags from configuration
 */
async function loadStaticFlags(pluginContext: PluginContext): Promise<void> {
  const { storage, config } = pluginContext;

  for (const [key, flagConfig] of Object.entries(config.flags)) {
    try {
      // Check if flag already exists
      const existingFlag = await storage.getFlag(key);
      if (existingFlag) {
        continue; // Don't overwrite existing flags
      }

      // Create new flag from config
      await storage.createFlag({
        key,
        name: key,
        description: `Static flag from configuration`,
        type:
          typeof flagConfig.default === "boolean"
            ? "boolean"
            : typeof flagConfig.default === "number"
              ? "number"
              : typeof flagConfig.default === "string"
                ? "string"
                : "json",
        enabled: flagConfig.enabled ?? true,
        defaultValue: flagConfig.default,
        rolloutPercentage: flagConfig.rollout,
        variants: flagConfig.variants,
      });

      console.log(`[feature-flags] Loaded static flag: ${key}`);
    } catch (error) {
      console.error(
        `[feature-flags] Failed to load static flag ${key}:`,
        error,
      );
    }
  }
}

/**
 * Set up periodic cleanup of old data
 *
 * @important Memory consideration: setInterval holds reference
 * to pluginContext, preventing garbage collection. In production,
 * consider using external cron job or job queue instead.
 *
 * @note Cleanup runs daily at fixed interval from plugin init,
 * not at specific time of day. May cause slight data retention
 * variance (23-25 hours) depending on restart timing.
 */
function setupPeriodicCleanup(pluginContext: PluginContext): void {
  const { storage, config } = pluginContext;

  // Run cleanup daily
  const cleanupInterval = 24 * 60 * 60 * 1000; // 24 hours

  setInterval(async () => {
    const retentionDate = new Date();
    retentionDate.setDate(retentionDate.getDate() - config.audit.retentionDays);

    try {
      const deletedCount = await storage.cleanupAuditLogs(retentionDate);
      console.log(
        `[feature-flags] Periodic cleanup: removed ${deletedCount} old audit logs`,
      );
    } catch (error) {
      console.error("[feature-flags] Periodic cleanup failed:", error);
    }
  }, cleanupInterval);
}
