// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import { describe, expect, it } from "bun:test";
import {
  DEFAULT_HEADER_CONFIG,
  extractSecureCustomAttributes,
  isValidHeaderValue,
  sanitizeHeaderValue,
  validateContextAttribute,
  type HeaderConfig,
} from "./validation";

// Security validation tests: prototype pollution, XSS, DoS prevention
describe("Context Validation", () => {
  describe("validateContextAttribute", () => {
    it("should reject prototype pollution attempts", () => {
      expect(validateContextAttribute("__proto__", {})).toBe(false);
      expect(validateContextAttribute("constructor", {})).toBe(false);
      expect(validateContextAttribute("prototype", {})).toBe(false);
    });

    it("should reject invalid key formats", () => {
      expect(validateContextAttribute("invalid key!", "value")).toBe(false);
      expect(validateContextAttribute("../../etc/passwd", "value")).toBe(false);
      expect(validateContextAttribute("<script>", "value")).toBe(false);
    });

    it("should accept valid keys and values", () => {
      expect(validateContextAttribute("userId", "123")).toBe(true);
      expect(validateContextAttribute("user_id", "123")).toBe(true);
      expect(validateContextAttribute("user-id", "123")).toBe(true);
      expect(validateContextAttribute("user.id", "123")).toBe(true);
    });

    it("should enforce size limits", () => {
      const largeString = "x".repeat(20000);
      expect(validateContextAttribute("data", largeString)).toBe(false);

      const smallString = "x".repeat(1000);
      expect(validateContextAttribute("data", smallString)).toBe(true);
    });

    it("should validate nested objects", () => {
      const validObject = {
        name: "test",
        nested: {
          value: 123,
        },
      };
      expect(validateContextAttribute("data", validObject)).toBe(true);

      // Test against prototype pollution via enumerable __proto__
      const invalidObject: any = {};
      Object.defineProperty(invalidObject, "__proto__", {
        value: "polluted",
        enumerable: true,
      });
      invalidObject.data = "test";
      expect(validateContextAttribute("data", invalidObject)).toBe(false);
    });

    it("should reject functions and symbols", () => {
      expect(validateContextAttribute("fn", () => {})).toBe(false);
      expect(validateContextAttribute("sym", Symbol("test"))).toBe(false);
    });

    it("should handle arrays correctly", () => {
      const validArray = [1, 2, 3, "test"];
      expect(validateContextAttribute("items", validArray)).toBe(true);

      const tooLongArray = Array(200).fill("test");
      expect(validateContextAttribute("items", tooLongArray)).toBe(false);
    });
  });

  describe("Header Validation", () => {
    it("should validate string headers", () => {
      const config: HeaderConfig = {
        name: "x-segment",
        type: "string",
        maxLength: 50,
        pattern: /^[a-zA-Z0-9_-]+$/,
      };

      expect(isValidHeaderValue("valid-segment", config)).toBe(true);
      expect(isValidHeaderValue("invalid segment!", config)).toBe(false);
      expect(isValidHeaderValue("x".repeat(100), config)).toBe(false);
    });

    it("should validate enum headers", () => {
      const config: HeaderConfig = {
        name: "x-tier",
        type: "enum",
        enumValues: ["free", "pro", "enterprise"],
      };

      expect(isValidHeaderValue("pro", config)).toBe(true);
      expect(isValidHeaderValue("invalid", config)).toBe(false);
    });

    it("should validate boolean headers", () => {
      const config: HeaderConfig = {
        name: "x-beta",
        type: "boolean",
      };

      expect(isValidHeaderValue("true", config)).toBe(true);
      expect(isValidHeaderValue("false", config)).toBe(true);
      expect(isValidHeaderValue("yes", config)).toBe(false);
    });

    it("should validate number headers", () => {
      const config: HeaderConfig = {
        name: "x-version",
        type: "number",
      };

      expect(isValidHeaderValue("123", config)).toBe(true);
      expect(isValidHeaderValue("123.45", config)).toBe(true);
      expect(isValidHeaderValue("NaN", config)).toBe(false);
      expect(isValidHeaderValue("Infinity", config)).toBe(false);
    });

    it("should validate JSON headers", () => {
      const config: HeaderConfig = {
        name: "x-metadata",
        type: "json",
      };

      expect(isValidHeaderValue('{"key": "value"}', config)).toBe(true);
      expect(isValidHeaderValue("[1, 2, 3]", config)).toBe(true);
      expect(isValidHeaderValue("invalid json", config)).toBe(false);
    });
  });

  describe("Header Sanitization", () => {
    it("should sanitize string values", () => {
      const config: HeaderConfig = {
        name: "x-test",
        type: "string",
      };

      expect(sanitizeHeaderValue("  test  ", config)).toBe("test");
      expect(sanitizeHeaderValue("test\x00value", config)).toBe("testvalue");
    });

    it("should convert boolean values", () => {
      const config: HeaderConfig = {
        name: "x-beta",
        type: "boolean",
      };

      expect(sanitizeHeaderValue("true", config)).toBe(true);
      expect(sanitizeHeaderValue("false", config)).toBe(false);
    });

    it("should parse JSON safely", () => {
      const config: HeaderConfig = {
        name: "x-data",
        type: "json",
      };

      // JSON with prototype pollution attempt should be cleaned
      const result = sanitizeHeaderValue(
        '{"__proto__": "bad", "data": "test"}',
        config,
      );
      expect(result).toEqual({ data: "test" });
      expect(Object.prototype.hasOwnProperty.call(result, "__proto__")).toBe(
        false,
      );
    });
  });

  describe("extractSecureCustomAttributes", () => {
    it("should extract whitelisted headers only", () => {
      const ctx = {
        headers: {
          get: (name: string) => {
            const headers: Record<string, string> = {
              "x-feature-flag-segment": "premium",
              "x-ab-test-group": "variant-a",
              "x-malicious-header": "bad-data",
              "x-deployment-ring": "canary",
            };
            return headers[name];
          },
          entries: () => [
            ["x-feature-flag-segment", "premium"],
            ["x-ab-test-group", "variant-a"],
            ["x-malicious-header", "bad-data"],
            ["x-deployment-ring", "canary"],
          ],
        },
      };

      const result = extractSecureCustomAttributes(ctx, DEFAULT_HEADER_CONFIG);

      expect(result.featureFlagSegment).toBe("premium");
      expect(result.abTestGroup).toBe("variant-a");
      expect(result.deploymentRing).toBe("canary");
      expect(result["x-malicious-header"]).toBeUndefined();
      expect(result.maliciousHeader).toBeUndefined();
    });

    it("should add security metadata", () => {
      const ctx = {
        headers: {
          get: () => null,
          entries: () => [],
        },
      };

      const result = extractSecureCustomAttributes(ctx);

      expect(result._headerSource).toBe(true);
      expect(result._validated).toBe(true);
      expect(typeof result._timestamp).toBe("number");
    });

    it("should log invalid headers when configured", () => {
      // Mock console.warn to capture security warnings
      const logs: string[] = [];
      const originalWarn = console.warn;
      console.warn = (msg: string) => logs.push(msg);

      const ctx = {
        headers: {
          get: (name: string) => {
            if (name === "x-feature-flag-unknown") return "value";
            return null;
          },
          entries: () => [["x-feature-flag-unknown", "value"]],
        },
      };

      extractSecureCustomAttributes(ctx, DEFAULT_HEADER_CONFIG, {
        logInvalid: true,
        strict: true,
      });

      expect(logs.some((log) => log.includes("non-whitelisted header"))).toBe(
        true,
      );

      console.warn = originalWarn;
    });
  });
});
