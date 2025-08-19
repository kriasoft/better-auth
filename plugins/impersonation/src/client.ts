// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import type { BetterAuthClientPlugin } from "better-auth/client";

export interface ImpersonationClient {
  impersonation: {
    start: (
      userId: string,
      reason?: string,
    ) => Promise<{
      success: boolean;
      sessionId: string;
    }>;
    end: () => Promise<void>;
    isImpersonating: () => Promise<boolean>;
    getCurrentSession: () => Promise<{
      impersonatorId: string;
      targetUserId: string;
      startedAt: Date;
      expiresAt: Date;
    } | null>;
  };
}

export function impersonationClient(): BetterAuthClientPlugin {
  return {
    id: "impersonation",
    $InferServerPlugin: {} as any,
  };
}

export default impersonationClient;
