// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

/**
 * Simplified type regression tests for the featureFlags plugin
 *
 * This file tests the core issue that was fixed: ensuring that adding the
 * featureFlags plugin doesn't cause "excessively deep type instantiation" errors
 * and that all auth.api methods remain available.
 *
 * Run with: bun test src/type-regression.test.ts --run
 */

import { test, expect } from "bun:test";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins";
import { db } from "@repo/db";
import { featureFlags } from "../../../src";

// Use real database from @repo/db with drizzle adapter
const mockDbConfig = {
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
};

test("Feature flags plugin doesn't break core auth methods", () => {
  // This should not cause TypeScript compilation errors
  const auth = betterAuth({
    ...mockDbConfig,
    plugins: [
      featureFlags({
        storage: "memory",
        flags: {
          "test-flag": { default: true },
          theme: { default: "dark" },
        },
      }),
    ],
  });

  // Core methods should be available
  expect(typeof auth.api.getSession).toBe("function");
  expect(typeof auth.api.signUpEmail).toBe("function");
  expect(typeof auth.api.signInEmail).toBe("function");
  expect(typeof auth.api.signOut).toBe("function");

  // Feature flags methods should be available
  expect(typeof auth.api.evaluateFeatureFlag).toBe("function");
  expect(typeof auth.api.evaluateFeatureFlags).toBe("function");
  expect(typeof auth.api.createFeatureFlag).toBe("function");

  // Count total methods to ensure none are missing
  const methodCount = Object.keys(auth.api).length;
  expect(methodCount).toBeGreaterThan(30); // Should have many methods available
});

test("Organization + feature flags combination works", () => {
  // This combination previously caused the "excessively deep" error
  const auth = betterAuth({
    ...mockDbConfig,
    plugins: [
      organization(),
      featureFlags({
        storage: "memory",
        flags: {
          "org-feature": { default: false },
        },
      }),
    ],
  });

  // Core methods
  expect(typeof auth.api.getSession).toBe("function");
  expect(typeof auth.api.signUpEmail).toBe("function");

  // Organization methods
  expect(typeof auth.api.createOrganization).toBe("function");
  expect(typeof auth.api.updateOrganization).toBe("function");
  expect(typeof auth.api.deleteOrganization).toBe("function");

  // Feature flags methods
  expect(typeof auth.api.evaluateFeatureFlag).toBe("function");
  expect(typeof auth.api.evaluateFeatureFlags).toBe("function");

  // Should have even more methods with both plugins
  const methodCount = Object.keys(auth.api).length;
  expect(methodCount).toBeGreaterThan(50);
});

test("Complex flag configurations don't cause issues", () => {
  // Test with complex nested structures that previously caused problems
  const auth = betterAuth({
    ...mockDbConfig,
    plugins: [
      featureFlags({
        storage: "memory",
        flags: {
          "complex-config": {
            default: {
              theme: "dark",
              features: {
                analytics: true,
                notifications: false,
              },
              limits: {
                users: 100,
                storage: 1024,
              },
            },
          },
          "array-flag": {
            default: ["option1", "option2", "option3"],
          },
          "union-flag": {
            default: "A" as "A" | "B" | "C",
          },
        },
      }),
    ],
  });

  expect(typeof auth.api.getSession).toBe("function");
  expect(typeof auth.api.evaluateFeatureFlags).toBe("function");

  // Type inference is compile-time only, verify runtime API exists
  expect(typeof auth.api.evaluateFeatureFlag).toBe("function");
});

test("Empty and minimal configurations work", () => {
  const authEmpty = betterAuth({
    ...mockDbConfig,
    plugins: [featureFlags()],
  });

  const authMinimal = betterAuth({
    ...mockDbConfig,
    plugins: [featureFlags({ storage: "memory" })],
  });

  expect(typeof authEmpty.api.getSession).toBe("function");
  expect(typeof authEmpty.api.evaluateFeatureFlags).toBe("function");

  expect(typeof authMinimal.api.getSession).toBe("function");
  expect(typeof authMinimal.api.evaluateFeatureFlags).toBe("function");
});

test("Plugin endpoints are properly exposed", () => {
  const plugin = featureFlags({
    flags: { test: { default: false } },
  });

  // Should have the expected endpoint structure
  expect(plugin.endpoints).toBeDefined();
  expect(typeof plugin.endpoints.evaluateFeatureFlag).toBe("function");
  expect(typeof plugin.endpoints.evaluateFeatureFlags).toBe("function");
  expect(typeof plugin.endpoints.createFeatureFlag).toBe("function");
  expect(typeof plugin.endpoints.updateFeatureFlag).toBe("function");
  expect(typeof plugin.endpoints.deleteFeatureFlag).toBe("function");

  // Should have $Infer property
  expect(plugin.$Infer).toBeDefined();
  expect(plugin.$Infer.FlagSchema).toBeDefined();
});

test("InferFlagSchemaFromOptions helper type works at runtime", () => {
  // Test the type helper we created
  const plugin1 = featureFlags({
    flags: {
      "boolean-flag": { default: true },
      "string-flag": { default: "value" },
      "number-flag": { default: 42 },
    },
  });

  const plugin2 = featureFlags({
    flags: {
      "complex-flag": {
        default: {
          nested: { value: "test" },
          array: [1, 2, 3],
        },
      },
    },
  });

  // Both should work without issues
  expect(plugin1.$Infer.FlagSchema).toBeDefined();
  expect(plugin2.$Infer.FlagSchema).toBeDefined();
});
