// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import type { BetterAuthClientPlugin } from "better-auth/client";

export interface AbuseDetectionClient {
  abuseDetection: {
    getRiskScore: () => Promise<{
      score: number;
      factors: Record<string, number>;
      requiresChallenge: boolean;
    }>;
    getThreatHistory: () => Promise<any[]>;
    getTrustedDevices: () => Promise<any[]>;
    trustDevice: (fingerprint: string) => Promise<void>;
    removeDevice: (fingerprint: string) => Promise<void>;
    reportSuspiciousActivity: (details: any) => Promise<void>;
  };
}

export function abuseDetectionClient(): BetterAuthClientPlugin {
  return {
    id: "abuse-detection",
    $InferServerPlugin: {} as any,
  };
}

export default abuseDetectionClient;
