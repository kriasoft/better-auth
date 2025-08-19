// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import type { BetterAuthPlugin } from "better-auth";
import { createAuthEndpoint } from "better-auth/plugins";
import { z } from "zod";

export interface DataSource {
  id: string;
  name: string;
  type: "oauth" | "api_key" | "webhook";
  scopes?: string[];
  authUrl?: string;
  tokenUrl?: string;
  clientId?: string;
  clientSecret?: string;
}

export interface ConnectPluginOptions {
  sources?: DataSource[];
  syncInterval?: number;
  maxSyncSize?: number;
  webhookSecret?: string;
  onConnect?: (source: string, userId: string, metadata: any) => Promise<void>;
  onDisconnect?: (source: string, userId: string) => Promise<void>;
  onSync?: (source: string, userId: string, data: any) => Promise<void>;
}

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

export function connectPlugin(
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
    endpoints: {
      listSources: createAuthEndpoint(
        "/connect/sources",
        {
          method: "GET",
        },
        async (ctx) => {
          return ctx.json({
            sources: sources.map((s) => ({
              id: s.id,
              name: s.name,
              type: s.type,
            })),
          });
        },
      ),

      authorize: createAuthEndpoint(
        "/connect/authorize",
        {
          method: "POST",
          body: z.object({
            source: z.string(),
            redirectUri: z.string().optional(),
          }),
        },
        async (ctx) => {
          const source = sources.find((s) => s.id === ctx.body.source);

          if (!source) {
            throw ctx.error("NOT_FOUND", {
              message: `Unknown source: ${ctx.body.source}`,
            });
          }

          if (source.type !== "oauth") {
            throw ctx.error("BAD_REQUEST", {
              message: `Source ${ctx.body.source} does not support OAuth`,
            });
          }

          const state = crypto.randomUUID();
          const redirectUri =
            ctx.body.redirectUri || `${ctx.context.baseURL}/connect/callback`;

          const params = new URLSearchParams({
            client_id: source.clientId!,
            redirect_uri: redirectUri,
            response_type: "code",
            scope: source.scopes?.join(" ") || "",
            state,
            access_type: "offline",
            prompt: "consent",
          });

          return ctx.json({
            authUrl: `${source.authUrl}?${params.toString()}`,
            state,
          });
        },
      ),

      callback: createAuthEndpoint(
        "/connect/callback",
        {
          method: "POST",
          body: z.object({
            source: z.string(),
            code: z.string(),
            state: z.string(),
          }),
        },
        async (ctx) => {
          const source = sources.find((s) => s.id === ctx.body.source);

          if (!source || source.type !== "oauth") {
            throw ctx.error("BAD_REQUEST", {
              message: `Invalid source: ${ctx.body.source}`,
            });
          }

          const session = ctx.context.session;
          if (!session) {
            throw ctx.error("UNAUTHORIZED");
          }

          const tokenResponse = await fetch(source.tokenUrl!, {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              client_id: source.clientId!,
              client_secret: source.clientSecret!,
              code: ctx.body.code,
              grant_type: "authorization_code",
              redirect_uri: `${ctx.context.baseURL}/connect/callback`,
            }),
          });

          const tokens = await tokenResponse.json();

          if (!tokenResponse.ok) {
            throw ctx.error("INTERNAL_SERVER_ERROR", {
              message: `Failed to exchange code: ${tokens.error_description || tokens.error}`,
            });
          }

          const connectionId = crypto.randomUUID();

          await ctx.context.adapter.create({
            model: "connections",
            data: {
              id: connectionId,
              userId: session.user.id,
              source: ctx.body.source,
              accessToken: tokens.access_token,
              refreshToken: tokens.refresh_token,
              expiresAt: tokens.expires_in
                ? new Date(Date.now() + tokens.expires_in * 1000)
                : null,
              metadata: JSON.stringify({
                scope: tokens.scope,
                token_type: tokens.token_type,
              }),
              status: "active",
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          });

          if (options.onConnect) {
            await options.onConnect(ctx.body.source, session.user.id, {
              scope: tokens.scope,
              token_type: tokens.token_type,
            });
          }

          return ctx.json({
            success: true,
            connectionId,
          });
        },
      ),

      disconnect: createAuthEndpoint(
        "/connect/disconnect",
        {
          method: "POST",
          body: z.object({
            connectionId: z.string(),
          }),
        },
        async (ctx) => {
          const session = ctx.context.session;
          if (!session) {
            throw ctx.error("UNAUTHORIZED");
          }

          const connection = await ctx.context.adapter.findOne({
            model: "connections",
            where: [
              {
                field: "id",
                value: ctx.body.connectionId,
              },
              {
                field: "userId",
                value: session.user.id,
              },
            ],
          });

          if (!connection) {
            throw ctx.error("NOT_FOUND", {
              message: "Connection not found",
            });
          }

          await ctx.context.adapter.delete({
            model: "connections",
            where: [
              {
                field: "id",
                value: ctx.body.connectionId,
              },
            ],
          });

          if (options.onDisconnect) {
            await options.onDisconnect(
              (connection as any).source,
              session.user.id,
            );
          }

          return ctx.json({
            success: true,
          });
        },
      ),

      sync: createAuthEndpoint(
        "/connect/sync",
        {
          method: "POST",
          body: z.object({
            connectionId: z.string(),
          }),
        },
        async (ctx) => {
          const session = ctx.context.session;
          if (!session) {
            throw ctx.error("UNAUTHORIZED");
          }

          const connection = await ctx.context.adapter.findOne({
            model: "connections",
            where: [
              {
                field: "id",
                value: ctx.body.connectionId,
              },
              {
                field: "userId",
                value: session.user.id,
              },
            ],
          });

          if (!connection) {
            throw ctx.error("NOT_FOUND", {
              message: "Connection not found",
            });
          }

          await ctx.context.adapter.update({
            model: "connections",
            where: [
              {
                field: "id",
                value: ctx.body.connectionId,
              },
            ],
            update: {
              lastSyncedAt: new Date(),
              updatedAt: new Date(),
            },
          });

          if (options.onSync) {
            await options.onSync(
              (connection as any).source,
              session.user.id,
              {},
            );
          }

          return ctx.json({
            success: true,
            syncedAt: new Date().toISOString(),
          });
        },
      ),

      webhook: createAuthEndpoint(
        "/connect/webhook/:source",
        {
          method: "POST",
        },
        async (ctx) => {
          const source = ctx.params?.source as string;

          if (opts.webhookSecret && ctx.headers?.get("x-webhook-signature")) {
            // Verify webhook signature
          }

          // Process webhook data
          console.log(`Received webhook for source: ${source}`, ctx.body);

          return ctx.json({
            received: true,
          });
        },
      ),

      connections: createAuthEndpoint(
        "/connect/connections",
        {
          method: "GET",
        },
        async (ctx) => {
          const session = ctx.context.session;
          if (!session) {
            throw ctx.error("UNAUTHORIZED");
          }

          const connections = await ctx.context.adapter.findMany({
            model: "connections",
            where: [
              {
                field: "userId",
                value: session.user.id,
              },
            ],
          });

          return ctx.json(
            connections.map((c: any) => ({
              id: c.id,
              source: c.source,
              status: c.status,
              lastSyncedAt: c.lastSyncedAt,
              metadata: c.metadata ? JSON.parse(c.metadata) : undefined,
            })),
          );
        },
      ),
    },
  };
}

export type { BetterAuthPlugin };
