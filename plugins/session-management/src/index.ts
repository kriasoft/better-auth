// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import type { BetterAuthPlugin } from "better-auth";

export interface SessionManagementOptions {
  maxConcurrentSessions?: number;
  maxSessionsPerDevice?: number;
  idleTimeout?: number;
  absoluteTimeout?: number;
  deviceFingerprinting?: boolean;
  locationTracking?: {
    enabled?: boolean;
    anomalyDetection?: boolean;
  };
  security?: {
    detectHijacking?: boolean;
    requireReauthForSensitive?: boolean;
    notifyNewDevice?: boolean;
  };
  events?: {
    onNewDevice?: (session: any, device: any) => Promise<void>;
    onSuspiciousActivity?: (session: any, reason: string) => Promise<void>;
    onSessionExpired?: (session: any) => Promise<void>;
  };
}

export function sessionManagement(
  options: SessionManagementOptions = {},
): BetterAuthPlugin {
  return {
    id: "session-management",
    schema: {
      device: {
        modelName: "device",
        fields: {
          id: { type: "string" },
          userId: {
            type: "string",
            references: { model: "user", field: "id", onDelete: "cascade" },
          },
          fingerprint: { type: "string" },
          userAgent: { type: "string" },
          browser: { type: "string" },
          os: { type: "string" },
          device: { type: "string" },
          trusted: { type: "boolean", defaultValue: false },
          lastActiveAt: { type: "date" },
          createdAt: { type: "date", defaultValue: new Date() },
        },
      },
      sessionActivity: {
        modelName: "sessionActivity",
        fields: {
          id: { type: "string" },
          sessionId: {
            type: "string",
            references: { model: "session", field: "id", onDelete: "cascade" },
          },
          deviceId: {
            type: "string",
            references: { model: "device", field: "id", onDelete: "set null" },
          },
          ipAddress: { type: "string" },
          location: { type: "string" }, // JSON with country, city, etc.
          activity: { type: "string" },
          suspicious: { type: "boolean", defaultValue: false },
          createdAt: { type: "date", defaultValue: new Date() },
        },
      },
    },
    // Implementation would go here
  };
}

export default sessionManagement;
