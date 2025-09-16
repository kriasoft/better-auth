// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import { describe, expect, it, test } from "bun:test";
import { createStorageAdapter } from "../storage";

describe("storage adapter parity (shapes)", () => {
  it("memory adapter returns proper shapes and dates", async () => {
    const storage = createStorageAdapter("memory", {} as any);
    await storage.initialize?.();

    const flag = await storage.createFlag({
      key: "shape.test",
      name: "Shape Test",
      type: "boolean" as const,
      enabled: true,
      defaultValue: false,
      rolloutPercentage: 0,
    } as any);

    expect(typeof flag.id).toBe("string");
    expect(flag.createdAt instanceof Date).toBe(true);
    expect(flag.updatedAt instanceof Date).toBe(true);

    const fetched = await storage.getFlag(flag.key);
    expect(fetched?.id).toBe(flag.id);

    const rule = await storage.createRule({
      flagId: flag.id,
      name: "rule1",
      priority: 0,
      enabled: true,
      conditions: { all: [] } as any,
      value: true,
    } as any);
    expect(rule.createdAt instanceof Date).toBe(true);

    const ov = await storage.createOverride({
      flagId: flag.id,
      userId: "u1",
      enabled: true,
      value: true,
    } as any);
    expect(ov.createdAt instanceof Date).toBe(true);

    await storage.logAudit({
      action: "create",
      actorId: "admin",
      flagId: flag.id,
      message: "created",
      metadata: { source: "test" },
    } as any);

    const audits = await storage.getAuditLogs({});
    expect(Array.isArray(audits)).toBe(true);
  });

  test.todo("redis adapter normalizes dates and field names to schema");
  test.todo("database adapter parity (requires test DB)");
});
