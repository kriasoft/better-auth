// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import type { FeatureFlagsOptions } from "better-auth-feature-flags";
import { featureFlags } from "better-auth-feature-flags";
import type { Env } from "../env";
import { getPluginStatus } from "../env";

/**
 * Feature Flags Plugin Configuration
 *
 * Provides comprehensive feature flag management with:
 * - Multiple storage backends (memory, database, redis)
 * - Advanced targeting and segmentation
 * - Percentage-based rollouts
 * - A/B testing with variants
 * - Real-time evaluation and caching
 * - Audit logging and analytics
 * - Multi-tenancy support
 */
export function getFeatureFlagsPlugin(
  env: Env,
): ReturnType<typeof featureFlags> | null {
  const pluginStatus = getPluginStatus(env);

  // Check if feature flags are enabled
  if (!pluginStatus.featureFlags) {
    return null;
  }

  const config: FeatureFlagsOptions = {
    // Storage configuration
    storage: env.FEATURE_FLAGS_STORAGE,

    // Caching configuration for performance
    caching: {
      enabled: env.FEATURE_FLAGS_CACHE_ENABLED,
      ttl: env.FEATURE_FLAGS_CACHE_TTL, // seconds
    },

    // Analytics tracking
    analytics: {
      trackUsage: env.FEATURE_FLAGS_TRACK_USAGE,
      trackPerformance: env.FEATURE_FLAGS_TRACK_PERFORMANCE,
    },

    // Admin access control
    adminAccess: {
      enabled: env.FEATURE_FLAGS_ADMIN_ENABLED,
      roles: env.FEATURE_FLAGS_ADMIN_ROLES?.split(",") || ["admin", "owner"],
    },

    // Multi-tenant configuration
    multiTenant: {
      enabled: env.FEATURE_FLAGS_MULTI_TENANT,
      useOrganizations: env.FEATURE_FLAGS_USE_ORGANIZATIONS,
    },

    // Audit configuration
    audit: {
      enabled: env.FEATURE_FLAGS_AUDIT_ENABLED,
      retentionDays: env.FEATURE_FLAGS_AUDIT_RETENTION_DAYS,
    },

    // Context collection configuration
    contextCollection: {
      // Configure what context data to collect for flag evaluation
      // Add properties based on the actual ContextCollectionOptions interface
    },

    // Custom headers configuration
    customHeaders: {
      enabled: env.FEATURE_FLAGS_CUSTOM_HEADERS,
      strict: env.FEATURE_FLAGS_HEADERS_STRICT,
      logInvalid: env.NODE_ENV === "development",
    },

    // Context validation
    contextValidation: {
      // Configure validation rules based on the actual ValidationConfig interface
    },

    // Default flags configuration (can be overridden in database)
    flags:
      env.NODE_ENV === "development"
        ? {
            "new-ui": {
              enabled: true,
              default: false,
              rollout: 10, // 10% rollout
              targeting: {
                roles: ["beta-tester", "admin"],
              },
            },
            "enhanced-security": {
              enabled: true,
              default: true,
            },
            "experimental-features": {
              enabled: true,
              default: false,
              targeting: {
                roles: ["admin"],
              },
            },
          }
        : {},
  };

  return featureFlags(config);
}
