// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import { z } from "zod";
import { createAuthEndpoint } from "better-auth/plugins";
import { getSessionFromCtx } from "better-auth/api";
import type { ConnectPluginOptions } from "../plugin";

export function createWebhookEndpoints(options: ConnectPluginOptions) {
  return {
    /**
     * Handle Google Drive webhook notifications
     */
    googleDriveWebhook: createAuthEndpoint(
      "/connect/webhook/google-drive",
      {
        method: "POST",
        requireHeaders: true,
      },
      async (ctx) => {
        const channelId = ctx.headers?.get("x-goog-channel-id");
        const channelToken = ctx.headers?.get("x-goog-channel-token");
        const resourceState = ctx.headers?.get("x-goog-resource-state");
        const resourceId = ctx.headers?.get("x-goog-resource-id");

        if (!channelId || !channelToken) {
          throw ctx.error("BAD_REQUEST", {
            message: "Missing required headers",
          });
        }

        // Verify the webhook is from Google
        // In production, you should verify the channel token

        // Find the connected account by channel ID
        // For now, we'll just acknowledge the webhook
        if (resourceState === "sync") {
          // Initial sync message, just acknowledge
          return ctx.json({ success: true });
        }

        // Handle file changes
        if (resourceState === "change" || resourceState === "update") {
          // TODO: Trigger sync for the account associated with this channel
          // You would need to store channel IDs with connected accounts
        }

        return ctx.json({ success: true });
      },
    ),

    /**
     * Handle OneDrive webhook notifications
     */
    oneDriveWebhook: createAuthEndpoint(
      "/connect/webhook/onedrive",
      {
        method: "POST",
        query: z.object({
          validationToken: z.string().optional(),
        }),
        requireHeaders: true,
      },
      async (ctx) => {
        // Handle validation request from Microsoft
        if (ctx.query?.validationToken) {
          return new Response(ctx.query.validationToken, {
            status: 200,
            headers: {
              "Content-Type": "text/plain",
            },
          });
        }

        const body = ctx.body as any;

        if (!body || !body.value) {
          throw ctx.error("BAD_REQUEST", {
            message: "Invalid webhook payload",
          });
        }

        // Process notifications
        for (const notification of body.value) {
          if (
            notification.changeType === "updated" ||
            notification.changeType === "created"
          ) {
            // TODO: Trigger sync for the affected account
            // You would need to map subscription IDs to connected accounts
          }
        }

        return ctx.json({ success: true });
      },
    ),

    /**
     * Register webhook for real-time updates
     */
    registerWebhook: createAuthEndpoint(
      "/connect/webhook/register",
      {
        method: "POST",
        body: z.object({
          accountId: z.string(),
        }),
      },
      async (ctx) => {
        const session = await getSessionFromCtx(ctx);
        if (!session) {
          throw ctx.error("UNAUTHORIZED");
        }

        const account = (await ctx.context.adapter.findOne({
          model: "connectedAccount",
          where: [
            { field: "id", value: ctx.body.accountId },
            { field: "userId", value: session.user.id },
          ],
        })) as any;

        if (!account) {
          throw ctx.error("NOT_FOUND", {
            message: "Account not found",
          });
        }

        const provider = options.providers.find(
          (p) => p.id === (account as any).provider,
        );
        if (!provider) {
          throw ctx.error("BAD_REQUEST", {
            message: "Provider not configured",
          });
        }

        // Register webhook based on provider
        if (provider.id === "google-drive") {
          // Register Google Drive webhook
          const channelId = crypto.randomUUID();
          const channelToken = crypto.randomUUID();

          const response = await fetch(
            "https://www.googleapis.com/drive/v3/changes/watch",
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${(account as any).accessToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                id: channelId,
                type: "web_hook",
                address: `${ctx.context.baseURL}/connect/webhook/google-drive`,
                token: channelToken,
                expiration: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
              }),
            },
          );

          if (!response.ok) {
            throw ctx.error("BAD_REQUEST", {
              message: "Failed to register webhook",
            });
          }

          const result = await response.json();

          // Store channel info with the account
          // You would need to add a field to store this

          return ctx.json({
            success: true,
            channelId,
            expiration: result.expiration,
          });
        } else if (provider.id === "onedrive") {
          // Register OneDrive webhook
          const subscriptionUrl =
            "https://graph.microsoft.com/v1.0/subscriptions";

          const response = await fetch(subscriptionUrl, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${(account as any).accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              changeType: "created,updated,deleted",
              notificationUrl: `${ctx.context.baseURL}/connect/webhook/onedrive`,
              resource: "/me/drive/root",
              expirationDateTime: new Date(
                Date.now() + 3 * 24 * 60 * 60 * 1000,
              ).toISOString(), // 3 days
              clientState: crypto.randomUUID(),
            }),
          });

          if (!response.ok) {
            throw ctx.error("BAD_REQUEST", {
              message: "Failed to register webhook",
            });
          }

          const result = await response.json();

          return ctx.json({
            success: true,
            subscriptionId: result.id,
            expiration: result.expirationDateTime,
          });
        }

        return ctx.json({
          success: false,
          message: "Webhook registration not supported for this provider",
        });
      },
    ),
  };
}
