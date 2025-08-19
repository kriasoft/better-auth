// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import type { BetterAuthClientPlugin } from "better-auth/client";

export interface ConnectClientOptions {
  onConnectSuccess?: (source: string, connectionId: string) => void;
  onConnectError?: (source: string, error: Error) => void;
  onDisconnectSuccess?: (source: string) => void;
  onSyncComplete?: (source: string, data: any) => void;
}

export interface DataSource {
  id: string;
  name: string;
  type: "oauth" | "api_key" | "webhook";
}

export interface Connection {
  id: string;
  source: string;
  status: "active" | "expired" | "error";
  lastSyncedAt?: Date;
  metadata?: Record<string, any>;
}

export const connectClient = (
  options: ConnectClientOptions = {},
): BetterAuthClientPlugin => {
  return {
    id: "connect",
    $InferServerPlugin: {} as any,
    getActions: ($fetch) => ({
      connect: {
        listSources: async () => {
          const response = await $fetch("/connect/sources", {
            method: "GET",
          });

          return response.data as { sources: DataSource[] };
        },

        authorize: async (source: string, redirectUri?: string) => {
          const response = await $fetch("/connect/authorize", {
            method: "POST",
            body: {
              source,
              redirectUri,
            },
          });

          const data = response.data as { authUrl: string; state: string };

          if (typeof window !== "undefined") {
            window.location.href = data.authUrl;
          }

          return data;
        },

        handleCallback: async (source: string, code: string, state: string) => {
          const response = await $fetch("/connect/callback", {
            method: "POST",
            body: {
              source,
              code,
              state,
            },
          });

          const data = response.data as {
            success: boolean;
            connectionId: string;
          };

          if (data.success && options.onConnectSuccess) {
            options.onConnectSuccess(source, data.connectionId);
          }

          return data;
        },

        disconnect: async (connectionId: string) => {
          const response = await $fetch("/connect/disconnect", {
            method: "POST",
            body: {
              connectionId,
            },
          });

          const data = response.data as { success: boolean };

          if (data.success && options.onDisconnectSuccess) {
            options.onDisconnectSuccess(connectionId);
          }

          return data;
        },

        sync: async (connectionId: string) => {
          const response = await $fetch("/connect/sync", {
            method: "POST",
            body: {
              connectionId,
            },
          });

          const data = response.data as { success: boolean; syncedAt: string };

          if (data.success && options.onSyncComplete) {
            options.onSyncComplete(connectionId, data);
          }

          return data;
        },

        getConnections: async () => {
          const response = await $fetch("/connect/connections", {
            method: "GET",
          });

          return response.data as Connection[];
        },
      },
    }),
  };
};

export type ConnectClient = ReturnType<typeof connectClient>;
