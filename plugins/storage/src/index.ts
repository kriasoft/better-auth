// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import { createStoragePlugin } from "./plugin";
import type { BetterAuthPlugin } from "better-auth";
import type { ConnectPluginOptions } from "./plugin";
import type { StorageEndpoints } from "./endpoints";
import { definePlugin } from "./internal/define-plugin";

/**
 * Better Auth Storage Plugin
 *
 * Provides secure cloud storage connection management:
 * - OAuth 2.0 integration for cloud providers
 * - File synchronization and metadata tracking
 * - Webhook processing for real-time updates
 * - Multi-provider support (Google Drive, OneDrive)
 * - Rate limiting and quota management
 *
 * @example
 * ```typescript
 * import { betterAuth } from "better-auth";
 * import { storagePlugin } from "better-auth-storage";
 *
 * export const auth = betterAuth({
 *   plugins: [
 *     storagePlugin({
 *       providers: [googleDriveProvider, oneDriveProvider],
 *       sync: { interval: 300, batchSize: 100 },
 *       storage: { maxSizePerUser: 1073741824 }
 *     })
 *   ]
 * });
 * ```
 */
export function storagePlugin(
  options: ConnectPluginOptions,
): BetterAuthPlugin & { endpoints: StorageEndpoints } {
  // Hide complex internal types while preserving endpoint keys for API typing
  return definePlugin<StorageEndpoints>(createStoragePlugin(options));
}

export default storagePlugin;

// Server-side exports
export {
  type ConnectPluginOptions as StoragePluginOptions,
  type CloudProvider,
} from "./plugin";
export { connectSchema as storageSchema } from "./schema";
export {
  googleDriveProvider,
  GoogleDriveSource,
  type GoogleDriveFile,
} from "./sources/google-drive";
export {
  oneDriveProvider,
  OneDriveSource,
  type OneDriveFile,
} from "./sources/onedrive";

// Client-side exports
export {
  storageClient,
  type ConnectClientOptions as StorageClientOptions,
  type ConnectedAccount,
  type SyncedFile,
  type SyncStatus,
} from "./client";

export type { BetterAuthPlugin };
