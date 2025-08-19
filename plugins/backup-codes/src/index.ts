// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import type { BetterAuthPlugin } from "better-auth";
import { z } from "zod";

export interface BackupCodesOptions {
  codes?: {
    count?: number; // Number of codes to generate
    length?: number; // Length of each code
    format?: string; // Format like "XXXX-XXXX"
    charset?: string; // Characters to use
  };
  security?: {
    hashCodes?: boolean; // Store hashed codes
    oneTimeUse?: boolean; // Each code can only be used once
    requireCurrentPassword?: boolean; // Require password to view codes
    notifyOnUse?: boolean; // Notify when backup code is used
    expirationDays?: number; // Optional expiration
  };
  warnings?: {
    lowCodeThreshold?: number; // Warn when X codes remain
    forceRegenerate?: number; // Force regeneration at X codes
  };
  onCodeUsed?: (user: any, code: string) => Promise<void>;
  onCodesRegenerated?: (user: any) => Promise<void>;
  onLowCodes?: (user: any, remaining: number) => Promise<void>;
}

export function backupCodes(
  options: BackupCodesOptions = {},
): BetterAuthPlugin {
  const {
    codes = {
      count: 10,
      length: 8,
      format: "XXXX-XXXX",
      charset: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
    },
    security = {
      hashCodes: true,
      oneTimeUse: true,
      requireCurrentPassword: true,
      notifyOnUse: true,
    },
    warnings = {
      lowCodeThreshold: 3,
      forceRegenerate: 0,
    },
  } = options;

  // Helper functions (internal use)
  const generateCode = (format: string, charset: string): string => {
    // Generate a single backup code based on format
    return format.replace(/X/g, () => {
      const randomIndex = Math.floor(Math.random() * charset.length);
      return charset[randomIndex];
    });
  };

  const hashCode = async (code: string, salt: string): Promise<string> => {
    // Hash the backup code with salt
    // Implementation would use crypto functions
    return "";
  };

  const verifyCode = async (
    inputCode: string,
    hashedCode: string,
    salt: string,
  ): Promise<boolean> => {
    // Verify input code against hashed code
    return false;
  };

  return {
    id: "backup-codes",
    schema: {
      backupCode: {
        modelName: "backupCode",
        fields: {
          id: { type: "string" },
          userId: {
            type: "string",
            references: { model: "user", field: "id", onDelete: "cascade" },
          },
          code: { type: "string" }, // Hashed if security.hashCodes is true
          salt: { type: "string" }, // Salt for hashing
          used: { type: "boolean", defaultValue: false },
          usedAt: { type: "date" },
          expiresAt: { type: "date" },
          createdAt: { type: "date", defaultValue: new Date() },
        },
      },
      backupCodeEvent: {
        modelName: "backupCodeEvent",
        fields: {
          id: { type: "string" },
          userId: {
            type: "string",
            references: { model: "user", field: "id", onDelete: "cascade" },
          },
          event: { type: "string" }, // generated, used, regenerated, viewed
          codeId: { type: "string" },
          ipAddress: { type: "string" },
          userAgent: { type: "string" },
          metadata: { type: "string" }, // JSON metadata
          createdAt: { type: "date", defaultValue: new Date() },
        },
      },
    },
    // Endpoints would be implemented here
    endpoints: {
      // generateBackupCodes: createAuthEndpoint(...)
      // verifyBackupCode: createAuthEndpoint(...)
      // getBackupCodesStatus: createAuthEndpoint(...)
      // regenerateBackupCodes: createAuthEndpoint(...)
    },
    // Middleware to check for low codes
    hooks: {
      after: [
        {
          matcher: (ctx) =>
            ctx.path === "/sign-in" || ctx.path === "/verify-2fa",
          handler: async (ctx) => {
            // Check remaining backup codes and warn if low
            // Can use helper functions here: generateCode, hashCode, verifyCode
          },
        },
      ],
    },
  };
}

export default backupCodes;
