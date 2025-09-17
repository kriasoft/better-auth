// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import { describe, expect, it } from "bun:test";
import { ContextSanitizer } from "./context-sanitizer";

describe("ContextSanitizer", () => {
  describe("Security - Forbidden Fields", () => {
    it("should remove password fields", () => {
      const sanitizer = new ContextSanitizer({ warnOnDrop: false });
      const context = {
        userId: "user123",
        password: "secret123",
        userPassword: "another-secret",
      };

      const sanitized = sanitizer.sanitizeForBody(context);
      expect(sanitized).toEqual({ userId: "user123" });
    });

    it("should remove token fields", () => {
      const sanitizer = new ContextSanitizer({ warnOnDrop: false });
      const context = {
        userId: "user123",
        accessToken: "jwt-token",
        apiKey: "secret-key",
        refreshToken: "refresh-jwt",
      };

      const sanitized = sanitizer.sanitizeForBody(context);
      expect(sanitized).toEqual({ userId: "user123" });
    });

    it("should remove credit card and SSN fields", () => {
      const sanitizer = new ContextSanitizer({ warnOnDrop: false });
      const context = {
        userId: "user123",
        creditCard: "4111-1111-1111-1111",
        ssn: "123-45-6789",
        bankAccount: "12345678",
      };

      const sanitized = sanitizer.sanitizeForBody(context);
      expect(sanitized).toEqual({ userId: "user123" });
    });

    it("should detect sensitive patterns", () => {
      const sanitizer = new ContextSanitizer({ warnOnDrop: false });
      const context = {
        userId: "user123",
        mySecretKey: "secret",
        authHeader: "Bearer token",
        privateData: "sensitive",
      };

      const sanitized = sanitizer.sanitizeForBody(context);
      expect(sanitized).toEqual({ userId: "user123" });
    });
  });

  describe("Strict Mode", () => {
    it("should only allow whitelisted fields in strict mode", () => {
      const sanitizer = new ContextSanitizer({
        strict: true,
        allowedFields: new Set(["userId", "role"]),
        warnOnDrop: false,
      });

      const context = {
        userId: "user123",
        role: "admin",
        customField: "value",
        unknownProp: "data",
      };

      const sanitized = sanitizer.sanitizeForBody(context);
      expect(sanitized).toEqual({
        userId: "user123",
        role: "admin",
      });
    });

    it("should allow all safe fields in non-strict mode", () => {
      const sanitizer = new ContextSanitizer({
        strict: false,
        warnOnDrop: false,
      });

      const context = {
        userId: "user123",
        customField: "value",
        someData: 42,
      };

      const sanitized = sanitizer.sanitizeForBody(context);
      expect(sanitized).toEqual(context);
    });
  });

  describe("Size Limits", () => {
    it("should handle URL size limits", () => {
      const sanitizer = new ContextSanitizer({
        maxSizeForUrl: 100,
        warnOnDrop: false,
      });

      const context = {
        userId: "user123",
        longField: "x".repeat(200),
      };

      const sanitized = sanitizer.sanitizeForUrl(context);
      // Should gracefully handle oversized content
      expect(sanitized).toBeDefined();
      if (sanitized) {
        expect(sanitized.length).toBeLessThanOrEqual(100);
      }
    });

    it("should truncate long strings", () => {
      const sanitizer = new ContextSanitizer({
        warnOnDrop: false,
        strict: false, // Allow custom fields
      });
      const context = {
        userId: "user123",
        description: "x".repeat(300),
      };

      const sanitized = sanitizer.sanitizeForBody(context) as any;
      expect(sanitized?.description).toEndWith("...");
      expect(sanitized?.description?.length).toBeLessThanOrEqual(203); // 200 chars + "..."
    });

    it("should limit array length", () => {
      const sanitizer = new ContextSanitizer({
        warnOnDrop: false,
        strict: false, // Allow custom fields
      });
      const context = {
        userId: "user123",
        items: Array.from({ length: 20 }, (_, i) => i),
      };

      const sanitized = sanitizer.sanitizeForBody(context) as any;
      expect(sanitized?.items).toHaveLength(10); // Anti-bloat: max 10 items per array
    });

    it("should progressively drop fields when too large", () => {
      const sanitizer = new ContextSanitizer({
        maxSizeForBody: 50,
        warnOnDrop: false,
      });

      const context = {
        a: "value1",
        b: "value2",
        c: "value3",
        userId: "user123",
      };

      const sanitized = sanitizer.sanitizeForBody(context);
      expect(sanitized).toBeDefined();
      expect(JSON.stringify(sanitized!).length).toBeLessThanOrEqual(50);
      // Priority-based retention: essential fields preserved
      expect(sanitized).toHaveProperty("userId");
    });
  });

  describe("Nested Objects", () => {
    it("should sanitize nested objects", () => {
      const sanitizer = new ContextSanitizer({
        warnOnDrop: false,
        strict: false, // Allow custom fields for this test
      });
      const context = {
        userId: "user123",
        metadata: {
          safe: "value",
          password: "secret",
          nested: {
            apiKey: "key123",
            role: "admin",
          },
        },
      };

      const sanitized = sanitizer.sanitizeForBody(context);
      expect(sanitized).toEqual({
        userId: "user123",
        metadata: {
          safe: "value",
          nested: {
            role: "admin",
          },
        },
      });
    });
  });

  describe("Validation", () => {
    it("should detect forbidden fields", () => {
      const warnings = ContextSanitizer.validate({
        userId: "user123",
        attributes: {
          password: "secret",
          metadata: {
            token: "jwt",
          },
        },
      } as any);

      expect(warnings).toContain(
        'Forbidden field "attributes.password" detected - will be removed',
      );
      expect(warnings).toContain(
        'Forbidden field "attributes.metadata.token" detected - will be removed',
      );
    });

    it("should detect sensitive patterns", () => {
      const warnings = ContextSanitizer.validate({
        userId: "user123",
        attributes: {
          myPrivateKey: "key",
          userSecret: "secret",
        },
      } as any);

      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings.some((w) => w.includes("myPrivateKey"))).toBe(true);
      expect(warnings.some((w) => w.includes("userSecret"))).toBe(true);
    });
  });

  describe("Essential Fields", () => {
    it("should preserve essential fields when reducing size", () => {
      const sanitizer = new ContextSanitizer({
        maxSizeForUrl: 80,
        warnOnDrop: false,
      });

      const context = {
        userId: "user123",
        organizationId: "org456",
        role: "admin",
        plan: "premium",
        customField1: "value1",
        customField2: "value2",
        customField3: "value3",
      };

      const sanitized = sanitizer.sanitizeForUrl(context);
      expect(sanitized).toBeDefined();

      const parsed = JSON.parse(sanitized!);
      // Essential fields should be preserved
      expect(parsed.userId).toBe("user123");
      // Less important fields may be dropped
      expect(Object.keys(parsed).length).toBeLessThan(
        Object.keys(context).length,
      );
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty context", () => {
      const sanitizer = new ContextSanitizer();
      const sanitized = sanitizer.sanitizeForBody({});
      expect(sanitized).toBeUndefined();
    });

    it("should handle null/undefined values", () => {
      const sanitizer = new ContextSanitizer({
        warnOnDrop: false,
        strict: false, // Allow custom fields
      });
      const context = {
        userId: "user123",
        nullField: null,
        undefinedField: undefined,
      };

      const sanitized = sanitizer.sanitizeForBody(context);
      expect(sanitized).toEqual({
        userId: "user123",
        nullField: null,
        undefinedField: undefined,
      });
    });

    it("should skip functions and symbols", () => {
      const sanitizer = new ContextSanitizer({ warnOnDrop: false });
      const context = {
        userId: "user123",
        func: () => console.log("test"),
        sym: Symbol("test"),
      };

      const sanitized = sanitizer.sanitizeForBody(context);
      expect(sanitized).toEqual({ userId: "user123" });
    });
  });
});
