// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { SecureOverrideManager } from "./override-manager";

describe("SecureOverrideManager", () => {
  let manager: SecureOverrideManager;

  afterEach(() => {
    manager?.dispose();
  });

  describe("Environment Detection", () => {
    it("should block overrides in production by default", () => {
      manager = new SecureOverrideManager({
        environment: "production",
      });

      const success = manager.set("testFlag", true);
      expect(success).toBe(false);
      expect(manager.get("testFlag")).toBeUndefined();
    });

    it("should allow overrides in development", () => {
      manager = new SecureOverrideManager({
        environment: "development",
      });

      const success = manager.set("testFlag", true);
      expect(success).toBe(true);
      expect(manager.get("testFlag")).toBe(true);
    });

    it("should allow production overrides when explicitly enabled", () => {
      manager = new SecureOverrideManager({
        environment: "production",
        allowInProduction: true,
      });

      const success = manager.set("testFlag", true);
      expect(success).toBe(true);
      expect(manager.get("testFlag")).toBe(true);
    });
  });

  describe("Expiration", () => {
    it("should expire overrides after TTL", async () => {
      manager = new SecureOverrideManager({
        environment: "development",
        ttl: 100, // 100ms for testing
      });

      manager.set("testFlag", true);
      expect(manager.get("testFlag")).toBe(true);

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 150));
      expect(manager.get("testFlag")).toBeUndefined();
    });

    it("should not return expired overrides", () => {
      manager = new SecureOverrideManager({
        environment: "development",
        ttl: -1, // Already expired
      });

      manager.set("testFlag", true);
      expect(manager.get("testFlag")).toBeUndefined();
    });

    it("should clean up expired overrides periodically", async () => {
      manager = new SecureOverrideManager({
        environment: "development",
        ttl: 50,
      });

      manager.set("flag1", true);
      manager.set("flag2", false);

      expect(manager.getAll()).toEqual({
        flag1: true,
        flag2: false,
      });

      // Wait for expiration and cleanup
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Force cleanup
      manager["cleanupExpired"]();

      expect(manager.getAll()).toEqual({});
    });
  });

  describe("Override Operations", () => {
    beforeEach(() => {
      manager = new SecureOverrideManager({
        environment: "development",
      });
    });

    it("should set and get overrides", () => {
      manager.set("flag1", true);
      manager.set("flag2", "value");
      manager.set("flag3", { nested: "object" });

      expect(manager.get("flag1")).toBe(true);
      expect(manager.get("flag2")).toBe("value");
      expect(manager.get("flag3")).toEqual({ nested: "object" });
    });

    it("should check if override exists", () => {
      manager.set("existingFlag", true);

      expect(manager.has("existingFlag")).toBe(true);
      expect(manager.has("nonExistentFlag")).toBe(false);
    });

    it("should delete specific overrides", () => {
      manager.set("flag1", true);
      manager.set("flag2", false);

      manager.delete("flag1");

      expect(manager.get("flag1")).toBeUndefined();
      expect(manager.get("flag2")).toBe(false);
    });

    it("should clear all overrides", () => {
      manager.set("flag1", true);
      manager.set("flag2", false);
      manager.set("flag3", "value");

      manager.clear();

      expect(manager.get("flag1")).toBeUndefined();
      expect(manager.get("flag2")).toBeUndefined();
      expect(manager.get("flag3")).toBeUndefined();
    });

    it("should get all active overrides", () => {
      manager.set("flag1", true);
      manager.set("flag2", "value");
      manager.set("flag3", 42);

      const all = manager.getAll();
      expect(all).toEqual({
        flag1: true,
        flag2: "value",
        flag3: 42,
      });
    });
  });

  describe("Storage Persistence", () => {
    beforeEach(() => {
      // Mock localStorage for testing
      const storage: Record<string, string> = {};
      global.localStorage = {
        getItem: (key: string) => storage[key] || null,
        setItem: (key: string, value: string) => {
          storage[key] = value;
        },
        removeItem: (key: string) => {
          delete storage[key];
        },
        clear: () => {
          Object.keys(storage).forEach((key) => delete storage[key]);
        },
        length: 0,
        key: (index: number) => null,
      };
    });

    afterEach(() => {
      // @ts-ignore - Clean up mock
      delete global.localStorage;
    });

    it("should persist overrides to localStorage", () => {
      manager = new SecureOverrideManager({
        environment: "development",
        persist: true,
        keyPrefix: "test",
      });

      manager.set("flag1", true);
      manager.set("flag2", "value");

      const stored = localStorage.getItem("test-overrides");
      expect(stored).toBeTruthy();

      const data = JSON.parse(stored!);
      expect(data.flag1.value).toBe(true);
      expect(data.flag2.value).toBe("value");
    });

    it("should load persisted overrides on init", () => {
      // Set up initial overrides
      const initialManager = new SecureOverrideManager({
        environment: "development",
        persist: true,
        keyPrefix: "test",
        ttl: 3600000, // 1 hour
      });

      initialManager.set("persistedFlag", "persisted");
      initialManager.dispose();

      // Create new manager instance
      manager = new SecureOverrideManager({
        environment: "development",
        persist: true,
        keyPrefix: "test",
      });

      expect(manager.get("persistedFlag")).toBe("persisted");
    });

    it("should not load expired overrides from storage", () => {
      const expiredData = {
        expiredFlag: {
          value: "old",
          expires: Date.now() - 1000, // Expired
          environment: "development",
        },
        validFlag: {
          value: "valid",
          expires: Date.now() + 1000000, // Still valid
          environment: "development",
        },
      };

      localStorage.setItem("test-overrides", JSON.stringify(expiredData));

      manager = new SecureOverrideManager({
        environment: "development",
        persist: true,
        keyPrefix: "test",
      });

      expect(manager.get("expiredFlag")).toBeUndefined();
      expect(manager.get("validFlag")).toBe("valid");
    });

    it("should clear storage when clearing overrides", () => {
      manager = new SecureOverrideManager({
        environment: "development",
        persist: true,
        keyPrefix: "test",
      });

      manager.set("flag1", true);
      expect(localStorage.getItem("test-overrides")).toBeTruthy();

      manager.clear();
      expect(localStorage.getItem("test-overrides")).toBeNull();
    });
  });

  describe("Security Warnings", () => {
    it("should warn about environment mismatches", () => {
      const originalWarn = console.warn;
      let warnMessage = "";
      console.warn = (msg: string) => {
        warnMessage = msg;
      };

      // Simulate override from different environment
      manager = new SecureOverrideManager({
        environment: "production",
        allowInProduction: true,
      });

      // Manually insert override with different environment
      manager["overrides"].set("testFlag", {
        value: true,
        expires: Date.now() + 10000,
        environment: "development",
      });

      manager.get("testFlag");

      expect(warnMessage).toContain(
        "was set in development but current is production",
      );

      console.warn = originalWarn;
    });

    it("should warn when trying to set overrides in production", () => {
      const originalWarn = console.warn;
      let warnMessage = "";
      console.warn = (msg: string) => {
        warnMessage = msg;
      };

      manager = new SecureOverrideManager({
        environment: "production",
      });

      manager.set("testFlag", true);

      expect(warnMessage).toContain("Overrides are disabled in production");

      console.warn = originalWarn;
    });
  });

  describe("Edge Cases", () => {
    it("should handle undefined and null values", () => {
      manager = new SecureOverrideManager({
        environment: "development",
      });

      manager.set("undefinedFlag", undefined);
      manager.set("nullFlag", null);

      expect(manager.get("undefinedFlag")).toBeUndefined();
      expect(manager.get("nullFlag")).toBeNull();
    });

    it("should handle complex objects", () => {
      manager = new SecureOverrideManager({
        environment: "development",
      });

      const complexValue = {
        nested: {
          deeply: {
            value: [1, 2, 3],
            flag: true,
          },
        },
      };

      manager.set("complexFlag", complexValue);
      expect(manager.get("complexFlag")).toEqual(complexValue);
    });

    it("should return empty object in production without allowInProduction", () => {
      manager = new SecureOverrideManager({
        environment: "production",
      });

      // Try to set some overrides (will fail)
      manager.set("flag1", true);
      manager.set("flag2", false);

      const all = manager.getAll();
      expect(all).toEqual({});
    });
  });
});
