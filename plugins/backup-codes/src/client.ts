// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import type { BetterAuthClientPlugin } from "better-auth/client";

export interface BackupCodesClient {
  backupCodes: {
    generate: (password?: string) => Promise<{
      codes: string[];
      remaining: number;
    }>;
    verify: (code: string) => Promise<{
      valid: boolean;
      remaining: number;
    }>;
    getStatus: () => Promise<{
      enabled: boolean;
      remaining: number;
      total: number;
      lastUsed?: Date;
    }>;
    regenerate: (password: string) => Promise<{
      codes: string[];
    }>;
    download: (format: "txt" | "pdf") => Promise<Blob>;
  };
}

export function backupCodesClient(): BetterAuthClientPlugin {
  return {
    id: "backup-codes",
    $InferServerPlugin: {} as any,
  };
}

export default backupCodesClient;
