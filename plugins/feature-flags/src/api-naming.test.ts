// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import { describe, expect, it, mock } from "bun:test";
import { featureFlagsClient } from "./client";

// Mock fetch for API endpoint testing - simulates server responses
const mockFetch = mock((url: string, _options: any) => {
  // Route-specific responses for testing API contracts
  if (url.includes("/events")) {
    return Promise.resolve({
      data: {
        success: true,
        eventId: "test-event-id",
      },
    });
  }

  // Fallback response for non-events endpoints
  return Promise.resolve({
    data: {
      value: "test-value",
      reason: "default",
      flags: { testFlag: { value: true, reason: "default" } },
    },
  });
});

describe("Feature Flags API Naming", () => {
  const plugin = featureFlagsClient({ debug: true });

  const mockActions = plugin.getActions(mockFetch, {}, {});

  describe("Canonical Public API (v0.3.0)", () => {
    it("should provide evaluate method (canonical for single flag)", async () => {
      expect(typeof mockActions.featureFlags.evaluate).toBe("function");

      const result = await mockActions.featureFlags.evaluate("testFlag");
      expect(result).toHaveProperty("value");
      expect(result).toHaveProperty("reason");
    });

    it("should provide evaluateMany method (canonical for batch evaluation)", async () => {
      expect(typeof mockActions.featureFlags.evaluateMany).toBe("function");

      const result = await mockActions.featureFlags.evaluateMany([
        "flag1",
        "flag2",
      ]);
      expect(result).toBeDefined();
    });

    it("should provide bootstrap method (canonical for all flags)", async () => {
      expect(typeof mockActions.featureFlags.bootstrap).toBe("function");

      const result = await mockActions.featureFlags.bootstrap();
      expect(result).toBeDefined();
    });

    it("should provide track method (canonical for event tracking)", async () => {
      expect(typeof mockActions.featureFlags.track).toBe("function");

      const result = await mockActions.featureFlags.track("testFlag", "click");
      expect(result).toHaveProperty("success");
      expect(result).toHaveProperty("eventId");
    });
  });

  describe("Canonical Admin Namespace (v0.3.0)", () => {
    it("should provide admin namespace with grouped methods", () => {
      expect(mockActions.featureFlags.admin).toBeDefined();
      expect(typeof mockActions.featureFlags.admin).toBe("object");
    });

    describe("admin.flags namespace", () => {
      it("should provide flags namespace methods", () => {
        const flags = mockActions.featureFlags.admin.flags;
        expect(flags).toBeDefined();
        expect(typeof flags.list).toBe("function");
        expect(typeof flags.create).toBe("function");
        expect(typeof flags.get).toBe("function");
        expect(typeof flags.update).toBe("function");
        expect(typeof flags.delete).toBe("function");
        expect(typeof flags.enable).toBe("function");
        expect(typeof flags.disable).toBe("function");
      });

      it("should execute admin.flags.list correctly", async () => {
        const result = await mockActions.featureFlags.admin.flags.list();
        expect(result).toBeDefined();
      });

      it("should execute admin.flags.create correctly", async () => {
        const flagData = {
          key: "test-flag",
          name: "Test Flag",
          type: "boolean" as const,
          defaultValue: false,
        };
        const result =
          await mockActions.featureFlags.admin.flags.create(flagData);
        expect(result).toBeDefined();
      });
    });

    describe("admin.rules namespace", () => {
      it("should provide rules namespace methods", () => {
        const rules = mockActions.featureFlags.admin.rules;
        expect(rules).toBeDefined();
        expect(typeof rules.list).toBe("function");
        expect(typeof rules.create).toBe("function");
        expect(typeof rules.get).toBe("function");
        expect(typeof rules.update).toBe("function");
        expect(typeof rules.delete).toBe("function");
        expect(typeof rules.reorder).toBe("function");
      });
    });

    describe("admin.overrides namespace", () => {
      it("should provide overrides namespace methods", () => {
        const overrides = mockActions.featureFlags.admin.overrides;
        expect(overrides).toBeDefined();
        expect(typeof overrides.list).toBe("function");
        expect(typeof overrides.create).toBe("function");
        expect(typeof overrides.get).toBe("function");
        expect(typeof overrides.update).toBe("function");
        expect(typeof overrides.delete).toBe("function");
      });
    });

    describe("admin.analytics namespace", () => {
      it("should provide analytics namespace methods", () => {
        const analytics = mockActions.featureFlags.admin.analytics;
        expect(analytics).toBeDefined();
        expect(analytics.stats).toBeDefined();
        expect(analytics.usage).toBeDefined();
        expect(typeof analytics.stats.get).toBe("function");
        expect(typeof analytics.usage.get).toBe("function");
      });
    });

    describe("admin.audit namespace", () => {
      it("should provide audit namespace methods", () => {
        const audit = mockActions.featureFlags.admin.audit;
        expect(audit).toBeDefined();
        expect(typeof audit.list).toBe("function");
        expect(typeof audit.get).toBe("function");
      });
    });

    describe("admin.environments namespace", () => {
      it("should provide environments namespace methods", () => {
        const environments = mockActions.featureFlags.admin.environments;
        expect(environments).toBeDefined();
        expect(typeof environments.list).toBe("function");
        expect(typeof environments.create).toBe("function");
        expect(typeof environments.update).toBe("function");
        expect(typeof environments.delete).toBe("function");
      });
    });
  });

  describe("Canonical Endpoint Compatibility (v0.3.0)", () => {
    it("should map to correct canonical endpoints", () => {
      const pathMethods = plugin.pathMethods;

      // Canonical public endpoints
      expect(pathMethods["/feature-flags/evaluate"]).toBe("POST");
      expect(pathMethods["/feature-flags/evaluate-batch"]).toBe("POST");
      expect(pathMethods["/feature-flags/bootstrap"]).toBe("POST");
      expect(pathMethods["/feature-flags/events"]).toBe("POST");

      // Config and health endpoints
      expect(pathMethods["/feature-flags/config"]).toBe("GET");
      expect(pathMethods["/feature-flags/health"]).toBe("GET");
    });

    it("should map to correct canonical admin endpoints", () => {
      const pathMethods = plugin.pathMethods;

      // RESTful admin endpoints for flags (path supports both GET and POST)
      const flagsPath = pathMethods["/feature-flags/admin/flags"];
      expect(flagsPath).toBeDefined();
      expect(["GET", "POST"]).toContain(flagsPath);

      // Admin analytics endpoints
      expect(pathMethods["/feature-flags/admin/metrics/usage"]).toBe("GET");

      // Admin audit endpoints
      expect(pathMethods["/feature-flags/admin/audit"]).toBe("GET");
    });
  });

  describe("Type Safety", () => {
    it("should maintain type safety for canonical methods", () => {
      // This test verifies that TypeScript compilation works correctly
      // The actual type checking happens at compile time

      type TestSchema = {
        testFlag: boolean;
        stringFlag: string;
      };

      const typedPlugin = featureFlagsClient<TestSchema>();
      expect(typedPlugin.id).toBe("feature-flags");
    });
  });
});
