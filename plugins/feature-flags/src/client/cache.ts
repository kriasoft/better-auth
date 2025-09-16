// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import type { FeatureFlagsClientOptions } from "../client";

interface CacheEntry {
  value: any;
  timestamp: number;
  ttl: number;
  sessionId?: string;
}

/**
 * Session-aware LRU cache with optional persistent storage.
 * Prevents cross-user leakage, limits memory, handles quota exceeded.
 */
export class FlagCache {
  private cache: Map<string, CacheEntry> = new Map();
  private storage: Storage | null = null;
  private keyPrefix: string;
  private defaultTTL: number;
  private maxEntries: number;
  private version: string;
  private currentSessionId?: string;
  private include?: string[];
  private exclude?: string[];
  private accessOrder: string[] = [];

  constructor(options: FeatureFlagsClientOptions["cache"] = {}) {
    this.keyPrefix = options.keyPrefix || "ff_";
    this.version = options.version || "1";
    this.defaultTTL = options.ttl || 60000;
    this.maxEntries = options.maxEntries || 100;
    this.include = options.include;
    this.exclude = options.exclude;

    this.keyPrefix = `${this.keyPrefix}${this.version}_`;

    if (typeof globalThis !== "undefined" && options.storage !== "memory") {
      try {
        const storage =
          options.storage === "sessionStorage"
            ? globalThis.sessionStorage
            : globalThis.localStorage;

        if (storage) {
          const testKey = `${this.keyPrefix}_test`;
          storage.setItem(testKey, "test");
          storage.removeItem(testKey);

          this.storage = storage;
          this.loadFromStorage();
          this.cleanOldVersions();
        }
      } catch {
        this.storage = null;
      }
    }
  }

  private shouldCache(key: string): boolean {
    // Whitelist/blacklist filtering for selective caching
    if (this.exclude?.includes(key)) return false;
    if (this.include && !this.include.includes(key)) return false;
    return true;
  }

  private cleanOldVersions(): void {
    if (!this.storage) return;
    for (let i = 0; i < this.storage.length; i++) {
      const key = this.storage.key(i)!;
      if (key.startsWith("ff_") && !key.startsWith(this.keyPrefix)) {
        this.storage.removeItem(key);
        i--;
      }
    }
  }

  private loadFromStorage(): void {
    if (!this.storage) return;
    for (let i = 0; i < this.storage.length; i++) {
      const key = this.storage.key(i)!;
      if (key.startsWith(this.keyPrefix)) {
        try {
          const data = JSON.parse(this.storage.getItem(key) || "");
          if (data && typeof data === "object" && "value" in data) {
            const flagKey = key.slice(this.keyPrefix.length);
            // Load only current session data for security
            if (!data.sessionId || data.sessionId === this.currentSessionId) {
              this.cache.set(flagKey, data);
              this.accessOrder.push(flagKey);
            }
          }
        } catch {
          // Remove corrupted cache entries
          this.storage.removeItem(key);
        }
      }
    }
  }

  private evictLRU(): void {
    if (this.cache.size >= this.maxEntries && this.accessOrder.length > 0) {
      const lruKey = this.accessOrder.shift();
      if (lruKey) {
        this.cache.delete(lruKey);
        if (this.storage) this.storage.removeItem(`${this.keyPrefix}${lruKey}`);
      }
    }
  }

  private updateAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) this.accessOrder.splice(index, 1);
    this.accessOrder.push(key);
  }

  private safeStorageWrite(key: string, value: string): boolean {
    if (!this.storage) return false;
    try {
      this.storage.setItem(key, value);
      return true;
    } catch (e: any) {
      // Handle quota exceeded - clear old entries and retry
      if (e?.name === "QuotaExceededError" || e?.code === 22) {
        this.clearOldestStorageEntries(5);
        try {
          this.storage.setItem(key, value);
          return true;
        } catch {
          console.warn(
            "[feature-flags] Storage quota exceeded, using memory only",
          );
          return false;
        }
      }
      return false;
    }
  }

  private clearOldestStorageEntries(count: number): void {
    if (!this.storage) return;
    const toRemove = this.accessOrder.slice(0, count);
    for (const key of toRemove)
      this.storage.removeItem(`${this.keyPrefix}${key}`);
  }

  get(key: string): any | undefined {
    if (!this.shouldCache(key)) return undefined;
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    // TTL expiration check
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.delete(key);
      return undefined;
    }
    // Session security check
    if (entry.sessionId && entry.sessionId !== this.currentSessionId) {
      this.delete(key);
      return undefined;
    }
    this.updateAccessOrder(key);
    return entry.value;
  }

  set(key: string, value: any, ttl?: number): void {
    if (!this.shouldCache(key)) return;
    this.evictLRU(); // Make room if at capacity
    const entry: CacheEntry = {
      value,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL,
      sessionId: this.currentSessionId,
    };
    this.cache.set(key, entry);
    this.updateAccessOrder(key);
    if (this.storage) {
      const storageKey = `${this.keyPrefix}${key}`;
      this.safeStorageWrite(storageKey, JSON.stringify(entry));
    }
  }

  delete(key: string): void {
    this.cache.delete(key);
    const index = this.accessOrder.indexOf(key);
    if (index > -1) this.accessOrder.splice(index, 1);
    if (this.storage) this.storage.removeItem(`${this.keyPrefix}${key}`);
  }

  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
    if (!this.storage) return;
    for (let i = 0; i < this.storage.length; i++) {
      const key = this.storage.key(i)!;
      if (key.startsWith(this.keyPrefix)) {
        this.storage.removeItem(key);
        i--;
      }
    }
  }

  /** Batch get to reduce repeated lookups */
  getMany(keys: string[]): Map<string, any> {
    const results = new Map<string, any>();
    for (const key of keys) {
      const value = this.get(key);
      if (value !== undefined) results.set(key, value);
    }
    return results;
  }

  /** Batch set for efficient bulk operations */
  setMany(entries: Record<string, any>, ttl?: number): void {
    for (const [key, value] of Object.entries(entries))
      this.set(key, value, ttl);
  }

  /** Clear cache on session change for security */
  invalidateOnSessionChange(newSessionId?: string): void {
    const sessionChanged = newSessionId !== this.currentSessionId;
    this.currentSessionId = newSessionId;
    if (sessionChanged) this.clear(); // Prevent cross-user contamination
  }

  getCurrentSessionId(): string | undefined {
    return this.currentSessionId;
  }
}
