// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import { z } from "zod";
import { createAuthEndpoint } from "better-auth/plugins";
import type { ConnectPluginOptions } from "../plugin";

export function createSyncEndpoints(options: ConnectPluginOptions) {
  return {
    /**
     * Trigger manual sync for an account
     */
    syncAccount: createAuthEndpoint(
      "/connect/sync/:accountId",
      {
        method: "POST",
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

        // Check if sync is already in progress
        const existingSync = await ctx.context.adapter.findOne({
          model: "syncStatus",
          where: [
            { field: "connectedAccountId", value: ctx.params?.accountId },
            { field: "status", value: "in_progress" },
          ],
        });

        if (existingSync) {
          return ctx.json({
            syncId: existingSync.id,
            status: "already_in_progress",
          });
        }

        // Create new sync status
        const syncId = crypto.randomUUID();
        await ctx.context.adapter.create({
          model: "syncStatus",
          data: {
            id: syncId,
            connectedAccountId: ctx.params?.accountId,
            status: "in_progress",
            startedAt: new Date(),
          },
        });

        // TODO: Trigger actual sync process (would be async in production)
        // For now, we'll just mark it as completed after creating
        setTimeout(async () => {
          await ctx.context.adapter.update({
            model: "syncStatus",
            where: [{ field: "id", value: syncId }],
            data: {
              status: "completed",
              completedAt: new Date(),
              filesProcessed: 0,
              filesTotal: 0,
            },
          });
        }, 0);

        return ctx.json({
          syncId,
          status: "started",
        });
      },
    ),

    /**
     * Get sync status for an account
     */
    getSyncStatus: createAuthEndpoint(
      "/connect/sync/:accountId/status",
      {
        method: "GET",
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

        // Get latest sync status
        const syncStatus = await ctx.context.adapter.findMany({
          model: "syncStatus",
          where: [
            { field: "connectedAccountId", value: ctx.params?.accountId },
          ],
          orderBy: [{ field: "startedAt", direction: "desc" }],
          limit: 1,
        });

        if (!syncStatus || syncStatus.length === 0) {
          return ctx.json({
            status: "no_sync",
            lastSyncedAt: account.lastSyncedAt,
          });
        }

        const latestSync = syncStatus[0];
        return ctx.json({
          syncId: latestSync.id,
          status: latestSync.status,
          filesProcessed: latestSync.filesProcessed,
          filesTotal: latestSync.filesTotal,
          error: latestSync.error,
          startedAt: latestSync.startedAt,
          completedAt: latestSync.completedAt,
          lastSyncedAt: account.lastSyncedAt,
        });
      },
    ),

    /**
     * List synced files
     */
    listFiles: createAuthEndpoint(
      "/connect/files",
      {
        method: "GET",
        query: z.object({
          accountId: z.string().optional(),
          limit: z.coerce.number().min(1).max(100).default(50),
          offset: z.coerce.number().min(0).default(0),
          mimeType: z.string().optional(),
          parentId: z.string().optional(),
        }),
      },
      async (ctx) => {
        const session = await ctx.getSession();
        if (!session) {
          throw ctx.error("UNAUTHORIZED");
        }

        const { accountId, limit, offset, mimeType, parentId } =
          ctx.query || {};

        // Build where conditions
        const where: any[] = [];

        if (accountId) {
          // Verify user owns this account
          const account = await ctx.context.adapter.findOne({
            model: "connectedAccount",
            where: [
              { field: "id", value: accountId },
              { field: "userId", value: session.user.id },
            ],
          });

          if (!account) {
            throw ctx.error("NOT_FOUND", {
              message: "Account not found",
            });
          }

          where.push({ field: "connectedAccountId", value: accountId });
        } else {
          // Get all accounts for user
          const accounts = await ctx.context.adapter.findMany({
            model: "connectedAccount",
            where: [{ field: "userId", value: session.user.id }],
          });

          if (accounts.length === 0) {
            return ctx.json({ files: [], total: 0 });
          }

          where.push({
            field: "connectedAccountId",
            operator: "in",
            value: accounts.map((a: any) => a.id),
          });
        }

        if (mimeType) {
          where.push({ field: "mimeType", value: mimeType });
        }

        if (parentId !== undefined) {
          where.push({ field: "parentId", value: parentId });
        }

        // Get files
        const files = await ctx.context.adapter.findMany({
          model: "syncedFile",
          where,
          limit,
          offset,
          orderBy: [{ field: "modifiedTime", direction: "desc" }],
        });

        // Get total count
        const countResult = await ctx.context.adapter.count({
          model: "syncedFile",
          where,
        });

        return ctx.json({
          files: files.map((file: any) => ({
            id: file.id,
            accountId: file.connectedAccountId,
            name: file.name,
            mimeType: file.mimeType,
            size: file.size,
            parentId: file.parentId,
            webUrl: file.webUrl,
            downloadUrl: file.downloadUrl,
            thumbnailUrl: file.thumbnailUrl,
            modifiedTime: file.modifiedTime,
            syncedAt: file.syncedAt,
          })),
          total: countResult,
        });
      },
    ),

    /**
     * Get file details
     */
    getFile: createAuthEndpoint(
      "/connect/files/:fileId",
      {
        method: "GET",
      },
      async (ctx) => {
        const session = await ctx.getSession();
        if (!session) {
          throw ctx.error("UNAUTHORIZED");
        }

        const file = await ctx.context.adapter.findOne({
          model: "syncedFile",
          where: [{ field: "id", value: ctx.params?.fileId }],
        });

        if (!file) {
          throw ctx.error("NOT_FOUND", {
            message: "File not found",
          });
        }

        // Verify user owns the account this file belongs to
        const account = await ctx.context.adapter.findOne({
          model: "connectedAccount",
          where: [
            { field: "id", value: file.connectedAccountId },
            { field: "userId", value: session.user.id },
          ],
        });

        if (!account) {
          throw ctx.error("NOT_FOUND", {
            message: "File not found",
          });
        }

        return ctx.json({
          file: {
            id: file.id,
            accountId: file.connectedAccountId,
            name: file.name,
            mimeType: file.mimeType,
            size: file.size,
            parentId: file.parentId,
            webUrl: file.webUrl,
            downloadUrl: file.downloadUrl,
            thumbnailUrl: file.thumbnailUrl,
            modifiedTime: file.modifiedTime,
            syncedAt: file.syncedAt,
            provider: account.provider,
            providerFileId: file.providerFileId,
            metadata: file.metadata,
          },
        });
      },
    ),
  };
}
