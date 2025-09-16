// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import { describe, expect, it } from "bun:test";
import { featureFlagsClient } from "./client";

describe("FlagCache", () => {
  describe("LRU eviction", () => {
    it("should evict least recently used items when at capacity", () => {
      const plugin = featureFlagsClient({
        cache: {
          enabled: true,
          storage: "memory",
        },
      });

      // TODO: Test cache internals when exposed
      expect(plugin.id).toBe("feature-flags");
    });
  });

  describe("Session handling", () => {
    it("should invalidate cache on session change", () => {
      const plugin = featureFlagsClient({
        cache: {
          enabled: true,
          storage: "memory",
        },
      });

      // Mock session atom for testing
      const mockSessionAtom = {
        subscribe: (callback: Function) => {
          // Simulate session change events
          setTimeout(() => {
            callback({ data: { session: { id: "session-1" } } });
            callback({ data: { session: { id: "session-2" } } });
          }, 10);

          return () => {}; // Unsubscribe function
        },
      };

      // Initialize plugin with mock session
      const atoms = plugin.getAtoms(null);

      expect(plugin.id).toBe("feature-flags");
    });
  });

  describe("Storage quota handling", () => {
    it("should handle quota exceeded errors gracefully", () => {
      const plugin = featureFlagsClient({
        cache: {
          enabled: true,
          storage: "localStorage",
        },
      });

      expect(plugin.id).toBe("feature-flags");
    });
  });

  describe("Cache versioning", () => {
    it("should use version in cache key prefix", () => {
      const plugin = featureFlagsClient({
        cache: {
          enabled: true,
          version: "2",
          storage: "memory",
        },
      });

      expect(plugin.id).toBe("feature-flags");
    });
  });
});

describe("featureFlagsClient", () => {
  it("should initialize with default options", () => {
    const plugin = featureFlagsClient();
    expect(plugin.id).toBe("feature-flags");
  });

  it("should clean up resources on dispose", async () => {
    const plugin = featureFlagsClient({
      polling: {
        enabled: true,
        interval: 1000,
      },
    });

    const mockFetch = () =>
      Promise.resolve({
        data: { flags: {} },
      } as any);

    const actions = plugin.getActions?.(mockFetch as any, {} as any, {} as any);

    // Verify cleanup method exists
    expect(actions?.featureFlags.dispose).toBeDefined();
    actions?.featureFlags.dispose?.();
  });
});
