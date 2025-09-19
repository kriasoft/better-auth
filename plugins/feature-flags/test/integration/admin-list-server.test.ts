// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import { beforeEach, describe, expect, it } from "bun:test";
import { createAdminFlagsEndpointsForTest } from "../../src/endpoints/admin/flags.test-helper";
import { LRUCache } from "../../src/lru-cache";
import { createStorageAdapter } from "../../src/storage";
import type { PluginContext } from "../../src/types";

function makePluginContext(): PluginContext {
  const storage = createStorageAdapter("memory", {
    caching: { enabled: false, ttl: 60 },
  });
  // minimal config consistent with plugin defaults
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
  const session = {
    id: "s1",
    user: { id: "test", roles: ["admin"] },
    expiresAt: new Date(Date.now() + 3600_000),
  } as any;
  return {
    query,
    params: {},
    path: "/feature-flags/admin/flags",
    method: "GET",
    context: { session },
    session,
    auth: { getSession: async () => session },
    getSession: async () => session,
    headers: { get: () => null, entries: () => [] } as any,
    json: (data: any) => data,
  } as any;
}

describe("admin list flags server-side", () => {
  let pc: PluginContext;
  let endpoints: any;

  beforeEach(async () => {
    pc = makePluginContext();
    endpoints = createAdminFlagsEndpointsForTest(pc as any);
    // Seed flags
    const keys = ["alpha", "beta-1", "beta-2", "gamma", "delta"];
    for (const key of keys) {
      await pc.storage.createFlag({
        key,
        name: key.toUpperCase(),
        type: "boolean",
        enabled: true,
        defaultValue: false,
        rolloutPercentage: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);
    }
  });

  it("paginates with cursor", async () => {
    // Page 1
    const res1 = await endpoints.listFeatureFlags(mkCtx({ limit: 2 }));
    expect(res1.flags.length).toBe(2);
    expect(
      typeof res1.nextCursor === "string" || res1.nextCursor === undefined,
    ).toBeTrue();
    const cursor1 = res1.nextCursor;

    // Page 2
    const res2 = await endpoints.listFeatureFlags(
      mkCtx({ limit: 2, cursor: cursor1 }),
    );
    expect(res2.flags.length).toBe(2);
    const cursor2 = res2.nextCursor;

    // Page 3
    const res3 = await endpoints.listFeatureFlags(
      mkCtx({ limit: 2, cursor: cursor2 }),
    );
    expect(res3.flags.length).toBe(1);
    expect(res3.nextCursor).toBeUndefined();
  });

  it("include=stats returns stats per flag", async () => {
    const res = await endpoints.listFeatureFlags(
      mkCtx({ limit: 2, include: "stats" }),
    );
    expect(res.flags.length).toBe(2);
    for (const f of res.flags) {
      expect(f).toHaveProperty("stats");
      expect(f.stats).toHaveProperty("totalEvaluations");
    }
  });

  it("q filters by key or name (case-insensitive)", async () => {
    const res = await endpoints.listFeatureFlags(
      mkCtx({ q: "beta", limit: 10 }),
    );
    expect(res.flags.length).toBe(2);
    for (const f of res.flags) {
      const text = ((f.key || "") + " " + (f.name || "")).toLowerCase();
      expect(text.includes("beta")).toBeTrue();
    }
  });
});
