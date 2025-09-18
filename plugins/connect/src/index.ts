// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import { createConnectPlugin } from "./plugin";
import type { BetterAuthPlugin } from "better-auth";
import type { ConnectPluginOptions } from "./types";
import type { ConnectEndpoints } from "./endpoints";
import { definePlugin } from "./internal/define-plugin";

/**
 * Better Auth Connect Plugin
 *
 * Provides secure connection management for external data sources:
 * - OAuth 2.0 integration flows
 * - Webhook processing and verification
 * - Connection lifecycle management
 * - Data synchronization and caching
 * - Multi-provider support (Google Drive, Gmail, GitHub, OneDrive, Dropbox)
 *
 * @example
 * ```typescript
 * import { betterAuth } from "better-auth";
 * import { connectPlugin } from "better-auth-connect";
 *
 * export const auth = betterAuth({
 *   plugins: [
 *     connectPlugin({
 *       sources: [...],
 *       webhookSecret: process.env.WEBHOOK_SECRET,
 *       onConnect: async (source, userId, metadata) => {
 *         console.log(`Connected ${source} for user ${userId}`);
 *       }
 *     })
 *   ]
 * });
 * ```
 */
export function connectPlugin(
  options: ConnectPluginOptions = {},
): BetterAuthPlugin & { endpoints: ConnectEndpoints } {
  // Hide complex internal types while preserving endpoint keys for API typing
  return definePlugin<ConnectEndpoints>(createConnectPlugin(options));
}

export default connectPlugin;

// Core type exports for external consumers
export type { DataSource, ConnectPluginOptions } from "./types";

export type { BetterAuthPlugin };
