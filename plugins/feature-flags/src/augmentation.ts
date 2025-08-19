// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

/**
 * Module augmentation for Better Auth types
 * This extends Better Auth's built-in types with feature flags support
 */
declare module "better-auth" {
  // These interfaces are extended but may already be defined
  // Commenting out to avoid duplicate identifier errors
  // /**
  //  * Extend the session object with feature flags methods
  //  */
  // interface Session {
  //   featureFlags?: {
  //     flags: Record<string, { value: any; variant?: string; reason: string }>;
  //     isEnabled: (key: string) => boolean;
  //     getValue: (key: string, defaultValue?: any) => any;
  //     getVariant: (key: string) => string | undefined;
  //     context: EvaluationContext;
  //   };
  // }
  // /**
  //  * Extend the auth context with feature flags
  //  */
  // interface AuthContext {
  //   featureFlags?: FeatureFlagsContext["featureFlags"];
  // }
  // /**
  //  * Extend the hook endpoint context
  //  */
  // interface HookEndpointContext {
  //   featureFlags?: FeatureFlagsContext["featureFlags"];
  //   admin?: {
  //     userId: string;
  //     roles: string[];
  //     isAdmin: boolean;
  //   };
  //   session?: Session;
  //   auth?: {
  //     getSession?: () => Promise<Session | null>;
  //   };
  //   getSession?: () => Promise<Session | null>;
  // }
}

export {};
