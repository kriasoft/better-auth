// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import type { BetterAuthClientPlugin } from "better-auth/client";

export interface SessionManagementClient {
  sessionManagement: {
    getSessions: () => Promise<any[]>;
    getDevices: () => Promise<any[]>;
    revokeSession: (sessionId: string) => Promise<void>;
    revokeDevice: (deviceId: string) => Promise<void>;
    trustDevice: (deviceId: string) => Promise<void>;
    getSessionActivity: (sessionId?: string) => Promise<any[]>;
  };
}

export function sessionManagementClient(): BetterAuthClientPlugin {
  return {
    id: "session-management",
    $InferServerPlugin: {} as any,
  };
}

export default sessionManagementClient;
