// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

/** Multi-tenant security tests for shared security functions */

import { describe, expect, test } from "bun:test";
import type { PluginContext } from "../types";
import {
  ensureFlagOwnership,
  jsonError,
  resolveEffectiveOrgId,
} from "./shared";

// Mock plugin context with multi-tenant enabled
const createMockContext = (multiTenant = true): PluginContext => ({
  config: {
    multiTenant: {
      enabled: multiTenant,
    },
    security: {
      adminRole: "admin",
    },
  },
  storage: {
    getFlagById: async (id: string) =>
      id === "org-user-flag"
        ? { id, organizationId: "org-user" }
        : { id, organizationId: "org-other" },
  } as any,
});

// Mock Better Auth context with session
const createMockAuthContext = (organizationId?: string) => ({
  context: {
    session: {
      user: organizationId ? { organizationId } : {},
    },
  },
  json: (data: any, options?: any) => ({
    data,
    status: options?.status || 200,
  }),
});

describe("Multi-Tenant Security Functions", () => {
  const mockContext = createMockContext(true);

  describe("resolveEffectiveOrgId", () => {
    test("should return user's org ID when multi-tenant enabled and valid session", () => {
      const ctx = createMockAuthContext("org-user");

      const result = resolveEffectiveOrgId(ctx, mockContext);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.organizationId).toBe("org-user");
      }
    });

    test("should return error when user tries to access different organization", () => {
      const ctx = createMockAuthContext("org-user");

      const result = resolveEffectiveOrgId(ctx, mockContext, "org-other");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.response.data.error).toBe("UNAUTHORIZED_ACCESS");
        expect(result.response.status).toBe(403);
      }
    });

    test("should return error when user has no organizationId in multi-tenant mode", () => {
      const ctx = createMockAuthContext(); // No org ID

      const result = resolveEffectiveOrgId(ctx, mockContext);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.response.data.error).toBe("UNAUTHORIZED_ACCESS");
        expect(result.response.status).toBe(403);
      }
    });

    test("should succeed when multi-tenant disabled", () => {
      const singleTenantContext = createMockContext(false);
      const ctx = createMockAuthContext();

      const result = resolveEffectiveOrgId(ctx, singleTenantContext, "any-org");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.organizationId).toBeUndefined();
      }
    });

    test("should allow access to own organization", () => {
      const ctx = createMockAuthContext("org-user");

      const result = resolveEffectiveOrgId(ctx, mockContext, "org-user");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.organizationId).toBe("org-user");
      }
    });
  });

  describe("ensureFlagOwnership", () => {
    test("should succeed when user owns the flag", async () => {
      const ctx = createMockAuthContext("org-user");

      const result = await ensureFlagOwnership(
        ctx,
        mockContext,
        "org-user-flag",
      );

      expect(result.ok).toBe(true);
    });

    test("should return 404 when flag belongs to different organization", async () => {
      const ctx = createMockAuthContext("org-user");

      const result = await ensureFlagOwnership(
        ctx,
        mockContext,
        "org-other-flag",
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.response.data.error).toBe("FLAG_NOT_FOUND");
        expect(result.response.status).toBe(404);
      }
    });

    test("should return 403 when user has no organizationId", async () => {
      const ctx = createMockAuthContext(); // No org ID

      const result = await ensureFlagOwnership(ctx, mockContext, "any-flag");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.response.data.error).toBe("UNAUTHORIZED_ACCESS");
        expect(result.response.status).toBe(403);
      }
    });

    test("should succeed when multi-tenant disabled", async () => {
      const singleTenantContext = createMockContext(false);
      const ctx = createMockAuthContext();

      const result = await ensureFlagOwnership(
        ctx,
        singleTenantContext,
        "any-flag",
      );

      expect(result.ok).toBe(true);
    });
  });

  describe("jsonError", () => {
    test("should create proper error response", () => {
      const ctx = createMockAuthContext();

      const result = jsonError(ctx, "TEST_ERROR", "Test message", 400);

      expect(result.data.error).toBe("TEST_ERROR");
      expect(result.data.message).toBe("Test message");
      expect(result.status).toBe(400);
    });

    test("should include details when provided", () => {
      const ctx = createMockAuthContext();
      const details = { field: "invalid" };

      const result = jsonError(
        ctx,
        "VALIDATION_ERROR",
        "Invalid input",
        400,
        details,
      );

      expect(result.data.details).toEqual(details);
    });
  });
});
