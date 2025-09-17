// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import { describe, expect, it } from "bun:test";
import { featureFlags } from "./index";

describe("feature-flags plugin — endpoints exposure and lazy context", () => {
  it("exposes endpoints before init (no race with init)", () => {
    const plugin = featureFlags({ storage: "memory" });
    const endpoints = plugin.endpoints as Record<string, any>;

    expect(endpoints).toBeDefined();
    // Key user endpoints (canonical structure)
    expect(typeof endpoints.evaluateFeatureFlag).toBe("function");
    expect(typeof endpoints.evaluateFeatureFlags).toBe("function");
    expect(typeof endpoints.bootstrapFeatureFlags).toBe("function");
    // Admin endpoints (canonical structure)
    expect(typeof endpoints.listFeatureFlags).toBe("function");
    expect(typeof endpoints.createFeatureFlag).toBe("function");
  });

  it("invoking an endpoint before init returns an error response", async () => {
    const plugin = featureFlags({ storage: "memory" });
    const endpoints = plugin.endpoints as any;

    // Minimal context to pass zod validation and reach lazy context access
    const ctx = {
      body: { flagKey: "test-flag" },
      headers: new Headers(),
      context: {},
      json: (data: any) => data, // Mock json response method
    } as any;

    // The endpoint should handle the initialization error gracefully
    const result = await endpoints.evaluateFeatureFlag(ctx);

    // Should return error response instead of throwing
    expect(result).toBeDefined();
    expect(result.error).toBe("EVALUATION_ERROR");
    expect(result.message).toBe("Failed to evaluate flag");
  });
});
