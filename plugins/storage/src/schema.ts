// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import type { AuthPluginSchema } from "better-auth";

export const connectSchema = {
  connectedAccount: {
    modelName: "connectedAccount",
    fields: {
      userId: {
        type: "string",
        references: {
          model: "user",
          field: "id",
          onDelete: "cascade",
        },
      },
      provider: {
        type: "string",
      },
      providerAccountId: {
        type: "string",
      },
      providerAccountEmail: {
        type: "string",
        required: false,
      },
      accessToken: {
        type: "string",
      },
      refreshToken: {
        type: "string",
        required: false,
      },
      expiresAt: {
        type: "date",
        required: false,
      },
      scope: {
        type: "string",
        required: false,
      },
      lastSyncedAt: {
        type: "date",
        required: false,
      },
      createdAt: {
        type: "date",
      },
      updatedAt: {
        type: "date",
      },
    },
  },

  syncedFile: {
    modelName: "syncedFile",
    fields: {
      connectedAccountId: {
        type: "string",
        references: {
          model: "connectedAccount",
          field: "id",
          onDelete: "cascade",
        },
      },
      providerFileId: {
        type: "string",
      },
      name: {
        type: "string",
      },
      mimeType: {
        type: "string",
      },
      size: {
        type: "number",
      },
      parentId: {
        type: "string",
        required: false,
      },
      webUrl: {
        type: "string",
        required: false,
      },
      downloadUrl: {
        type: "string",
        required: false,
      },
      thumbnailUrl: {
        type: "string",
        required: false,
      },
      modifiedTime: {
        type: "date",
      },
      syncedAt: {
        type: "date",
      },
      metadata: {
        type: "string",
        required: false,
      },
    },
  },

  syncStatus: {
    modelName: "syncStatus",
    fields: {
      connectedAccountId: {
        type: "string",
        references: {
          model: "connectedAccount",
          field: "id",
          onDelete: "cascade",
        },
      },
      status: {
        type: "string",
      },
      filesProcessed: {
        type: "number",
        required: false,
      },
      filesTotal: {
        type: "number",
        required: false,
      },
      error: {
        type: "string",
        required: false,
      },
      startedAt: {
        type: "date",
      },
      completedAt: {
        type: "date",
        required: false,
      },
    },
  },
} satisfies AuthPluginSchema;
