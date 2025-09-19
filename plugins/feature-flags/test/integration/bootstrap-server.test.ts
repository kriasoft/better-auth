// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import { describe, expect, it, beforeEach } from "bun:test";
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

function mkCtx(body: any = {}) {
  return {
    body,
    headers: { entries: () => [], get: () => null } as any,
    context: { session: { user: { id: "u1" } } },
    json: (data: any) => data,
  } as any;
}

describe("bootstrap endpoint server-side", () => {
  let pc: PluginContext;
  let endpoints: any;

  beforeEach(async () => {
    pc = makePluginContext();
    endpoints = createPublicBootstrapEndpoints(pc as any);
  });

  it("returns only enabled flags", async () => {
    await pc.storage.createFlag({
      key: "enabled.a",
      name: "Enabled",
      type: "boolean",
      enabled: true,
      defaultValue: true,
      rolloutPercentage: 0,
    } as any);
    await pc.storage.createFlag({
      key: "disabled.b",
      name: "Disabled",
      type: "boolean",
      enabled: false,
      defaultValue: false,
      rolloutPercentage: 0,
    } as any);

    const res = await endpoints.bootstrapFeatureFlags(mkCtx());
    const keys = Object.keys(res.flags);
    expect(keys.includes("disabled.b")).toBe(false);
    expect(keys.length).toBe(1);
    expect(keys[0]).toBe("enabled.a");
  });

  it("filters by include list", async () => {
    for (const key of ["a", "b", "c"]) {
      await pc.storage.createFlag({
        key,
        name: key.toUpperCase(),
        type: "boolean",
        enabled: true,
        defaultValue: key === "a",
        rolloutPercentage: 0,
      } as any);
    }
    const res = await endpoints.bootstrapFeatureFlags(
      mkCtx({ include: ["a", "c"] }),
    );
    expect(Object.keys(res.flags).sort()).toEqual(["a", "c"]);
  });

  it("filters by prefix", async () => {
    await pc.storage.createFlag({
      key: "exp:a",
      name: "A",
      type: "boolean",
      enabled: true,
      defaultValue: true,
      rolloutPercentage: 0,
    } as any);
    await pc.storage.createFlag({
      key: "exp:b",
      name: "B",
      type: "boolean",
      enabled: true,
      defaultValue: false,
      rolloutPercentage: 0,
    } as any);
    await pc.storage.createFlag({
      key: "other:c",
      name: "C",
      type: "boolean",
      enabled: true,
      defaultValue: false,
      rolloutPercentage: 0,
    } as any);

    const res = await endpoints.bootstrapFeatureFlags(
      mkCtx({ prefix: "exp:" }),
    );
    expect(Object.keys(res.flags).sort()).toEqual(["exp:a", "exp:b"]);
  });

  it("select='value' returns values map", async () => {
    await pc.storage.createFlag({
      key: "p:a",
      name: "A",
      type: "boolean",
      enabled: true,
      defaultValue: true,
      rolloutPercentage: 0,
    } as any);
    await pc.storage.createFlag({
      key: "p:b",
      name: "B",
      type: "boolean",
      enabled: true,
      defaultValue: false,
      rolloutPercentage: 0,
    } as any);

    const res = await endpoints.bootstrapFeatureFlags(
      mkCtx({ select: "value" }),
    );
    // When select='value', flags is key->primitive map
    expect(res.flags).toEqual({ "p:a": true, "p:b": false });
  });

  it("select=[fields] projects fields only", async () => {
    await pc.storage.createFlag({
      key: "proj:a",
      name: "A",
      type: "boolean",
      enabled: true,
      defaultValue: true,
      rolloutPercentage: 0,
    } as any);

    const res = await endpoints.bootstrapFeatureFlags(
      mkCtx({ select: ["value", "reason"] }),
    );

    expect(res.flags["proj:a"]).toHaveProperty("value");
    expect(res.flags["proj:a"]).toHaveProperty("reason");
    expect(res.flags["proj:a"]).not.toHaveProperty("variant");
    expect(res.flags["proj:a"]).not.toHaveProperty("metadata");
  });
});
