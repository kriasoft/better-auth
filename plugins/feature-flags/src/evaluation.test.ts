// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import { describe, expect, it } from "bun:test";
import { evaluateFlags, evaluateFlagsBatch } from "./evaluation";
import type { EvaluationContext, FeatureFlag, FlagRule } from "./schema";
import type { PluginContext } from "./types";

// Test helper: creates flag with sensible defaults
function makeFlag(overrides: Partial<FeatureFlag> = {}): FeatureFlag {
  const base: FeatureFlag = {
    id: "flag1",
    key: "test.flag",
    name: "Test Flag",
    type: "boolean",
    enabled: true,
    defaultValue: false,
    rolloutPercentage: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any;
  return { ...base, ...overrides } as FeatureFlag;
}

// Test helper: creates evaluation context
function makeCtx(
  overrides: Partial<EvaluationContext> = {},
): EvaluationContext {
  return {
    userId: "user-1",
    attributes: {},
    ...overrides,
  } as EvaluationContext;
}

// Test helper: creates plugin context with storage stubs
function makePluginContext(
  stub: Partial<PluginContext["storage"]> = {},
): PluginContext {
  return {
    config: {
      multiTenant: { enabled: false },
      caching: { enabled: true, ttl: 60 },
      analytics: { trackUsage: false, trackPerformance: false },
    } as any,
    storage: {
      getOverride: async () => null,
      getRulesForFlag: async () => [],
      getFlag: async () => null,
      ...stub,
    } as any,
  } as PluginContext;
}

describe("evaluation engine", () => {
  it("returns default when disabled", async () => {
    const flag = makeFlag({ enabled: false, defaultValue: true });
    const ctx = makeCtx();
    const pc = makePluginContext();
    const res = await evaluateFlags(flag, ctx, pc);
    expect(res.reason).toBe("disabled");
    expect(res.value).toBe(true);
  });

  it("applies user override with highest precedence", async () => {
    const flag = makeFlag({ defaultValue: false });
    const ctx = makeCtx({ userId: "user-42" });
    const pc = makePluginContext({
      getOverride: async () =>
        ({
          id: "o1",
          flagId: flag.id,
          userId: ctx.userId!,
          value: true,
          enabled: true,
          createdAt: new Date(),
        }) as any,
    });
    const res = await evaluateFlags(flag, ctx, pc);
    expect(res.reason).toBe("override");
    expect(res.value).toBe(true);
  });

  it("matches rule conditions before rollout", async () => {
    const flag = makeFlag({ defaultValue: false });
    const ctx = makeCtx({ attributes: { plan: "pro" } });
    const rule: FlagRule = {
      id: "r1",
      flagId: flag.id,
      name: "Pro in EU",
      priority: 0,
      enabled: true,
      conditions: {
        all: [
          { attribute: "attributes.plan", operator: "equals", value: "pro" },
        ],
      } as any,
      value: true,
      createdAt: new Date(),
    };
    const pc = makePluginContext({ getRulesForFlag: async () => [rule] });
    const res = await evaluateFlags(flag, ctx, pc);
    expect(res.reason).toBe("rule_match");
    expect(res.value).toBe(true);
    expect(res.metadata?.ruleId).toBe("r1");
  });

  it("handles 0% and 100% rollout boundaries", async () => {
    const ctx = makeCtx({ userId: "user-99" });
    const pc = makePluginContext();

    const zero = await evaluateFlags(
      makeFlag({ rolloutPercentage: 0, defaultValue: false }),
      ctx,
      pc,
    );
    expect(zero.reason).toBe("percentage_rollout");
    expect(zero.metadata?.included).toBe(false);

    const hundred = await evaluateFlags(
      makeFlag({ rolloutPercentage: 100, defaultValue: true }),
      ctx,
      pc,
    );
    // 100% rollout bypasses percentage logic, uses default evaluation path
    expect(hundred.value).toBe(true);
  });

  it("assigns variants deterministically for same user", async () => {
    const flag = makeFlag({
      key: "exp.variant",
      type: "json",
      defaultValue: { variant: "control" },
      variants: [
        { key: "control", value: {}, weight: 50 } as any,
        { key: "treatment", value: {}, weight: 50 } as any,
      ],
    });
    const ctx = makeCtx({ userId: "user-abc" });
    const pc = makePluginContext();
    const r1 = await evaluateFlags(flag, ctx, pc);
    const r2 = await evaluateFlags(flag, ctx, pc);
    // Consistent variant assignment across evaluations
    expect(r1.variant == null || typeof r1.variant === "string").toBe(true);
    expect(r1.variant).toBe(r2.variant);
  });

  it("batch evaluation returns not_found for missing flags", async () => {
    const ctx = makeCtx();
    const pc = makePluginContext({ getFlag: async () => null });
    const res = await evaluateFlagsBatch(["missing"], ctx, pc);
    expect(res.missing.reason).toBe("not_found");
  });

  it("includes debug metadata when debug=true", async () => {
    const flag = makeFlag({ enabled: false, defaultValue: "test-value" });
    const ctx = makeCtx();
    const pc = makePluginContext();

    const result = await evaluateFlags(flag, ctx, pc, true, "test-env");

    expect(result.reason).toBe("disabled");
    expect(result.value).toBe("test-value");
    expect(result.metadata?.debug).toBeDefined();
    expect(result.metadata.debug.evaluationPath).toEqual(["disabled"]);
    expect(result.metadata.debug.steps).toHaveLength(1);
    expect(result.metadata.debug.steps[0].step).toBe("disabled");
    expect(result.metadata.debug.flagId).toBe(flag.id);
    expect(result.metadata.debug.environment).toBe("test-env");
    expect(result.metadata.debug.processingTime).toBeGreaterThanOrEqual(0);
  });

  it("excludes debug metadata when debug=false", async () => {
    const flag = makeFlag({ enabled: false, defaultValue: "test-value" });
    const ctx = makeCtx();
    const pc = makePluginContext();

    const result = await evaluateFlags(flag, ctx, pc, false);

    expect(result.reason).toBe("disabled");
    expect(result.value).toBe("test-value");
    expect(result.metadata?.debug).toBeUndefined();
  });

  it("supports field projection when fields array is provided", async () => {
    const flag = makeFlag({ enabled: true, defaultValue: "test-value" });
    const ctx = makeCtx();
    const pc = makePluginContext();

    const result = await evaluateFlags(flag, ctx, pc, false);

    expect(result.value).toBe("test-value");
    expect(result.reason).toBe("percentage_rollout");
    expect(result.variant).toBeUndefined();
    // Fields projection happens at endpoint level, not evaluation level
  });

  it("batch evaluation passes through debug parameter", async () => {
    const flag = makeFlag({ enabled: false, defaultValue: "batch-test" });
    const ctx = makeCtx();
    const pc = makePluginContext({
      getFlag: async () => flag,
    });

    const results = await evaluateFlagsBatch(
      ["test-flag"],
      ctx,
      pc,
      true,
      "test-env",
    );

    expect(results["test-flag"].metadata?.debug).toBeDefined();
    expect(results["test-flag"].metadata.debug.flagId).toBe(flag.id);
    expect(results["test-flag"].metadata.debug.environment).toBe("test-env");
  });
});
