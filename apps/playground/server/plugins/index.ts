// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import type { BetterAuthPlugin } from "better-auth";
import type { Env } from "../env";
import { getPluginStatus } from "../env";
import { getFeatureFlagsPlugin } from "./feature-flags";
import { getOrganizationsPlugin } from "./organizations";
import { getConnectPlugin } from "./connect";
import { getStoragePlugin } from "./storage";

/**
 * Plugin Registry
 *
 * Central location for all Better Auth plugin configurations.
 * Each plugin is conditionally loaded based on environment variables.
 */

export interface PluginConfig {
  name: string;
  enabled: boolean;
  plugin: BetterAuthPlugin | null;
}

/**
 * Get all enabled plugins for Better Auth based on environment configuration
 *
 * @param env - Validated environment variables
 * @returns Array of enabled Better Auth plugins
 */
export function getEnabledPlugins(env: Env): BetterAuthPlugin[] {
  const pluginStatus = getPluginStatus(env);
  const plugins: (BetterAuthPlugin | null)[] = [];

  // Only initialize plugins that are enabled
  if (pluginStatus.storage) {
    plugins.push(getStoragePlugin(env));
  }
  if (pluginStatus.featureFlags) {
    plugins.push(getFeatureFlagsPlugin(env));
  }
  if (pluginStatus.organizations) {
    plugins.push(getOrganizationsPlugin(env));
  }
  if (pluginStatus.connect) {
    plugins.push(getConnectPlugin(env));
  }
  // Add more plugins here as needed
  // if (pluginStatus.analytics) plugins.push(getAnalyticsPlugin());
  // if (pluginStatus.auditLog) plugins.push(getAuditLogPlugin());
  // etc.

  // Filter out null/disabled plugins (shouldn't be any at this point)
  return plugins.filter(
    (plugin): plugin is BetterAuthPlugin => plugin !== null
  );
}

/**
 * Get detailed plugin configuration status
 *
 * @param env - Validated environment variables
 * @returns Array of plugin configurations with status
 */
export function getPluginDetails(env: Env): PluginConfig[] {
  const pluginStatus = getPluginStatus(env);
  return [
    {
      name: "storage",
      enabled: pluginStatus.storage,
      plugin: pluginStatus.storage ? getStoragePlugin(env) : null,
    },
    {
      name: "feature-flags",
      enabled: pluginStatus.featureFlags,
      plugin: pluginStatus.featureFlags ? getFeatureFlagsPlugin(env) : null,
    },
    {
      name: "organizations",
      enabled: pluginStatus.organizations,
      plugin: pluginStatus.organizations ? getOrganizationsPlugin(env) : null,
    },
    {
      name: "connect",
      enabled: pluginStatus.connect,
      plugin: pluginStatus.connect ? getConnectPlugin(env) : null,
    },
  ];
}

/**
 * Log plugin status to console (useful for debugging)
 *
 * @param env - Validated environment variables
 */
export function logPluginStatus(env: Env): void {
  const status = getPluginDetails(env);
  console.log("Better Auth Plugin Status:");
  console.log("==========================");
  status.forEach(({ name, enabled }) => {
    const statusEmoji = enabled ? "✅" : "❌";
    console.log(`${statusEmoji} ${name}: ${enabled ? "Enabled" : "Disabled"}`);
  });
  console.log("==========================");
}

// Re-export individual plugin getters for direct access
export { getStoragePlugin } from "./storage";
export { getFeatureFlagsPlugin } from "./feature-flags";
export { getOrganizationsPlugin } from "./organizations";
export { getConnectPlugin } from "./connect";
