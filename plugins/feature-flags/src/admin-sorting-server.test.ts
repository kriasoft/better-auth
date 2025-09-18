// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import { beforeEach, describe, expect, it } from "bun:test";
import { createAdminFlagsEndpointsForTest } from "./endpoints/admin/flags.test-helper";
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

describe("admin list flags sorting", () => {
  let pc: PluginContext;
  let endpoints: any;

  beforeEach(async () => {
    pc = makePluginContext();
    endpoints = createAdminFlagsEndpointsForTest(pc as any);

    // Seed flags with different keys
    const keys = ["charlie", "alpha", "bravo", "echo", "delta"];
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

  it("sort=key orders flags alphabetically", async () => {
    const res = await endpoints.listFeatureFlags(
      mkCtx({ sort: "key", limit: 10 }),
    );
    const got = res.flags.map((f: any) => f.key);
    const sorted = [...got].sort();
    expect(got).toEqual(sorted);
  });

  it("sort=-key orders flags reverse-alphabetically", async () => {
    const res = await endpoints.listFeatureFlags(
      mkCtx({ sort: "-key", limit: 10 }),
    );
    const got = res.flags.map((f: any) => f.key);
    const sorted = [...got].sort().reverse();
    expect(got).toEqual(sorted);
  });
});
