// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import { describe, expect, it } from "bun:test";
import { z } from "zod";
import { flagOverrideInputSchema } from "./schema/validation";

describe("Admin: override expiresAt RFC3339 validation", () => {
  const createSchema = flagOverrideInputSchema
    .omit({ expiresAt: true })
    .extend({
      expiresAt: z.string().datetime().optional(),
    });

  const updateSchema = flagOverrideInputSchema
    .omit({ flagId: true, userId: true, expiresAt: true })
    .partial()
    .extend({
      expiresAt: z.string().datetime().optional(),
    });

  it("create override accepts valid RFC3339 strings", () => {
    const validData = {
      flagId: "flag-123",
      userId: "user-456",
      value: true,
      expiresAt: "2025-12-31T23:59:59Z", // RFC3339 with UTC
    };

    const result = createSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("create override accepts UTC timezone format", () => {
    const validData = {
      flagId: "flag-123",
      userId: "user-456",
      value: true,
      expiresAt: "2025-12-31T23:59:59.123Z", // RFC3339 UTC with milliseconds
    };

    const result = createSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("create override rejects invalid date strings", () => {
    const invalidData = {
      flagId: "flag-123",
      userId: "user-456",
      value: true,
      expiresAt: "invalid-date",
    };

    const result = createSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it("update override accepts valid RFC3339 strings", () => {
    const validData = {
      value: false,
      expiresAt: "2025-12-31T23:59:59.999Z", // RFC3339 with milliseconds
    };

    const result = updateSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("update override accepts undefined expiresAt", () => {
    const validData = {
      value: false,
      // no expiresAt
    };

    const result = updateSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("update override rejects invalid date format", () => {
    const invalidData = {
      value: false,
      expiresAt: "2025/12/31 23:59:59", // Wrong format
    };

    const result = updateSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it("create override rejects offset timezone format", () => {
    const invalidData = {
      flagId: "flag-123",
      userId: "user-456",
      value: true,
      expiresAt: "2025-12-31T23:59:59+08:00", // Offset timezone not supported by Zod datetime()
    };

    const result = createSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });
});
