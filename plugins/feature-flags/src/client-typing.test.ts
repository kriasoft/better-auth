// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import { createAuthClient } from "better-auth/client";
import { expect, expectTypeOf, test } from "bun:test";
import { featureFlagsClient } from "./client";

test("should have correct feature flags client types", () => {
  const auth = createAuthClient({
    plugins: [featureFlagsClient()],
  });

  expect(auth.featureFlags).toBeDefined();

  expectTypeOf(auth.featureFlags.isEnabled).toBeFunction();
  expectTypeOf(auth.featureFlags.getValue).toBeFunction();
  expectTypeOf(auth.featureFlags.getVariant).toBeFunction();
  expectTypeOf(auth.featureFlags.getAllFlags).toBeFunction();
  expectTypeOf(auth.featureFlags.getFlags).toBeFunction();
  expectTypeOf(auth.featureFlags.trackEvent).toBeFunction();
  expectTypeOf(auth.featureFlags.setContext).toBeFunction();
  expectTypeOf(auth.featureFlags.getContext).toBeFunction();
  expectTypeOf(auth.featureFlags.prefetch).toBeFunction();
  expectTypeOf(auth.featureFlags.clearCache).toBeFunction();
  expectTypeOf(auth.featureFlags.setOverride).toBeFunction();
  expectTypeOf(auth.featureFlags.clearOverrides).toBeFunction();
  expectTypeOf(auth.featureFlags.refresh).toBeFunction();
  expectTypeOf(auth.featureFlags.subscribe).toBeFunction();
});

test("should support typed flag schemas", () => {
  interface MyFlags {
    "feature.darkMode": boolean;
    "experiment.algorithm": "A" | "B" | "C";
    "config.maxItems": number;
  }

  const auth = createAuthClient({
    plugins: [featureFlagsClient<MyFlags>()],
  });

  // Type-safe flag operations with schema
  expectTypeOf(auth.featureFlags.getValue).toBeFunction();
  expectTypeOf(auth.featureFlags.isEnabled).toBeFunction();
  expectTypeOf(auth.featureFlags.getFlags).toBeFunction();
});
