// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import { createAuthEndpoint } from "better-auth/plugins";
import { z } from "zod";
import type { DataSource, ConnectPluginOptions } from "../types";

/**
 * Connect Plugin Endpoints
 *
 * Organized endpoint definitions for data source connection management.
 * Provides OAuth flows, webhook handling, and connection lifecycle management.
 *
 * @see plugins/connect/src/endpoints/
 */
export type ConnectEndpoints = ReturnType<typeof createConnectEndpoints>;

export function createConnectEndpoints(
  sources: DataSource[],
  options: ConnectPluginOptions = {},
) {
  return {
    listSources: createAuthEndpoint(
      "/connect/sources",
      {
        method: "GET",
      },
      async (ctx) => {
        return ctx.json({
          sources: sources.map((s: DataSource) => ({
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
        const source = sources.find(
          (s: DataSource) => s.id === ctx.body.source,
        );

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
        const source = sources.find(
          (s: DataSource) => s.id === ctx.body.source,
        );

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
          await options.onSync((connection as any).source, session.user.id, {});
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

        if (options.webhookSecret && ctx.headers?.get("x-webhook-signature")) {
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
  };
}
