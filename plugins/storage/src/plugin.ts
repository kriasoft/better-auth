// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import type { BetterAuthPlugin } from "better-auth";
import { connectSchema } from "./schema";
import { createConnectEndpoints } from "./endpoints/connect";
import { createSyncEndpoints } from "./endpoints/sync";
import { createWebhookEndpoints } from "./endpoints/webhook";

export interface CloudProvider {
  id: string;
  name: string;
  clientId: string;
  clientSecret: string;
  scopes?: string[];
  authorizationUrl?: string;
  tokenUrl?: string;
  userInfoUrl?: string;
  discoveryUrl?: string;
}

export interface ConnectPluginOptions {
  /**
   * List of cloud storage providers to support
   */
  providers: CloudProvider[];

  /**
   * Sync configuration
   */
  sync?: {
    /**
     * How often to sync files in seconds
     * @default 300 (5 minutes)
     */
    interval?: number;
    /**
     * Maximum files to sync per operation
     * @default 100
     */
    batchSize?: number;
    /**
     * File type filters (e.g., ["image/*", "application/pdf"])
     */
    allowedTypes?: string[];
  };

  /**
   * Storage configuration
   */
  storage?: {
    /**
     * Maximum storage per user in bytes
     * @default 1GB
     */
    maxSizePerUser?: number;
    /**
     * Maximum file size in bytes
     * @default 100MB
     */
    maxFileSize?: number;
  };

  /**
   * Whether to enable webhook support
   * @default false
   */
  enableWebhooks?: boolean;
}

/**
 * Better Auth plugin for connecting cloud storage providers
 */
export function storagePlugin(options: ConnectPluginOptions): BetterAuthPlugin {
  const syncInterval = options.sync?.interval ?? 300;
  const batchSize = options.sync?.batchSize ?? 100;
  const maxSizePerUser = options.storage?.maxSizePerUser ?? 1073741824;
  const maxFileSize = options.storage?.maxFileSize ?? 104857600;

  return {
    id: "connect",

    schema: connectSchema,

    endpoints: {
      ...createConnectEndpoints(options),
      ...createSyncEndpoints(options),
      ...createWebhookEndpoints(options),
    },

    hooks: {
      after: [
        {
          matcher(ctx: any) {
            return ctx.path === "/sign-out";
          },
          handler: async (ctx: any) => {
            // Clean up any active sync operations when user signs out
            const session = await ctx.getSession();
            if (session?.user?.id) {
              // Implementation will be added
            }
            return;
          },
        },
      ],
    },

    rateLimit: [
      {
        window: 60,
        max: 10,
        pathMatcher: (path) => path.startsWith("/connect/sync"),
      },
      {
        window: 60,
        max: 5,
        pathMatcher: (path) => path.startsWith("/connect/authorize"),
      },
    ],

    $ERROR_CODES: {
      PROVIDER_NOT_CONFIGURED: "Provider not configured",
      INVALID_PROVIDER: "Invalid provider",
      CONNECTION_FAILED: "Failed to connect to provider",
      SYNC_FAILED: "Sync operation failed",
      UNAUTHORIZED_ACCOUNT: "Not authorized to access this account",
      QUOTA_EXCEEDED: "Storage quota exceeded",
    },
  };
}

/**
 * Pre-configured Google Drive provider
 */
export const googleDriveProvider: CloudProvider = {
  id: "google-drive",
  name: "Google Drive",
  clientId: process.env.GOOGLE_DRIVE_CLIENT_ID || "",
  clientSecret: process.env.GOOGLE_DRIVE_CLIENT_SECRET || "",
  scopes: [
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/drive.readonly",
    "https://www.googleapis.com/auth/userinfo.email",
  ],
  authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenUrl: "https://oauth2.googleapis.com/token",
  userInfoUrl: "https://www.googleapis.com/oauth2/v2/userinfo",
};

/**
 * Pre-configured OneDrive provider
 */
export const oneDriveProvider: CloudProvider = {
  id: "onedrive",
  name: "OneDrive",
  clientId: process.env.ONEDRIVE_CLIENT_ID || "",
  clientSecret: process.env.ONEDRIVE_CLIENT_SECRET || "",
  scopes: ["Files.Read", "Files.Read.All", "User.Read", "offline_access"],
  authorizationUrl:
    "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
  tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
  userInfoUrl: "https://graph.microsoft.com/v1.0/me",
};
