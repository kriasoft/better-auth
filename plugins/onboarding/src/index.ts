// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import type { BetterAuthPlugin } from "better-auth";

export interface OnboardingStep {
  id: string;
  title: string;
  description?: string;
  required?: boolean;
  fields?: string[];
  condition?: (user: any) => boolean;
  validation?: (data: any) => boolean | string;
}

export interface OnboardingFlow {
  steps: OnboardingStep[];
  completionRedirect?: string;
}

export interface OnboardingOptions {
  flows?: {
    [key: string]: OnboardingFlow;
  };
  defaultFlow?: string;
  emails?: {
    welcome?: boolean;
    reminders?: boolean;
    completion?: boolean;
  };
  analytics?: {
    trackProgress?: boolean;
    trackTime?: boolean;
    trackDropOff?: boolean;
  };
  gamification?: {
    enabled?: boolean;
    achievements?: Array<{
      id: string;
      name: string;
      description: string;
      condition: string; // e.g., "complete_profile"
    }>;
  };
}

export function onboarding(options: OnboardingOptions = {}): BetterAuthPlugin {
  return {
    id: "onboarding",
    schema: {
      onboardingProgress: {
        modelName: "onboardingProgress",
        fields: {
          id: { type: "string" },
          userId: {
            type: "string",
            references: { model: "user", field: "id", onDelete: "cascade" },
          },
          flow: { type: "string" },
          currentStep: { type: "string" },
          completedSteps: { type: "string" }, // JSON array
          data: { type: "string" }, // JSON object with collected data
          completed: { type: "boolean", defaultValue: false },
          completedAt: { type: "date" },
          startedAt: { type: "date", defaultValue: new Date() },
          updatedAt: { type: "date", defaultValue: new Date() },
        },
      },
      onboardingAchievement: {
        modelName: "onboardingAchievement",
        fields: {
          id: { type: "string" },
          userId: {
            type: "string",
            references: { model: "user", field: "id", onDelete: "cascade" },
          },
          achievementId: { type: "string" },
          unlockedAt: { type: "date", defaultValue: new Date() },
        },
      },
    },
    // Implementation would go here
  };
}

export default onboarding;
