// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import { createConnectEndpoints } from "./connect";
import { createSyncEndpoints } from "./sync";
import { createWebhookEndpoints } from "./webhook";
import type { ConnectPluginOptions } from "../plugin";

/**
 * Storage Plugin Endpoints
 *
 * Organized endpoint definitions for cloud storage connection management.
 * Provides OAuth flows, sync operations, and webhook handling for storage providers.
 *
 * @see plugins/storage/src/endpoints/
 */
export type StorageEndpoints = ReturnType<typeof createStorageEndpoints>;

export function createStorageEndpoints(options: ConnectPluginOptions) {
  return {
    ...createConnectEndpoints(options),
    ...createSyncEndpoints(options),
    ...createWebhookEndpoints(options),
  };
}
