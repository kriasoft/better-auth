// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import type { BetterAuthPlugin } from "better-auth";
import { z } from "zod";

export interface AbuseDetectionOptions {
  strategies?: {
    credentialStuffing?: {
      enabled?: boolean;
      threshold?: number;
      windowMinutes?: number;
    };
    velocityCheck?: {
      enabled?: boolean;
      maxSignIns?: number;
      windowMinutes?: number;
    };
    impossibleTravel?: {
      enabled?: boolean;
      speedKmh?: number;
    };
    deviceAnomaly?: {
      enabled?: boolean;
      requireKnownDevice?: boolean;
    };
    behavioralAnalysis?: {
      enabled?: boolean;
      factors?: string[];
    };
  };
  riskScoring?: {
    enabled?: boolean;
    blockThreshold?: number;
    challengeThreshold?: number;
    factors?: {
      newDevice?: number;
      newLocation?: number;
      vpnUsage?: number;
      failedAttempts?: number;
      [key: string]: number | undefined;
    };
  };
  actions?: {
    block?: {
      duration?: number;
      message?: string;
    };
    challenge?: {
      types?: ("captcha" | "email" | "sms" | "totp")[];
    };
    notify?: {
      user?: boolean;
      admin?: boolean;
    };
  };
  ml?: {
    enabled?: boolean;
    modelUrl?: string;
    features?: string[];
  };
  onThreatDetected?: (threat: any) => Promise<void>;
  onAccountCompromised?: (user: any) => Promise<void>;
  onRiskScoreCalculated?: (score: number, factors: any) => Promise<void>;
}

export function abuseDetection(
  options: AbuseDetectionOptions = {},
): BetterAuthPlugin {
  const {
    strategies = {
      credentialStuffing: { enabled: true, threshold: 5, windowMinutes: 10 },
      velocityCheck: { enabled: true, maxSignIns: 10, windowMinutes: 5 },
      impossibleTravel: { enabled: true, speedKmh: 1000 },
      deviceAnomaly: { enabled: true },
      behavioralAnalysis: { enabled: false },
    },
    riskScoring = {
      enabled: true,
      blockThreshold: 0.9,
      challengeThreshold: 0.7,
    },
    actions = {
      block: { duration: 3600 },
      challenge: { types: ["captcha"] },
      notify: { user: true, admin: false },
    },
  } = options;

  // Helper functions
  const calculateRiskScore = (factors: Record<string, number>): number => {
    // Calculate weighted risk score
    let score = 0;
    const weights = riskScoring.factors || {};
    for (const [factor, value] of Object.entries(factors)) {
      score += value * (weights[factor] || 0.1);
    }
    return Math.min(score, 1.0);
  };

  const detectImpossibleTravel = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
    timeDiffHours: number,
  ): boolean => {
    // Haversine formula to calculate distance
    const R = 6371; // Earth's radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    const speed = distance / timeDiffHours;
    return speed > (strategies.impossibleTravel?.speedKmh || 1000);
  };

  return {
    id: "abuse-detection",
    schema: {
      threatEvent: {
        modelName: "threatEvent",
        fields: {
          id: { type: "string" },
          userId: {
            type: "string",
            references: { model: "user", field: "id", onDelete: "cascade" },
          },
          type: { type: "string" }, // credential_stuffing, impossible_travel, etc.
          severity: { type: "string" }, // low, medium, high, critical
          riskScore: { type: "number" },
          ipAddress: { type: "string" },
          userAgent: { type: "string" },
          location: { type: "string" }, // JSON with lat, lon, country, city
          deviceFingerprint: { type: "string" },
          action: { type: "string" }, // blocked, challenged, allowed
          metadata: { type: "string" }, // JSON with additional data
          detectedAt: { type: "date", defaultValue: new Date() },
        },
      },
      deviceTrust: {
        modelName: "deviceTrust",
        fields: {
          id: { type: "string" },
          userId: {
            type: "string",
            references: { model: "user", field: "id", onDelete: "cascade" },
          },
          fingerprint: { type: "string" },
          trustScore: { type: "number" },
          lastSeen: { type: "date" },
          firstSeen: { type: "date", defaultValue: new Date() },
          metadata: { type: "string" }, // JSON with device info
        },
      },
      blockedEntity: {
        modelName: "blockedEntity",
        fields: {
          id: { type: "string" },
          type: { type: "string" }, // ip, email, fingerprint
          value: { type: "string" },
          reason: { type: "string" },
          expiresAt: { type: "date" },
          createdAt: { type: "date", defaultValue: new Date() },
        },
      },
    },
    // Hooks to analyze authentication attempts
    hooks: {
      before: [
        {
          matcher: (ctx) => ctx.path === "/sign-in" || ctx.path === "/sign-up",
          handler: async (ctx) => {
            // Analyze request for abuse patterns
            // Calculate risk score
            // Block or challenge if necessary
          },
        },
      ],
      after: [
        {
          matcher: (ctx) => ctx.path === "/sign-in",
          handler: async (ctx) => {
            // Track successful/failed attempts
            // Update device trust
            // Check for anomalies
          },
        },
      ],
    },
  };
}

export default abuseDetection;
