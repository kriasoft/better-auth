// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import type { BetterAuthPlugin } from "better-auth";

export interface FraudProvider {
  service: string;
  apiKey: string;
  [key: string]: any;
}

export interface FraudDetectionOptions {
  providers?: {
    ipReputation?: FraudProvider;
    deviceFingerprint?: FraudProvider;
    mlScoring?: FraudProvider;
  };
  rules?: {
    blockThreshold?: number;
    mfaThreshold?: number;
    challengeThreshold?: number;
  };
  signals?: {
    newDevice?: boolean;
    newLocation?: boolean;
    impossibleTravel?: boolean;
    bruteForce?: boolean;
    credentialStuffing?: boolean;
    suspiciousUserAgent?: boolean;
  };
  actions?: {
    block?: {
      message?: string;
    };
    challenge?: {
      type: "recaptcha" | "hcaptcha" | "turnstile";
      siteKey: string;
    };
  };
}

export function fraudDetectionPlugin(
  options?: FraudDetectionOptions,
): BetterAuthPlugin {
  return {
    id: "fraud-detection",
    init() {
      // Initialize fraud detection providers
    },
    hooks: {
      before: [
        {
          matcher(ctx) {
            // Check auth-related endpoints
            return ctx.path === "/sign-in" || ctx.path === "/sign-up";
          },
          handler: async (ctx) => {
            // TODO: Perform fraud checks before auth
            return;
          },
        },
      ],
    },
  };
}
