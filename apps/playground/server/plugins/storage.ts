// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import type { StoragePluginOptions } from "better-auth-storage";
import { storagePlugin } from "better-auth-storage";
import type { Env } from "../env";
import { getPluginStatus } from "../env";

/**
 * Storage Plugin Configuration
 *
 * Provides cloud storage integration with:
 * - Multiple storage providers (Google Drive, OneDrive, Dropbox, etc.)
 * - File synchronization
 * - Storage quotas and limits
 * - Webhook support
 */
export function getStoragePlugin(env: Env): ReturnType<typeof storagePlugin> | null {
  const pluginStatus = getPluginStatus(env);
  
  // Check if storage plugin is enabled
  if (!pluginStatus.storage) {
    return null;
  }

  const providers: NonNullable<StoragePluginOptions["providers"]> = [];

  if (env.GOOGLE_DRIVE_CLIENT_ID && env.GOOGLE_DRIVE_CLIENT_SECRET) {
    providers.push({
      id: "google-drive",
      name: "Google Drive",
      clientId: env.GOOGLE_DRIVE_CLIENT_ID,
      clientSecret: env.GOOGLE_DRIVE_CLIENT_SECRET,
      scopes: [
        "https://www.googleapis.com/auth/drive.file",
        "https://www.googleapis.com/auth/drive.readonly",
        "https://www.googleapis.com/auth/userinfo.email",
      ],
      authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenUrl: "https://oauth2.googleapis.com/token",
      userInfoUrl: "https://www.googleapis.com/oauth2/v2/userinfo",
    });
  }

  if (env.ONEDRIVE_CLIENT_ID && env.ONEDRIVE_CLIENT_SECRET) {
    providers.push({
      id: "onedrive",
      name: "OneDrive",
      clientId: env.ONEDRIVE_CLIENT_ID,
      clientSecret: env.ONEDRIVE_CLIENT_SECRET,
      scopes: ["Files.Read", "Files.Read.All", "User.Read", "offline_access"],
      authorizationUrl:
        "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
      tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
      userInfoUrl: "https://graph.microsoft.com/v1.0/me",
    });
  }

  const config: StoragePluginOptions = {
    providers: providers.length > 0 ? providers : undefined,

    sync: {
      interval: env.STORAGE_SYNC_INTERVAL,
      batchSize: env.STORAGE_SYNC_BATCH_SIZE,
      allowedTypes: env.STORAGE_ALLOWED_TYPES?.split(",") || [
        "image/*",
        "application/pdf",
        "text/*",
      ],
    },

    storage: {
      maxSizePerUser: env.STORAGE_MAX_SIZE_PER_USER,
      maxFileSize: env.STORAGE_MAX_FILE_SIZE,
    },

    enableWebhooks: env.STORAGE_ENABLE_WEBHOOKS,
  };

  return storagePlugin(config);
}
