// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

// DJB2 hash for PII-safe cache keys
function simpleHash(data: string): string {
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, "0");
}

/**
 * LRU Cache with TTL and flag-specific invalidation.
 * @security Keys hashed to prevent PII exposure
 * @see src/storage/types.ts
 */
export class LRUCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  /** Reverse index: flagKey -> hashed cache keys for bulk invalidation */
  private flagIndex = new Map<string, Set<string>>();
  private maxSize: number;
  private defaultTTL: number;
  /** Hit/miss counters for performance monitoring */
  private hits = 0;
  private misses = 0;

  constructor(
    options: {
      /** Max entries before LRU eviction */
      maxSize?: number;
      /** Entry TTL in milliseconds */
      defaultTTL?: number;
    } = {},
  ) {
    this.maxSize = options.maxSize || 1000;
    this.defaultTTL = options.defaultTTL || 60000; // 1min default
  }

  /**
   * Creates deterministic cache key from evaluation context.
   * @security Hashes to prevent PII exposure
   */
  private createCacheKey(context: any): string {
    // Stable serialization for cache hit consistency
    const stableData = this.stabilizeObject(context);
    const dataString = JSON.stringify(stableData);
    return simpleHash(dataString);
  }

  /** Recursively sorts object keys for deterministic serialization */
  private stabilizeObject(obj: any): any {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj !== "object") return obj;
    if (Array.isArray(obj))
      return obj.map((item) => this.stabilizeObject(item));

    // Sort keys for consistent JSON.stringify output
    const sorted: Record<string, any> = {};
    const keys = Object.keys(obj).sort();

    for (const key of keys) {
      sorted[key] = this.stabilizeObject(obj[key]);
    }

    return sorted;
  }

  /** Extracts flag key from context for reverse indexing */
  private extractFlagKey(keyData: any): string | null {
    if (typeof keyData === "string") {
      return keyData;
    }

    if (keyData && typeof keyData === "object") {
      // Common property names across different flag contexts
      return keyData.flag || keyData.key || keyData.flagKey || null;
    }

    return null;
  }

  /** Removes entry and cleans up reverse index */
  private evictEntry(hashedKey: string): void {
    this.cache.delete(hashedKey);

    // Clean up reverse index to prevent memory leaks
    for (const [flagKey, keySet] of this.flagIndex.entries()) {
      keySet.delete(hashedKey);
      if (keySet.size === 0) {
        this.flagIndex.delete(flagKey);
      }
    }
  }

  /** Gets cached value, promotes to MRU position */
  get(keyData: any): T | null {
    const key = this.createCacheKey(keyData);
    const entry = this.cache.get(key);

    if (!entry) {
      this.misses++;
      return null;
    }

    // TTL expiration check
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }

    // Cache hit - promote to MRU position
    this.hits++;

    // Map insertion order = LRU order; re-insert for MRU
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.value;
  }

  /** Caches value with TTL, evicts LRU if at capacity */
  set(keyData: any, value: T, ttl?: number): void {
    const key = this.createCacheKey(keyData);
    const expiresAt = Date.now() + (ttl || this.defaultTTL);

    const flagKey = this.extractFlagKey(keyData);

    // Evict oldest entry when at capacity (for new keys only)
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.evictEntry(firstKey);
      }
    }

    // Remove existing entry to update position
    if (this.cache.has(key)) {
      this.evictEntry(key);
    }

    this.cache.set(key, {
      value,
      expiresAt,
      createdAt: Date.now(),
    });

    // Maintain reverse index for flag-based invalidation
    if (flagKey) {
      if (!this.flagIndex.has(flagKey)) {
        this.flagIndex.set(flagKey, new Set());
      }
      this.flagIndex.get(flagKey)!.add(key);
    }
  }

  /** Checks if key exists and is not expired */
  has(keyData: any): boolean {
    return this.get(keyData) !== null;
  }

  /** Deletes specific cache entry */
  delete(keyData: any): boolean {
    const key = this.createCacheKey(keyData);
    if (this.cache.has(key)) {
      this.evictEntry(key);
      return true;
    }
    return false;
  }

  /** Clears all cache entries and resets stats */
  clear(): void {
    this.cache.clear();
    this.flagIndex.clear();
    this.hits = 0;
    this.misses = 0;
  }

  /** Returns cache usage statistics */
  getStats() {
    const now = Date.now();
    let expired = 0;

    for (const entry of this.cache.values()) {
      if (now > entry.expiresAt) {
        expired++;
      }
    }

    const totalRequests = this.hits + this.misses;
    const hitRate = totalRequests > 0 ? this.hits / totalRequests : 0;

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      expired,
      hitRate: Number(hitRate.toFixed(4)), // 4-decimal precision for monitoring
      hits: this.hits,
      misses: this.misses,
      totalRequests,
    };
  }

  /** Resets hit/miss counters for monitoring windows */
  resetStats(): void {
    this.hits = 0;
    this.misses = 0;
  }

  /** Removes expired entries, returns count cleaned */
  cleanup(): number {
    const now = Date.now();
    let cleaned = 0;
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        keysToDelete.push(key);
        cleaned++;
      }
    }

    // Batch eviction to maintain reverse index consistency
    for (const key of keysToDelete) {
      this.evictEntry(key);
    }

    return cleaned;
  }

  /**
   * Invalidates all cache entries for a flag.
   * @usage Called by admin middleware after flag updates
   */
  invalidateByFlag(flagKey: string): number {
    const keySet = this.flagIndex.get(flagKey);
    if (!keySet) {
      return 0; // No entries for this flag
    }

    let invalidated = 0;
    const keysToDelete = Array.from(keySet);

    // Bulk invalidation triggered by flag config changes
    for (const hashedKey of keysToDelete) {
      if (this.cache.has(hashedKey)) {
        this.evictEntry(hashedKey);
        invalidated++;
      }
    }

    return invalidated;
  }
}

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  createdAt: number;
}
