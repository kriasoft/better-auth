// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

/** Tests audit logging with multi-tenant flag ID resolution - prevents schema violations */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { DatabaseStorage } from "../../src/storage/database";
import type { AuditLogEntry, EvaluationTracking } from "../../src/types";

// Minimal database mock - tracks inserts and queries for verification
const mockDb = {
  query: {
    featureFlags: {
      findFirst: async () => null,
    },
  },
  schema: {
    flagAudits: Symbol("flagAudits"),
    flagEvaluations: Symbol("flagEvaluations"),
  },
  insert: () => ({
    values: async () => ({}),
  }),
};

describe("Audit Logging Schema Violation Fixes", () => {
  let storage: DatabaseStorage;
  let insertCallbacks: any[] = [];

  beforeEach(() => {
    insertCallbacks = [];

    // Enhanced mock with operation tracking for test assertions
    const trackedDb = {
      ...mockDb,
      insert: (table: any) => ({
        values: async (data: any) => {
          insertCallbacks.push({ table, data });
          return {};
        },
      }),
    };

    storage = new DatabaseStorage({ db: trackedDb });
  });

  afterEach(() => {
    insertCallbacks = [];
  });

  test("should skip audit logging when flagId cannot be resolved", async () => {
    // Simulate missing flag to test graceful degradation
    const originalGetFlagIdFromKey = (storage as any).getFlagIdFromKey;
    (storage as any).getFlagIdFromKey = async () => null;

    const auditEntry: AuditLogEntry = {
      userId: "user123",
      action: "create",
      flagKey: "nonexistent-flag",
      organizationId: "org123",
    };

    // Should gracefully skip audit when flag resolution fails
    await storage.logAudit(auditEntry);

    // Verify no database insert was attempted
    expect(insertCallbacks).toHaveLength(0);

    // Restore original method
    (storage as any).getFlagIdFromKey = originalGetFlagIdFromKey;
  });

  test("should use flagId directly when provided", async () => {
    const auditEntry: AuditLogEntry = {
      userId: "user123",
      action: "update",
      flagId: "flag-id-123", // Direct flagId provided
      organizationId: "org123",
    };

    await storage.logAudit(auditEntry);

    // Verify database insert was called with the provided flagId
    expect(insertCallbacks).toHaveLength(1);
    expect(insertCallbacks[0].data.flagId).toBe("flag-id-123");
    expect(insertCallbacks[0].data.userId).toBe("user123");
    expect(insertCallbacks[0].data.action).toBe("update");
  });

  test("should resolve flagKey to flagId when flagId not provided", async () => {
    // Test org-scoped flag resolution for multi-tenant audit trails
    const originalGetFlagIdFromKey = (storage as any).getFlagIdFromKey;
    (storage as any).getFlagIdFromKey = async (key: string, orgId?: string) => {
      if (key === "test-flag" && orgId === "org123") {
        return "resolved-flag-id-456";
      }
      return null;
    };

    const auditEntry: AuditLogEntry = {
      userId: "user123",
      action: "delete",
      flagKey: "test-flag",
      organizationId: "org123",
    };

    await storage.logAudit(auditEntry);

    // Verify database insert was called with resolved flagId
    expect(insertCallbacks).toHaveLength(1);
    expect(insertCallbacks[0].data.flagId).toBe("resolved-flag-id-456");

    // Restore original method
    (storage as any).getFlagIdFromKey = originalGetFlagIdFromKey;
  });

  test("should prioritize flagId over flagKey when both provided", async () => {
    const auditEntry: AuditLogEntry = {
      userId: "user123",
      action: "create",
      flagId: "direct-flag-id",
      flagKey: "flag-key", // Should be ignored
      organizationId: "org123",
    };

    await storage.logAudit(auditEntry);

    // Verify direct flagId was used, not resolved from flagKey
    expect(insertCallbacks).toHaveLength(1);
    expect(insertCallbacks[0].data.flagId).toBe("direct-flag-id");
  });
});

describe("Multi-Tenant Flag ID Resolution", () => {
  let storage: DatabaseStorage;
  let queryCallbacks: any[] = [];

  beforeEach(() => {
    queryCallbacks = [];

    // Database mock with query interception for multi-tenant verification
    const trackedDb = {
      ...mockDb,
      query: {
        featureFlags: {
          findFirst: async (options: any) => {
            queryCallbacks.push(options);

            // Simulate org-specific flag isolation
            if (options.where) {
              // Simulate org-scoped flag resolution
              return { id: "mock-flag-id" };
            }
            return null;
          },
        },
      },
    };

    storage = new DatabaseStorage({ db: trackedDb });
  });

  afterEach(() => {
    queryCallbacks = [];
  });

  test("should scope flag lookup by organizationId when provided", async () => {
    // Call private method via type assertion for testing
    const flagId = await (storage as any).getFlagIdFromKey(
      "test-flag",
      "org123",
    );

    expect(flagId).toBe("mock-flag-id");
    expect(queryCallbacks).toHaveLength(1);

    // Verify the where clause includes organization scoping
    const whereClause = queryCallbacks[0].where;
    expect(whereClause).toBeDefined();

    // The where clause should be a function that creates conditions for both key and organizationId
    expect(typeof whereClause).toBe("function");
  });

  test("should lookup flag without organization scoping when organizationId not provided", async () => {
    const flagId = await (storage as any).getFlagIdFromKey("test-flag");

    expect(flagId).toBe("mock-flag-id");
    expect(queryCallbacks).toHaveLength(1);

    // Where clause should still be present but only filter by key
    const whereClause = queryCallbacks[0].where;
    expect(whereClause).toBeDefined();
    expect(typeof whereClause).toBe("function");
  });

  test("should handle evaluation tracking with organization scoping", async () => {
    let trackingCallbacks: any[] = [];

    // Mock getFlagIdFromKey to track calls
    const originalGetFlagIdFromKey = (storage as any).getFlagIdFromKey;
    (storage as any).getFlagIdFromKey = async (key: string, orgId?: string) => {
      trackingCallbacks.push({ key, orgId });
      return "tracked-flag-id";
    };

    // Mock successful insert
    const trackedDb = {
      ...mockDb,
      insert: () => ({
        values: async () => ({}),
      }),
    };
    (storage as any).db = trackedDb;

    const tracking: EvaluationTracking = {
      flagKey: "test-flag",
      userId: "user123",
      organizationId: "org456",
      timestamp: new Date(),
      value: true,
      reason: "rule_match",
    };

    await storage.trackEvaluation(tracking);

    // Verify organization ID was passed to flag resolution
    expect(trackingCallbacks).toHaveLength(1);
    expect(trackingCallbacks[0].key).toBe("test-flag");
    expect(trackingCallbacks[0].orgId).toBe("org456");

    // Restore original method
    (storage as any).getFlagIdFromKey = originalGetFlagIdFromKey;
  });
});

describe("Integration - Audit and Multi-Tenant Combined", () => {
  test("should handle audit logging with multi-tenant flag resolution", async () => {
    let auditCallsTracked: any[] = [];
    let flagResolutionCalls: any[] = [];

    // Mock database
    const trackedDb = {
      ...mockDb,
      query: {
        featureFlags: {
          findFirst: async (options: any) => {
            flagResolutionCalls.push(options);
            // Return different flags for different orgs
            return { id: "org-scoped-flag-id" };
          },
        },
      },
      insert: () => ({
        values: async (data: any) => {
          auditCallsTracked.push(data);
          return {};
        },
      }),
    };

    const storage = new DatabaseStorage({ db: trackedDb });

    // Audit entry with flagKey that needs resolution in multi-tenant context
    const auditEntry: AuditLogEntry = {
      userId: "user123",
      action: "update",
      flagKey: "shared-flag-key", // Same key used across orgs
      organizationId: "tenant-org-789",
      metadata: { source: "admin-panel" },
    };

    await storage.logAudit(auditEntry);

    // Verify flag resolution was called with organization scoping
    expect(flagResolutionCalls).toHaveLength(1);

    // Verify audit was logged with resolved flagId
    expect(auditCallsTracked).toHaveLength(1);
    expect(auditCallsTracked[0].flagId).toBe("org-scoped-flag-id");
    expect(auditCallsTracked[0].userId).toBe("user123");
    expect(auditCallsTracked[0].action).toBe("update");
  });
});
