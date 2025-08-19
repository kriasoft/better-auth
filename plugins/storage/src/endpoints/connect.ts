// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import { z } from "zod";
import { createAuthEndpoint } from "better-auth/plugins";
import type { ConnectPluginOptions } from "../plugin";

export function createConnectEndpoints(options: ConnectPluginOptions) {
  return {
    /**
     * List available storage providers
     */
    listProviders: createAuthEndpoint(
      "/connect/providers",
      {
        method: "GET",
      },
      async (ctx) => {
        return ctx.json({
          providers: options.providers.map((p) => ({
            id: p.id,
            name: p.name,
          })),
        });
      },
    ),

    /**
     * Initiate OAuth authorization flow
     */
    authorizeProvider: createAuthEndpoint(
      "/connect/authorize/:providerId",
      {
        method: "POST",
        body: z.object({
          callbackURL: z.string().optional(),
          errorCallbackURL: z.string().optional(),
        }),
      },
      async (ctx) => {
        const provider = options.providers.find(
          (p) => p.id === ctx.params?.providerId,
        );

        if (!provider) {
          throw ctx.error("NOT_FOUND", {
            message: "Provider not found",
          });
        }

        const session = await ctx.getSession();
        if (!session) {
          throw ctx.error("UNAUTHORIZED");
        }

        // Generate state for OAuth flow
        const state = crypto.randomUUID();

        // Store state in database
        await ctx.context.adapter.create({
          model: "verificationToken",
          data: {
            identifier: state,
            token: JSON.stringify({
              providerId: provider.id,
              callbackURL: ctx.body.callbackURL,
              errorCallbackURL: ctx.body.errorCallbackURL,
              userId: session.user.id,
            }),
            expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
          },
        });

        // Build OAuth authorization URL
        const params = new URLSearchParams({
          client_id: provider.clientId,
          redirect_uri: `${ctx.context.baseURL}/connect/callback/${provider.id}`,
          response_type: "code",
          scope: provider.scopes?.join(" ") || "files.read",
          state,
          access_type: "offline",
          prompt: "consent",
        });

        const authUrl =
          provider.authorizationUrl ||
          (provider.id === "google-drive"
            ? "https://accounts.google.com/o/oauth2/v2/auth"
            : `https://login.microsoftonline.com/common/oauth2/v2.0/authorize`);

        return ctx.json({
          url: `${authUrl}?${params}`,
          redirect: true,
        });
      },
    ),

    /**
     * Handle OAuth callback
     */
    handleCallback: createAuthEndpoint(
      "/connect/callback/:providerId",
      {
        method: "GET",
        query: z.object({
          code: z.string().optional(),
          state: z.string(),
          error: z.string().optional(),
          error_description: z.string().optional(),
        }),
      },
      async (ctx) => {
        const { code, state, error, error_description } = ctx.query || {};

        // Retrieve state from database
        const stateRecord = await ctx.context.adapter.findOne({
          model: "verificationToken",
          where: [{ field: "identifier", value: state }],
        });

        if (!stateRecord) {
          throw ctx.error("BAD_REQUEST", {
            message: "Invalid state",
          });
        }

        const stateData = JSON.parse(stateRecord.token);

        // Delete state to prevent reuse
        await ctx.context.adapter.delete({
          model: "verificationToken",
          where: [{ field: "identifier", value: state }],
        });

        if (error) {
          // Redirect to error callback URL if provided
          if (stateData.errorCallbackURL) {
            return ctx.redirect(
              `${stateData.errorCallbackURL}?error=${error}&description=${error_description}`,
            );
          }
          throw ctx.error("BAD_REQUEST", {
            message: error_description || error,
          });
        }

        if (!code) {
          throw ctx.error("BAD_REQUEST", {
            message: "Authorization code not provided",
          });
        }

        const provider = options.providers.find(
          (p) => p.id === ctx.params?.providerId,
        );
        if (!provider) {
          throw ctx.error("NOT_FOUND", {
            message: "Provider not found",
          });
        }

        // Exchange code for tokens
        const tokenUrl =
          provider.tokenUrl ||
          (provider.id === "google-drive"
            ? "https://oauth2.googleapis.com/token"
            : "https://login.microsoftonline.com/common/oauth2/v2.0/token");

        const tokenResponse = await fetch(tokenUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            client_id: provider.clientId,
            client_secret: provider.clientSecret,
            code,
            redirect_uri: `${ctx.context.baseURL}/connect/callback/${provider.id}`,
            grant_type: "authorization_code",
          }),
        });

        if (!tokenResponse.ok) {
          throw ctx.error("BAD_REQUEST", {
            message: "Failed to exchange code for tokens",
          });
        }

        const tokens = (await tokenResponse.json()) as any;

        // Get user info from provider
        let userInfo: any = {};
        if (provider.userInfoUrl) {
          const userResponse = await fetch(provider.userInfoUrl, {
            headers: {
              Authorization: `Bearer ${tokens.access_token}`,
            },
          });
          if (userResponse.ok) {
            userInfo = await userResponse.json();
          }
        }

        // Store connection in database
        const existingConnection = await ctx.context.adapter.findOne({
          model: "connectedAccount",
          where: [
            { field: "userId", value: stateData.userId },
            { field: "provider", value: provider.id },
            {
              field: "providerAccountId",
              value: userInfo.id || userInfo.sub || "default",
            },
          ],
        });

        if (existingConnection) {
          // Update existing connection
          await ctx.context.adapter.update({
            model: "connectedAccount",
            where: [{ field: "id", value: existingConnection.id }],
            data: {
              accessToken: tokens.access_token,
              refreshToken: tokens.refresh_token,
              expiresAt: tokens.expires_in
                ? new Date(Date.now() + tokens.expires_in * 1000)
                : null,
              scope: tokens.scope,
              updatedAt: new Date(),
            },
          });
        } else {
          // Create new connection
          await ctx.context.adapter.create({
            model: "connectedAccount",
            data: {
              id: crypto.randomUUID(),
              userId: stateData.userId,
              provider: provider.id,
              providerAccountId: userInfo.id || userInfo.sub || "default",
              providerAccountEmail: userInfo.email,
              accessToken: tokens.access_token,
              refreshToken: tokens.refresh_token,
              expiresAt: tokens.expires_in
                ? new Date(Date.now() + tokens.expires_in * 1000)
                : null,
              scope: tokens.scope,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          });
        }

        // Redirect to callback URL if provided
        if (stateData.callbackURL) {
          return ctx.redirect(stateData.callbackURL);
        }

        return ctx.json({ success: true });
      },
    ),

    /**
     * List connected accounts
     */
    listAccounts: createAuthEndpoint(
      "/connect/accounts",
      {
        method: "GET",
      },
      async (ctx) => {
        const session = await ctx.getSession();
        if (!session) {
          throw ctx.error("UNAUTHORIZED");
        }

        const accounts = await ctx.context.adapter.findMany({
          model: "connectedAccount",
          where: [{ field: "userId", value: session.user.id }],
        });

        return ctx.json({
          accounts: accounts.map((account: any) => ({
            id: account.id,
            provider: account.provider,
            providerAccountEmail: account.providerAccountEmail,
            lastSyncedAt: account.lastSyncedAt,
            createdAt: account.createdAt,
          })),
        });
      },
    ),

    /**
     * Disconnect an account
     */
    disconnectAccount: createAuthEndpoint(
      "/connect/accounts/:accountId",
      {
        method: "DELETE",
      },
      async (ctx) => {
        const session = await ctx.getSession();
        if (!session) {
          throw ctx.error("UNAUTHORIZED");
        }

        const account = await ctx.context.adapter.findOne({
          model: "connectedAccount",
          where: [
            { field: "id", value: ctx.params?.accountId },
            { field: "userId", value: session.user.id },
          ],
        });

        if (!account) {
          throw ctx.error("NOT_FOUND", {
            message: "Account not found",
          });
        }

        await ctx.context.adapter.delete({
          model: "connectedAccount",
          where: [{ field: "id", value: ctx.params?.accountId }],
        });

        return ctx.json({ success: true });
      },
    ),
  };
}
