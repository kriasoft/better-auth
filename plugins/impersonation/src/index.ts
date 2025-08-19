// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import type { BetterAuthPlugin } from "better-auth";
import { z } from "zod";

export interface ImpersonationOptions {
  permissions?: {
    roles?: string[];
    userIds?: string[];
    customCheck?: (impersonator: any, target: any) => Promise<boolean>;
  };
  security?: {
    requireReason?: boolean;
    maxDuration?: number; // seconds
    notifyUser?: boolean;
    allowedActions?: ("read" | "write" | "delete")[];
    blockedPaths?: string[];
    requireMFA?: boolean;
  };
  audit?: {
    logAll?: boolean;
    includeActions?: boolean;
    retention?: number; // days
  };
  ui?: {
    showBanner?: boolean;
    bannerText?: string;
  };
  onImpersonationStart?: (session: any) => Promise<void>;
  onImpersonationEnd?: (session: any) => Promise<void>;
  onActionBlocked?: (action: string, session: any) => Promise<void>;
}

export function impersonation(
  options: ImpersonationOptions = {},
): BetterAuthPlugin {
  const {
    permissions = {},
    security = {
      requireReason: true,
      maxDuration: 30 * 60, // 30 minutes default
      notifyUser: false,
    },
    audit = {
      logAll: true,
      includeActions: true,
    },
  } = options;

  return {
    id: "impersonation",
    schema: {
      impersonationSession: {
        modelName: "impersonationSession",
        fields: {
          id: { type: "string" },
          impersonatorId: {
            type: "string",
            references: { model: "user", field: "id", onDelete: "cascade" },
          },
          targetUserId: {
            type: "string",
            references: { model: "user", field: "id", onDelete: "cascade" },
          },
          reason: { type: "string" },
          startedAt: { type: "date", defaultValue: new Date() },
          endedAt: { type: "date" },
          expiresAt: { type: "date" },
          active: { type: "boolean", defaultValue: true },
          ipAddress: { type: "string" },
          userAgent: { type: "string" },
        },
      },
      impersonationAuditLog: {
        modelName: "impersonationAuditLog",
        fields: {
          id: { type: "string" },
          sessionId: {
            type: "string",
            references: {
              model: "impersonationSession",
              field: "id",
              onDelete: "cascade",
            },
          },
          action: { type: "string" },
          path: { type: "string" },
          method: { type: "string" },
          statusCode: { type: "number" },
          metadata: { type: "string" }, // JSON
          timestamp: { type: "date", defaultValue: new Date() },
        },
      },
    },
    // Endpoints would be implemented here
    endpoints: {
      // startImpersonation: createAuthEndpoint(...)
      // endImpersonation: createAuthEndpoint(...)
      // getImpersonationSession: createAuthEndpoint(...)
    },
    // Middleware to track actions during impersonation
    hooks: {
      before: [
        {
          matcher: () => true,
          handler: async (ctx) => {
            // Check if current session is impersonation
            // Apply restrictions if needed
            // Log actions if audit is enabled
          },
        },
      ],
    },
  };
}

export default impersonation;
