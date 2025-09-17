// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import { z } from "zod";

/**
 * Schema helpers for common environment variable patterns
 */
const bool = () => z.stringbool().optional().default(false); // Boolean with false default
const num = (defaultValue?: number) => {
  // Number with optional default
  const base = z.coerce.number();
  return defaultValue === undefined
    ? base.optional()
    : base.default(defaultValue);
};
const str = () => z.string().optional(); // Optional string
const duration = (defaultMs: number) => num(defaultMs); // Duration in milliseconds

// Plugin configuration
const PLUGINS = [
  "storage",
  "featureFlags",
  "organizations",
  "connect",
  "analytics",
  "auditLog",
  "rateLimit",
  "webhooks",
  "notifications",
  "impersonation",
  "mcp",
  "consent",
  "onboarding",
  "sessionManagement",
  "subscription",
  "backupCodes",
  "fraudDetection",
  "abuseDetection",
  "compliance",
] as const;

const toEnvKey = (plugin: string) =>
  `BETTER_AUTH_${plugin.replace(/[A-Z]/g, (m) => `_${m}`).toUpperCase()}`;

const pluginSchemas = Object.fromEntries(
  PLUGINS.map((p) => [toEnvKey(p), bool()]),
);

// OAuth providers
const OAUTH_PROVIDERS = [
  "GOOGLE",
  "GOOGLE_DRIVE",
  "GMAIL",
  "GITHUB",
  "ONEDRIVE",
  "DROPBOX",
  "SLACK",
  "NOTION",
] as const;

const oauthSchemas = Object.fromEntries(
  OAUTH_PROVIDERS.flatMap((p) => [
    [`${p}_CLIENT_ID`, str()],
    [`${p}_CLIENT_SECRET`, str()],
  ]),
);

/**
 * Environment variable schema with validation
 *
 * Environment variables can be set in:
 * - .env file in monorepo root
 * - .env.local file in monorepo root (git-ignored)
 * - System environment variables
 */
export const envSchema = z
  .object({
    // Node environment
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),

    // Database
    DATABASE_URL: z.url(),

    // Core Better Auth
    BETTER_AUTH_SECRET: z
      .string()
      .min(32, "Secret must be at least 32 characters"),
    BETTER_AUTH_TELEMETRY: bool(),

    // Storage Plugin Configuration
    STORAGE_SYNC_INTERVAL: duration(60),
    STORAGE_SYNC_BATCH_SIZE: num(10),
    STORAGE_ALLOWED_TYPES: str(),
    STORAGE_MAX_SIZE_PER_USER: num(100 * 1024 * 1024),
    STORAGE_MAX_FILE_SIZE: num(10 * 1024 * 1024),
    STORAGE_ENABLE_WEBHOOKS: bool(),

    // Feature Flags Plugin Configuration
    FEATURE_FLAGS_STORAGE: z
      .enum(["memory", "database", "redis"])
      .default("database"),
    FEATURE_FLAGS_CACHE_ENABLED: bool(),
    FEATURE_FLAGS_CACHE_TTL: duration(60),
    FEATURE_FLAGS_TRACK_USAGE: bool(),
    FEATURE_FLAGS_TRACK_PERFORMANCE: bool(),
    FEATURE_FLAGS_ADMIN_ENABLED: bool(),
    FEATURE_FLAGS_ADMIN_ROLES: str(),
    FEATURE_FLAGS_MULTI_TENANT: bool(),
    FEATURE_FLAGS_USE_ORGANIZATIONS: bool(),
    FEATURE_FLAGS_AUDIT_ENABLED: bool(),
    FEATURE_FLAGS_AUDIT_RETENTION_DAYS: num(90),
    FEATURE_FLAGS_CUSTOM_HEADERS: bool(),
    FEATURE_FLAGS_HEADERS_STRICT: bool(),

    // Organizations Plugin Configuration
    ORG_ALLOW_USER_CREATE: bool(),
    ORG_LIMIT: num(),
    ORG_MEMBERSHIP_LIMIT: num(100),
    ORG_CREATOR_ROLE: z.string().default("owner"),
    ORG_TEAMS_ENABLED: bool(),
    ORG_DEFAULT_TEAM_ENABLED: bool(),
    ORG_MAX_TEAMS: num(),
    ORG_MAX_MEMBERS_PER_TEAM: num(),
    ORG_ALLOW_REMOVING_ALL_TEAMS: bool(),
    ORG_INVITATION_EXPIRES_IN: duration(48 * 60 * 60 * 1000),
    ORG_INVITATION_LIMIT: num(100),
    ORG_CANCEL_PENDING_ON_REINVITE: bool(),
    ORG_REQUIRE_EMAIL_VERIFICATION: bool(),
    ORG_SEND_INVITATION_EMAIL: bool(),
    ORG_CREATION_DISABLED: bool(),
    ORG_DELETION_DISABLED: bool(),
    ORG_AUTO_CREATE_ON_SIGNUP: bool(),

    // Connect Plugin Configuration
    CONNECT_SYNC_INTERVAL: duration(300),
    CONNECT_MAX_SYNC_SIZE: num(100 * 1024 * 1024),
    CONNECT_WEBHOOK_SECRET: str(),

    // Application Settings
    APP_URL: z.url().default("http://localhost:5173"),
    PORT: num(5173),
  })
  .extend(pluginSchemas)
  .extend(oauthSchemas);

/**
 * Type for validated environment variables
 *
 * Note: Environment variables are now validated and provided via
 * the context middleware using c.env from Hono
 */

/**
 * Type-safe environment variable access
 */
export type Env = z.infer<typeof envSchema>;

/**
 * Helper to check if a plugin is enabled based on environment variables
 * This is now used by the context middleware with validated env
 */
export function getPluginStatus(
  env: Env,
): Record<(typeof PLUGINS)[number], boolean> {
  return Object.fromEntries(
    PLUGINS.map((name) => [name, Boolean(env[toEnvKey(name) as keyof Env])]),
  ) as Record<(typeof PLUGINS)[number], boolean>;
}
