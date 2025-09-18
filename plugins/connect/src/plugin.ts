// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import type { BetterAuthPlugin } from "better-auth";
import { z } from "zod";
import type { DataSource, ConnectPluginOptions } from "./types";
import { createConnectEndpoints } from "./endpoints";

const connectOptionsSchema = z
  .object({
    sources: z
      .array(
        z.object({
          id: z.string(),
          name: z.string(),
          type: z.enum(["oauth", "api_key", "webhook"]),
          scopes: z.array(z.string()).optional(),
          authUrl: z.string().optional(),
          tokenUrl: z.string().optional(),
          clientId: z.string().optional(),
          clientSecret: z.string().optional(),
        }),
      )
      .optional(),
    syncInterval: z.number().optional().default(300),
    maxSyncSize: z
      .number()
      .optional()
      .default(100 * 1024 * 1024),
    webhookSecret: z.string().optional(),
  })
  .partial();

export function createConnectPlugin(
  options: ConnectPluginOptions = {},
): BetterAuthPlugin {
  const opts = connectOptionsSchema.parse(options);

  const predefinedSources: DataSource[] = [
    {
      id: "google-drive",
      name: "Google Drive",
      type: "oauth",
      scopes: ["https://www.googleapis.com/auth/drive.readonly"],
      authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenUrl: "https://oauth2.googleapis.com/token",
      clientId: process.env.GOOGLE_DRIVE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_DRIVE_CLIENT_SECRET,
    },
    {
      id: "gmail",
      name: "Gmail",
      type: "oauth",
      scopes: [
        "https://www.googleapis.com/auth/gmail.readonly",
        "https://www.googleapis.com/auth/gmail.metadata",
      ],
      authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenUrl: "https://oauth2.googleapis.com/token",
      clientId: process.env.GMAIL_CLIENT_ID,
      clientSecret: process.env.GMAIL_CLIENT_SECRET,
    },
    {
      id: "github",
      name: "GitHub",
      type: "oauth",
      scopes: ["repo", "read:org"],
      authUrl: "https://github.com/login/oauth/authorize",
      tokenUrl: "https://github.com/login/oauth/access_token",
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    },
    {
      id: "onedrive",
      name: "OneDrive",
      type: "oauth",
      scopes: ["Files.Read", "Files.Read.All"],
      authUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
      tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
      clientId: process.env.ONEDRIVE_CLIENT_ID,
      clientSecret: process.env.ONEDRIVE_CLIENT_SECRET,
    },
    {
      id: "dropbox",
      name: "Dropbox",
      type: "oauth",
      scopes: ["files.metadata.read", "files.content.read"],
      authUrl: "https://www.dropbox.com/oauth2/authorize",
      tokenUrl: "https://api.dropboxapi.com/oauth2/token",
      clientId: process.env.DROPBOX_CLIENT_ID,
      clientSecret: process.env.DROPBOX_CLIENT_SECRET,
    },
  ];

  const sources = opts.sources || predefinedSources;
  const endpoints = createConnectEndpoints(sources, options);

  return {
    id: "connect",
    schema: {
      connections: {
        fields: {
          userId: {
            type: "string",
            references: {
              model: "user",
              field: "id",
            },
          },
          source: {
            type: "string",
          },
          accessToken: {
            type: "string",
            required: false,
          },
          refreshToken: {
            type: "string",
            required: false,
          },
          expiresAt: {
            type: "date",
            required: false,
          },
          metadata: {
            type: "string",
            required: false,
          },
          lastSyncedAt: {
            type: "date",
            required: false,
          },
          status: {
            type: "string",
          },
          createdAt: {
            type: "date",
          },
          updatedAt: {
            type: "date",
          },
        },
      },
      syncedData: {
        fields: {
          connectionId: {
            type: "string",
            references: {
              model: "connections",
              field: "id",
            },
          },
          sourceId: {
            type: "string",
          },
          type: {
            type: "string",
          },
          data: {
            type: "string",
          },
          syncedAt: {
            type: "date",
          },
        },
      },
    },
    endpoints,
  };
}
