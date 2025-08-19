// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import type { BetterAuthClientPlugin } from "better-auth/client";

export interface ConnectClientOptions {
  /**
   * Base URL for the API
   */
  baseURL?: string;
}

export interface ConnectedAccount {
  id: string;
  provider: string;
  providerAccountEmail?: string;
  lastSyncedAt?: Date;
  createdAt: Date;
}

export interface SyncedFile {
  id: string;
  accountId: string;
  name: string;
  mimeType: string;
  size: number;
  parentId?: string;
  webUrl?: string;
  downloadUrl?: string;
  thumbnailUrl?: string;
  modifiedTime: Date;
  syncedAt: Date;
}

export interface SyncStatus {
  syncId?: string;
  status: "no_sync" | "in_progress" | "completed" | "failed";
  filesProcessed?: number;
  filesTotal?: number;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
  lastSyncedAt?: Date;
}

export const storageClient = (
  options?: ConnectClientOptions,
): BetterAuthClientPlugin => {
  return {
    id: "storage",

    $InferServerPlugin: {} as any,

    getActions: (fetch) => {
      const baseURL = options?.baseURL || "";

      return {
        connect: {
          /**
           * List available storage providers
           */
          listProviders: async () => {
            const response = await fetch("/connect/providers", {
              method: "GET",
            });
            return response.data as {
              providers: Array<{ id: string; name: string }>;
            };
          },

          /**
           * Initiate OAuth authorization for a provider
           */
          authorize: async (
            providerId: string,
            options?: {
              callbackURL?: string;
              errorCallbackURL?: string;
            },
          ) => {
            const response = await fetch(`/connect/authorize/${providerId}`, {
              method: "POST",
              body: {
                callbackURL: options?.callbackURL,
                errorCallbackURL: options?.errorCallbackURL,
              },
            });

            const data = response.data as { url: string; redirect: boolean };

            if (data.redirect && typeof window !== "undefined") {
              window.location.href = data.url;
            }

            return data;
          },

          /**
           * List connected accounts
           */
          listAccounts: async () => {
            const response = await fetch("/connect/accounts", {
              method: "GET",
            });
            return response.data as { accounts: ConnectedAccount[] };
          },

          /**
           * Disconnect an account
           */
          disconnectAccount: async (accountId: string) => {
            const response = await fetch(`/connect/accounts/${accountId}`, {
              method: "DELETE",
            });
            return response.data as { success: boolean };
          },

          /**
           * Trigger manual sync for an account
           */
          syncAccount: async (accountId: string) => {
            const response = await fetch(`/connect/sync/${accountId}`, {
              method: "POST",
            });
            return response.data as { syncId: string; status: string };
          },

          /**
           * Get sync status for an account
           */
          getSyncStatus: async (accountId: string) => {
            const response = await fetch(`/connect/sync/${accountId}/status`, {
              method: "GET",
            });
            return response.data as SyncStatus;
          },

          /**
           * List synced files
           */
          listFiles: async (options?: {
            accountId?: string;
            limit?: number;
            offset?: number;
            mimeType?: string;
            parentId?: string;
          }) => {
            const params = new URLSearchParams();

            if (options?.accountId) params.set("accountId", options.accountId);
            if (options?.limit) params.set("limit", options.limit.toString());
            if (options?.offset)
              params.set("offset", options.offset.toString());
            if (options?.mimeType) params.set("mimeType", options.mimeType);
            if (options?.parentId !== undefined)
              params.set("parentId", options.parentId);

            const response = await fetch(`/connect/files?${params}`, {
              method: "GET",
            });
            return response.data as { files: SyncedFile[]; total: number };
          },

          /**
           * Get file details
           */
          getFile: async (fileId: string) => {
            const response = await fetch(`/connect/files/${fileId}`, {
              method: "GET",
            });
            return response.data as {
              file: SyncedFile & {
                provider: string;
                providerFileId: string;
                metadata?: any;
              };
            };
          },

          /**
           * Register webhook for real-time updates
           */
          registerWebhook: async (accountId: string) => {
            const response = await fetch("/connect/webhook/register", {
              method: "POST",
              body: { accountId },
            });
            return response.data as {
              success: boolean;
              channelId?: string;
              subscriptionId?: string;
              message?: string;
            };
          },
        },
      };
    },
  };
};
