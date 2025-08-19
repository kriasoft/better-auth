// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import type { BetterAuthClientPlugin } from "better-auth/client";

export interface OnboardingClient {
  onboarding: {
    getProgress: () => Promise<any>;
    getCurrentStep: () => Promise<any>;
    completeStep: (stepId: string, data?: any) => Promise<any>;
    skipStep: (stepId: string) => Promise<any>;
    restartOnboarding: () => Promise<void>;
    getAchievements: () => Promise<any[]>;
  };
}

export function onboardingClient(): BetterAuthClientPlugin {
  return {
    id: "onboarding",
    $InferServerPlugin: {} as any,
  };
}

export default onboardingClient;
