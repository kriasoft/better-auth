// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import { describe, expect, it } from "bun:test";
import { createPublicEvaluateEndpoints } from "../../src/endpoints/public/evaluate";
import { createPublicEvaluateBatchEndpoints } from "../../src/endpoints/public/evaluate-batch";
import { createPublicBootstrapEndpoints } from "../../src/endpoints/public/bootstrap";
import { createStorageAdapter } from "../../src/storage";
import type { PluginContext } from "../../src/types";

function makePluginContext(): PluginContext {
  const storage = createStorageAdapter("memory", {
    caching: { enabled: false, ttl: 60 },
  });
  const config = {
    storage: "memory" as const,
    debug: false,
    analytics: { trackUsage: false, trackPerformance: false },
    adminAccess: { enabled: false, roles: ["admin"] },
    multiTenant: { enabled: false, useOrganizations: false },
    caching: { enabled: false, ttl: 60 },
    audit: { enabled: false, retentionDays: 90 },
    contextCollection: {},
    flags: {},
  };
  return { auth: {}, storage, config } as any;
}

function headersWithEnv(env: string) {
  return {
    ["x-deployment-ring"]: env,
    get: (name: string) =>
      name.toLowerCase() === "x-deployment-ring" ? env : null,
    entries: () => [["x-deployment-ring", env]],
  } as any;
}

describe("environment precedence (header over body)", () => {
  it("evaluate: x-deployment-ring header overrides body environment", async () => {
    const pc = makePluginContext();

    // Seed flag + rule that matches only when environment == 'canary'
    const flag = await pc.storage.createFlag({
      key: "env.flag",
      name: "Env Flag",
      type: "boolean",
      enabled: true,
      defaultValue: false,
      rolloutPercentage: 0,
    } as any);
    await pc.storage.createRule({
      flagId: flag.id,
      name: "canary env",
      priority: 0,
      enabled: true,
      conditions: {
        all: [
          {
            attribute: "attributes.environment",
            operator: "equals",
            value: "canary",
          },
        ],
      } as any,
      value: true,
    } as any);

    const endpoints = createPublicEvaluateEndpoints(pc as any);
    const ctx = {
      body: { flagKey: "env.flag", environment: "prod", debug: true },
      headers: headersWithEnv("canary"),
      context: { session: { user: { id: "u1" } } },
      json: (data: any) => data,
    } as any;

    const res = await (endpoints as any).evaluateFeatureFlag(ctx);

    expect(res.reason).toBe("rule_match");
    expect(res.value).toBe(true);
    // Debug metadata should include resolved environment
    expect(res.metadata?.debug?.environment).toBe("canary");
  });

  it("evaluate-batch: header precedence applied to all keys", async () => {
    const pc = makePluginContext();

    const flag = await pc.storage.createFlag({
      key: "env.flag.batch",
      name: "Env Flag Batch",
      type: "boolean",
      enabled: true,
      defaultValue: false,
      rolloutPercentage: 0,
    } as any);
    await pc.storage.createRule({
      flagId: flag.id,
      name: "canary env",
      priority: 0,
      enabled: true,
      conditions: {
        all: [
          {
            attribute: "attributes.environment",
            operator: "equals",
            value: "canary",
          },
        ],
      } as any,
      value: true,
    } as any);

    const endpoints = createPublicEvaluateBatchEndpoints(pc as any);
    const ctx = {
      body: { flagKeys: ["env.flag.batch"], environment: "prod", debug: true },
      headers: headersWithEnv("canary"),
      context: { session: { user: { id: "u1" } } },
      json: (data: any) => data,
    } as any;

    const res = await (endpoints as any).evaluateFeatureFlags(ctx);

    expect(res.flags["env.flag.batch"].reason).toBe("rule_match");
    expect(res.flags["env.flag.batch"].value).toBe(true);
    expect(res.flags["env.flag.batch"].metadata?.debug?.environment).toBe(
      "canary",
    );
    // Batch includes evaluatedAt; contextInResponse defaults true
    expect(res.evaluatedAt).toBeDefined();
    expect(res.context).toBeDefined();
  });

  it("bootstrap: header precedence used during bulk evaluation", async () => {
    const pc = makePluginContext();

    const flag = await pc.storage.createFlag({
      key: "env.flag.boot",
      name: "Env Flag Boot",
      type: "boolean",
      enabled: true,
      defaultValue: false,
      rolloutPercentage: 0,
    } as any);
    await pc.storage.createRule({
      flagId: flag.id,
      name: "canary env",
      priority: 0,
      enabled: true,
      conditions: {
        all: [
          {
            attribute: "attributes.environment",
            operator: "equals",
            value: "canary",
          },
        ],
      } as any,
      value: true,
    } as any);

    const endpoints = createPublicBootstrapEndpoints(pc as any);
    const ctx = {
      body: { environment: "prod", debug: true },
      headers: headersWithEnv("canary"),
      context: { session: { user: { id: "u1" } } },
      json: (data: any) => data,
    } as any;

    const res = await (endpoints as any).bootstrapFeatureFlags(ctx);

    expect(res.flags["env.flag.boot"].reason).toBe("rule_match");
    expect(res.flags["env.flag.boot"].value).toBe(true);
    expect(res.flags["env.flag.boot"].metadata?.debug?.environment).toBe(
      "canary",
    );
  });
});
