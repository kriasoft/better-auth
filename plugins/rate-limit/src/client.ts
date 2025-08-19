// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import type { BetterAuthClientPlugin } from "better-auth/client";

export interface RateLimitClient {
  rateLimit: {
    getStatus: () => Promise<{
      remaining: number;
      limit: number;
      reset: Date;
    }>;
  };
}

export function rateLimitClient(): BetterAuthClientPlugin {
  return {
    id: "rate-limit",
    $InferServerPlugin: {} as any,
  };
}

export default rateLimitClient;
