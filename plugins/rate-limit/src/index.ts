// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import type { BetterAuthPlugin } from "better-auth";

export interface RateLimitOptions {
  strategy?: "fixed-window" | "sliding-window" | "token-bucket";
  store?: "memory" | "database" | "redis" | "custom";
  limits?: {
    global?: {
      window: number;
      max: number;
    };
    perUser?: {
      window: number;
      max: number;
    };
    endpoints?: {
      [path: string]: {
        window: number;
        max: number;
        skipSuccessfulAttempts?: boolean;
      };
    };
  };
  bypass?: {
    ips?: string[];
    userRoles?: string[];
    userIds?: string[];
  };
  onLimitReached?: (req: Request, info: any) => Promise<void>;
  customStore?: {
    get: (key: string) => Promise<any>;
    set: (key: string, value: any, ttl?: number) => Promise<void>;
    increment: (key: string, ttl?: number) => Promise<number>;
    delete: (key: string) => Promise<void>;
  };
}

export function rateLimit(options: RateLimitOptions = {}): BetterAuthPlugin {
  const strategy = options.strategy || "sliding-window";
  const store = options.store || "memory";

  return {
    id: "rate-limit",
    schema: {
      rateLimitRecord: {
        modelName: "rateLimitRecord",
        fields: {
          id: { type: "string" },
          identifier: { type: "string" }, // IP or userId
          endpoint: { type: "string" },
          count: { type: "number", defaultValue: 0 },
          windowStart: { type: "date" },
          windowEnd: { type: "date" },
          blocked: { type: "boolean", defaultValue: false },
          createdAt: { type: "date", defaultValue: new Date() },
          updatedAt: { type: "date", defaultValue: new Date() },
        },
      },
    },
    // Middleware and implementation would go here
  };
}

export default rateLimit;
