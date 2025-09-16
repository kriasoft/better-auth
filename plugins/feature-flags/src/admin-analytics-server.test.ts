// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import { beforeEach, describe, expect, it } from "bun:test";
import { createAdminAnalyticsEndpoints } from "./endpoints/admin/analytics";
import { LRUCache } from "./lru-cache";
import { createStorageAdapter } from "./storage";
import type { PluginContext } from "./types";

function makePluginContext(): PluginContext {
  const storage = createStorageAdapter("memory", {
    caching: { enabled: false, ttl: 60 },
  });
  const config = {
    storage: "memory" as const,
    debug: false,
    analytics: { trackUsage: true, trackPerformance: false },
    adminAccess: { enabled: true, roles: ["admin"] },
    multiTenant: { enabled: false, useOrganizations: false },
    caching: { enabled: false, ttl: 60 },
    audit: { enabled: false, retentionDays: 90 },
    contextCollection: {},
    flags: {},
  };
  const cache = new LRUCache({ maxSize: 100, defaultTTL: 60000 });
  return { auth: {}, storage, config, cache } as any;
}

function mkCtx(query: any = {}) {
  return {
    query,
    params: {},
    context: { session: { user: { id: "test" } } },
    json: (data: any) => data,
  } as any;
}

describe("admin analytics server-side", () => {
  let pc: PluginContext;
  let endpoints: any;

  beforeEach(async () => {
    pc = makePluginContext();
    endpoints = createAdminAnalyticsEndpoints(pc as any);
  });

  it("parses start/end to Date in stats", async () => {
    // Spy on storage call
    const calls: any[] = [];
    const orig = pc.storage.getEvaluationStats.bind(pc.storage);
    (pc.storage as any).getEvaluationStats = async (
      flagId: string,
      range?: { start: Date; end: Date },
    ) => {
      calls.push({ flagId, range });
      return await orig(flagId, range);
    };

    // Call endpoint
    const ctx = mkCtx({ start: "2025-03-01", end: "2025-03-31" });
    // Need a flagId, create a flag and use its id
    const flag = await pc.storage.createFlag({
      key: "analytics-flag",
      name: "Analytics Flag",
      type: "boolean",
      enabled: true,
      defaultValue: false,
      rolloutPercentage: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);
    (ctx as any).params = { flagId: flag.id };

    const res = await endpoints.getFeatureFlagStats(ctx);
    expect(res).toBeDefined();
    expect(calls.length).toBe(1);
    expect(calls[0].range).toBeDefined();
    expect(calls[0].range.start instanceof Date).toBeTrue();
    expect(calls[0].range.end instanceof Date).toBeTrue();
  });

  it("parses start/end to Date in usage metrics", async () => {
    const calls: any[] = [];
    const orig = pc.storage.getUsageMetrics.bind(pc.storage);
    (pc.storage as any).getUsageMetrics = async (
      orgId?: string,
      range?: { start: Date; end: Date },
    ) => {
      calls.push({ orgId, range });
      return await orig(orgId, range);
    };

    const ctx = mkCtx({ start: "2025-04-01", end: "2025-04-30" });
    const res = await endpoints.getFeatureFlagsUsageMetrics(ctx);
    expect(res).toBeDefined();
    expect(calls.length).toBe(1);
    expect(calls[0].range).toBeDefined();
    expect(calls[0].range.start instanceof Date).toBeTrue();
    expect(calls[0].range.end instanceof Date).toBeTrue();
  });
});
