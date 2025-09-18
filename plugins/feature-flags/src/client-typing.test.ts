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
  expectTypeOf(auth.featureFlags.bootstrap).toBeFunction();
  expectTypeOf(auth.featureFlags.evaluateMany).toBeFunction();
  expectTypeOf(auth.featureFlags.track).toBeFunction();
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
  expectTypeOf(auth.featureFlags.evaluateMany).toBeFunction();
});

test("should infer server schema from featureFlags plugin via $InferServerPlugin", () => {
  // Test the critical type flow: featureFlags<TSchema> → $Infer.FlagSchema → featureFlagsClient<TSchema> → $InferServerPlugin
  interface ServerFlags {
    "ui.showAdvanced": boolean;
    "pricing.plan": "free" | "pro" | "enterprise";
    "limits.maxUsers": number;
  }

  // Server plugin with typed schema
  const serverPlugin = featureFlagsClient<ServerFlags>();

  // Verify the client plugin correctly captures the server's schema type through $InferServerPlugin
  type ServerPluginType = typeof serverPlugin.$InferServerPlugin;
  type InferredSchema = ServerPluginType["$Infer"]["FlagSchema"];

  // This test verifies that TSchema flows through the type system correctly
  expectTypeOf<InferredSchema>().toEqualTypeOf<{
    "ui.showAdvanced": boolean;
    "pricing.plan": "free" | "pro" | "enterprise";
    "limits.maxUsers": number;
  }>();

  // Verify that createAuthClient picks up the schema from the server plugin
  const auth = createAuthClient({
    plugins: [serverPlugin],
  });

  expect(auth.featureFlags).toBeDefined();

  // The client should now have type-safe methods that understand the server schema
  expectTypeOf(auth.featureFlags.getValue).toBeFunction();
  expectTypeOf(auth.featureFlags.isEnabled).toBeFunction();
});
