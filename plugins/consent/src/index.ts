// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import type { BetterAuthPlugin } from "better-auth";
import { z } from "zod";

export interface ConsentCategory {
  label: string;
  description: string;
  required?: boolean;
  default?: boolean;
  services?: string[];
}

export interface ConsentOptions {
  categories?: {
    necessary?: ConsentCategory;
    analytics?: ConsentCategory;
    marketing?: ConsentCategory;
    functional?: ConsentCategory;
    [key: string]: ConsentCategory | undefined;
  };
  banner?: {
    position?: "bottom" | "top" | "center";
    theme?: "light" | "dark" | "auto";
    logo?: string;
    privacyPolicy?: string;
    cookiePolicy?: string;
    rejectButton?: boolean;
    customizeButton?: boolean;
    autoShow?: boolean;
    delay?: number; // milliseconds before showing
  };
  behavior?: {
    acceptOnScroll?: boolean;
    acceptOnNavigate?: boolean;
    reloadOnChange?: boolean;
    cookieExpiry?: number; // days
    regionDetection?: boolean;
    blockUntilConsent?: boolean;
  };
  text?: {
    title?: string;
    description?: string;
    acceptButton?: string;
    rejectButton?: string;
    customizeButton?: string;
    saveButton?: string;
  };
  onAccept?: (categories: Record<string, boolean>) => Promise<void>;
  onReject?: () => Promise<void>;
  onChange?: (categories: Record<string, boolean>) => Promise<void>;
  onServiceAllowed?: (service: string) => Promise<void>;
  onServiceBlocked?: (service: string) => Promise<void>;
}

export function consent(options: ConsentOptions = {}): BetterAuthPlugin {
  const {
    categories = {
      necessary: {
        label: "Necessary",
        description: "Essential cookies for website functionality",
        required: true,
      },
      analytics: {
        label: "Analytics",
        description: "Help us improve our website",
        default: false,
      },
      marketing: {
        label: "Marketing",
        description: "Personalized ads and content",
        default: false,
      },
      functional: {
        label: "Functional",
        description: "Enhanced functionality",
        default: false,
      },
    },
    banner = {
      position: "bottom",
      theme: "light",
      autoShow: true,
      rejectButton: true,
      customizeButton: true,
    },
    behavior = {
      acceptOnScroll: false,
      acceptOnNavigate: false,
      reloadOnChange: false,
      cookieExpiry: 365,
      regionDetection: false,
    },
  } = options;

  // Helper to check if in EU or California (simplified)
  const requiresConsent = (region?: string): boolean => {
    if (!behavior.regionDetection) return true;
    const euCountries = [
      "AT",
      "BE",
      "BG",
      "HR",
      "CY",
      "CZ",
      "DK",
      "EE",
      "FI",
      "FR",
      "DE",
      "GR",
      "HU",
      "IE",
      "IT",
      "LV",
      "LT",
      "LU",
      "MT",
      "NL",
      "PL",
      "PT",
      "RO",
      "SK",
      "SI",
      "ES",
      "SE",
    ];
    return euCountries.includes(region || "") || region === "CA";
  };

  return {
    id: "consent",
    schema: {
      consentRecord: {
        modelName: "consentRecord",
        fields: {
          id: { type: "string" },
          userId: {
            type: "string",
            references: { model: "user", field: "id", onDelete: "cascade" },
          },
          sessionId: { type: "string" }, // For anonymous users
          categories: { type: "string" }, // JSON object with consent states
          services: { type: "string" }, // JSON array of allowed services
          ipAddress: { type: "string" },
          userAgent: { type: "string" },
          region: { type: "string" }, // Detected region
          version: { type: "string" }, // Privacy policy version
          createdAt: { type: "date", defaultValue: new Date() },
          updatedAt: { type: "date", defaultValue: new Date() },
          expiresAt: { type: "date" },
        },
      },
      consentHistory: {
        modelName: "consentHistory",
        fields: {
          id: { type: "string" },
          recordId: {
            type: "string",
            references: {
              model: "consentRecord",
              field: "id",
              onDelete: "cascade",
            },
          },
          action: { type: "string" }, // accept, reject, update
          categories: { type: "string" }, // JSON object
          timestamp: { type: "date", defaultValue: new Date() },
        },
      },
    },
    // Endpoints for consent management
    endpoints: {
      // getConsent: createAuthEndpoint(...)
      // updateConsent: createAuthEndpoint(...)
      // getConsentHistory: createAuthEndpoint(...)
    },
    // Middleware to check consent
    hooks: {
      before: [
        {
          matcher: () => true,
          handler: async (ctx) => {
            // Check consent status
            // Block services if not consented
          },
        },
      ],
    },
  };
}

export default consent;
