// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import type { BetterAuthClientPlugin } from "better-auth/client";

export interface ConsentStatus {
  hasConsented: boolean;
  categories: Record<string, boolean>;
  services: string[];
  updatedAt: Date;
  expiresAt: Date;
}

export interface ConsentClient {
  consent: {
    getStatus: () => Promise<ConsentStatus>;
    updatePreferences: (categories: Record<string, boolean>) => Promise<void>;
    acceptAll: () => Promise<void>;
    rejectAll: () => Promise<void>;
    revokeAll: () => Promise<void>;
    isServiceAllowed: (service: string) => boolean;
    isCategoryAllowed: (category: string) => boolean;
    showBanner: () => void;
    hideBanner: () => void;
    showPreferences: () => void;
    getHistory: () => Promise<any[]>;
    on: (
      event: "change" | "accept" | "reject",
      callback: (data: any) => void,
    ) => void;
    off: (event: string, callback: (data: any) => void) => void;
  };
}

export function consentClient(): BetterAuthClientPlugin {
  return {
    id: "consent",
    $InferServerPlugin: {} as any,
  };
}

export default consentClient;
