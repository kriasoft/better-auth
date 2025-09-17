// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import { describe, expect, it } from "bun:test";
import { z } from "zod";

describe("Admin: environments schema validation", () => {
  const listQuerySchema = z
    .object({
      organizationId: z.string().optional(),
      cursor: z.string().optional(),
      limit: z.number().min(1).max(100).optional(),
    })
    .optional();

  const createBodySchema = z.object({
    name: z.string(),
    key: z
      .string()
      .refine((val) => /^[a-z0-9-_]+$/i.test(val), {
        message:
          "Key must contain only alphanumeric characters, hyphens, and underscores",
      })
      .optional(),
    description: z.string().optional(),
    organizationId: z.string().optional(),
    config: z.record(z.string(), z.any()).optional(),
  });

  it("environments list accepts unified query parameters", () => {
    const validQuery = {
      organizationId: "org-123",
      cursor: "cursor-abc",
      limit: 50,
    };

    const result = listQuerySchema.safeParse(validQuery);
    expect(result.success).toBe(true);
  });

  it("environments list rejects invalid limit values", () => {
    const invalidQuery = {
      limit: 0, // Too small
    };

    const result = listQuerySchema.safeParse(invalidQuery);
    expect(result.success).toBe(false);
  });

  it("environments create accepts name and optional key", () => {
    const validBody = {
      name: "Production Environment",
      key: "production",
      description: "Production deployment environment",
    };

    const result = createBodySchema.safeParse(validBody);
    expect(result.success).toBe(true);
  });

  it("environments create accepts name without key", () => {
    const validBody = {
      name: "Staging Environment",
      description: "Staging deployment environment",
    };

    const result = createBodySchema.safeParse(validBody);
    expect(result.success).toBe(true);
  });

  it("environments create rejects invalid key format", () => {
    const invalidBody = {
      name: "Test Environment",
      key: "test environment!", // Invalid characters
    };

    const result = createBodySchema.safeParse(invalidBody);
    expect(result.success).toBe(false);
  });

  it("environments create accepts valid key with hyphens and underscores", () => {
    const validBody = {
      name: "Dev Environment",
      key: "dev-test_env-01",
    };

    const result = createBodySchema.safeParse(validBody);
    expect(result.success).toBe(true);
  });
});
