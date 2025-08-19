// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import type { BetterAuthClientPlugin } from "better-auth/client";
import type { featureFlags } from "./index";
import { SmartPoller } from "./polling";
import { ContextSanitizer } from "./context-sanitizer";
import { SecureOverrideManager, type OverrideConfig } from "./override-manager";

// Re-export type utilities for consumer convenience
export type { BooleanFlags, ValidateFlagSchema, InferFlagValue } from "./types";

export interface FeatureFlagVariant {
  key: string;
  value: any;
  percentage?: number;
}

export interface FeatureFlagResult {
  value: any;
  variant?: FeatureFlagVariant;
  reason:
    | "default"
    | "rule_match"
    | "override"
    | "percentage"
    | "not_found"
    | "disabled";
}

/**
 * Feature flags client configuration options.
 *
 * @template Schema - Optional flag schema for type safety
 */
export interface FeatureFlagsClientOptions<
  Schema extends Record<string, any> = Record<string, any>,
> {
  /**
   * Cache configuration.
   * Controls client-side flag caching for performance and offline support.
   */
  cache?: {
    enabled?: boolean;
    ttl?: number; // TTL in ms. Flags re-evaluate server-side after expiry.
    storage?: "memory" | "localStorage" | "sessionStorage";
    keyPrefix?: string;
    version?: string; // Increment to bust cache across deployments.
    include?: string[]; // Whitelist: only these flags are cached.
    exclude?: string[]; // Blacklist: these flags bypass cache (e.g., high-frequency A/B tests).
  };

  /**
   * Smart polling with exponential backoff and jitter.
   * Prevents thundering herd and gracefully handles server issues.
   */
  polling?: {
    enabled?: boolean;
    interval?: number; // Base interval in ms. Backs off exponentially on errors.
  };

  /**
   * Default flag values
   */
  defaults?: Partial<Schema>;

  /**
   * Debug mode
   */
  debug?: boolean;

  /**
   * Error handler
   */
  onError?: (error: Error) => void;

  /**
   * Evaluation callback
   */
  onEvaluation?: (flag: string, result: any) => void;

  /**
   * Context sanitization settings.
   * Prevents PII leakage and enforces size limits.
   */
  contextSanitization?: {
    enabled?: boolean; // Default: true
    strict?: boolean; // Only allow whitelisted fields. Default: true
    allowedFields?: string[]; // Additional allowed fields beyond defaults
    maxUrlSize?: number; // Max context size for GET requests. Default: 2KB
    maxBodySize?: number; // Max context size for POST requests. Default: 10KB
    warnOnDrop?: boolean; // Log warnings when fields are dropped
  };

  /**
   * Override configuration for local testing.
   * @security Automatically disabled in production unless explicitly allowed.
   */
  overrides?: OverrideConfig;
}

export interface EvaluationContext {
  // Session context injected automatically via Better Auth.
  // These fields augment server-side evaluation rules.
  attributes?: Record<string, any>;
  device?: string;
  browser?: string;
  version?: string;
  [key: string]: any;
}

/**
 * Type-safe feature flags client interface.
 *
 * @template Schema - Optional flag schema for type safety.
 *                     Defaults to Record<string, any> for backward compatibility.
 *
 * @example
 * ```typescript
 * // Define your flag schema
 * interface MyFlags {
 *   "feature.darkMode": boolean;
 *   "experiment.algorithm": "A" | "B" | "C";
 *   "config.maxItems": number;
 * }
 *
 * // Use with type safety
 * const client: FeatureFlagsClient<MyFlags> = createAuthClient();
 * ```
 */
export interface FeatureFlagsClient<
  Schema extends Record<string, any> = Record<string, any>,
> {
  featureFlags: {
    // Core evaluation methods with type safety
    isEnabled: <K extends keyof Schema>(
      flag: K & { [P in K]: Schema[P] extends boolean ? K : never }[K],
      defaultValue?: boolean,
    ) => Promise<boolean>;
    getValue: <K extends keyof Schema>(
      flag: K,
      defaultValue?: Schema[K],
    ) => Promise<Schema[K]>;
    getVariant: <K extends keyof Schema>(
      flag: K,
    ) => Promise<FeatureFlagVariant | null>;
    getAllFlags: () => Promise<Partial<Schema>>;
    evaluateBatch: <K extends keyof Schema>(
      flags: K[],
    ) => Promise<Record<K, FeatureFlagResult>>;

    // Tracking and analytics
    track: <K extends keyof Schema>(
      flag: K,
      event: string,
      value?: number | Record<string, any>,
    ) => Promise<void>;

    // Additional context management (session is automatic)
    setContext: (context: Partial<EvaluationContext>) => void;
    getContext: () => EvaluationContext;

    // Cache management
    prefetch: <K extends keyof Schema>(flags: K[]) => Promise<void>;
    clearCache: () => void;

    // Local overrides (development)
    setOverride: <K extends keyof Schema>(flag: K, value: Schema[K]) => void;
    clearOverrides: () => void;

    // Utility methods
    refresh: () => Promise<void>;
    subscribe: (callback: (flags: Partial<Schema>) => void) => () => void;

    // Cleanup method for proper disposal
    dispose?: () => void;
  };
}

interface CacheEntry {
  value: any;
  timestamp: number;
  ttl: number;
  sessionId?: string;
}

/**
 * Session-aware LRU cache with persistent storage fallback.
 *
 * Design decisions:
 * - Session invalidation: Flags tied to user context auto-expire on login/logout.
 * - LRU eviction: Prevents unbounded memory growth (max 100 entries).
 * - Storage quota handling: Gracefully degrades to memory-only on quota errors.
 * - Version-based busting: Old cache entries removed on version bump.
 */
class FlagCache {
  private cache: Map<string, CacheEntry> = new Map();
  private storage: Storage | null = null;
  private keyPrefix: string;
  private defaultTTL: number;
  private maxEntries: number;
  private version: string;
  private currentSessionId?: string;
  private include?: string[];
  private exclude?: string[];
  private accessOrder: string[] = []; // Tracks LRU order

  constructor(options: FeatureFlagsClientOptions["cache"] = {}) {
    this.keyPrefix = options.keyPrefix || "ff_";
    this.version = options.version || "1";
    this.defaultTTL = options.ttl || 60000; // 60s default balances freshness vs API load.
    this.maxEntries = 100; // Hard limit to prevent memory leaks in long-running apps.
    this.include = options.include;
    this.exclude = options.exclude;

    // Add version to key prefix for cache busting
    this.keyPrefix = `${this.keyPrefix}${this.version}_`;

    // Storage detection works in browser, Node (with polyfill), and Edge Runtime.
    if (typeof globalThis !== "undefined" && options.storage !== "memory") {
      try {
        const storage =
          options.storage === "sessionStorage"
            ? globalThis.sessionStorage
            : globalThis.localStorage;

        if (storage) {
          // Test storage availability
          const testKey = `${this.keyPrefix}_test`;
          storage.setItem(testKey, "test");
          storage.removeItem(testKey);

          this.storage = storage;
          // Load existing cache and clean old versions
          this.loadFromStorage();
          this.cleanOldVersions();
        }
      } catch {
        // Graceful fallback for: Edge Runtime, Workers, Safari private mode.
        this.storage = null;
      }
    }
  }

  private shouldCache(key: string): boolean {
    // Exclusion takes precedence over inclusion for safety.
    if (this.exclude?.includes(key)) return false;
    if (this.include && !this.include.includes(key)) return false;
    return true;
  }

  private cleanOldVersions(): void {
    if (!this.storage) return;

    const keys = Object.keys(this.storage);
    for (const key of keys) {
      // Remove entries with different version prefix
      if (key.startsWith("ff_") && !key.startsWith(this.keyPrefix)) {
        this.storage.removeItem(key);
      }
    }
  }

  private loadFromStorage(): void {
    if (!this.storage) return;

    const keys = Object.keys(this.storage);
    for (const key of keys) {
      if (key.startsWith(this.keyPrefix)) {
        try {
          const data = JSON.parse(this.storage.getItem(key) || "");
          if (data && typeof data === "object" && "value" in data) {
            const flagKey = key.slice(this.keyPrefix.length);
            // Only load if session matches or no session specified
            if (!data.sessionId || data.sessionId === this.currentSessionId) {
              this.cache.set(flagKey, data);
              this.accessOrder.push(flagKey);
            }
          }
        } catch {
          // Invalid cache entry, remove it
          this.storage.removeItem(key);
        }
      }
    }
  }

  private evictLRU(): void {
    // Invariant: cache.size <= maxEntries after this method.
    if (this.cache.size >= this.maxEntries && this.accessOrder.length > 0) {
      const lruKey = this.accessOrder.shift();
      if (lruKey) {
        this.cache.delete(lruKey);
        if (this.storage) {
          this.storage.removeItem(`${this.keyPrefix}${lruKey}`);
        }
      }
    }
  }

  private updateAccessOrder(key: string): void {
    // Move key to end of access order (most recently used)
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
    this.accessOrder.push(key);
  }

  private safeStorageWrite(key: string, value: string): boolean {
    if (!this.storage) return false;

    try {
      this.storage.setItem(key, value);
      return true;
    } catch (e: any) {
      // DOM Exception 22 = QuotaExceededError (legacy browsers).
      if (e?.name === "QuotaExceededError" || e?.code === 22) {
        this.clearOldestStorageEntries(5);
        try {
          this.storage.setItem(key, value);
          return true;
        } catch {
          // Still failing, give up on storage
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

    // Remove oldest entries from storage
    const toRemove = this.accessOrder.slice(0, count);
    for (const key of toRemove) {
      this.storage.removeItem(`${this.keyPrefix}${key}`);
    }
  }

  get(key: string): any | undefined {
    if (!this.shouldCache(key)) return undefined;

    const entry = this.cache.get(key);
    if (!entry) return undefined;

    // TTL expiry: Ensures flags re-evaluate after configured duration.
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.delete(key);
      return undefined;
    }

    // Session mismatch: Critical for user-specific flags (e.g., subscription tier).
    if (entry.sessionId && entry.sessionId !== this.currentSessionId) {
      this.delete(key);
      return undefined;
    }

    // Update access order for LRU
    this.updateAccessOrder(key);

    return entry.value;
  }

  set(key: string, value: any, ttl?: number): void {
    if (!this.shouldCache(key)) return;

    // Evict LRU if at capacity
    this.evictLRU();

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
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
    if (this.storage) {
      this.storage.removeItem(`${this.keyPrefix}${key}`);
    }
  }

  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
    if (this.storage) {
      const keys = Object.keys(this.storage);
      for (const key of keys) {
        if (key.startsWith(this.keyPrefix)) {
          this.storage.removeItem(key);
        }
      }
    }
  }

  // Batch get reduces N cache lookups to 1 pass.
  getMany(keys: string[]): Map<string, FeatureFlagResult> {
    const results = new Map<string, FeatureFlagResult>();
    for (const key of keys) {
      const value = this.get(key);
      if (value !== undefined) {
        results.set(key, value);
      }
    }
    return results;
  }

  setMany(entries: Record<string, FeatureFlagResult>, ttl?: number): void {
    for (const [key, value] of Object.entries(entries)) {
      this.set(key, value, ttl);
    }
  }

  /**
   * Session change triggers full cache clear.
   * Prevents flag leakage between users on shared devices.
   */
  invalidateOnSessionChange(newSessionId?: string): void {
    const sessionChanged = newSessionId !== this.currentSessionId;
    this.currentSessionId = newSessionId;

    if (sessionChanged) {
      this.clear(); // Nuclear option ensures no cross-user contamination.
    }
  }

  // Get current session for tracking
  getCurrentSessionId(): string | undefined {
    return this.currentSessionId;
  }
}

/**
 * Creates a type-safe feature flags client plugin for Better Auth.
 *
 * @template Schema - Optional flag schema for full type safety.
 *                    When provided, all flag operations will be type-checked.
 *
 * @example
 * ```typescript
 * // Without schema (backward compatible)
 * const client = createAuthClient({
 *   plugins: [featureFlagsClient()]
 * });
 *
 * // With type-safe schema
 * interface MyFlags {
 *   "feature.darkMode": boolean;
 *   "experiment.variant": "A" | "B" | "C";
 * }
 *
 * const client = createAuthClient({
 *   plugins: [featureFlagsClient<MyFlags>()]
 * });
 * ```
 */
export function featureFlagsClient<
  Schema extends Record<string, any> = Record<string, any>,
>(options: FeatureFlagsClientOptions<Schema> = {}): BetterAuthClientPlugin {
  const cache = new FlagCache(options.cache);
  const overrideManager = new SecureOverrideManager(options.overrides);
  const subscribers = new Set<(flags: Partial<Schema>) => void>();
  let context: EvaluationContext = {};
  let cachedFlags: Partial<Schema> = {};
  let smartPoller: SmartPoller | null = null;
  let sessionUnsubscribe: (() => void) | null = null;
  let lastSessionId: string | undefined = undefined;

  // Initialize context sanitizer
  const sanitizer = new ContextSanitizer({
    strict: options.contextSanitization?.strict ?? true,
    allowedFields: options.contextSanitization?.allowedFields
      ? new Set(options.contextSanitization.allowedFields)
      : undefined,
    maxSizeForUrl: options.contextSanitization?.maxUrlSize,
    maxSizeForBody: options.contextSanitization?.maxBodySize,
    warnOnDrop: options.contextSanitization?.warnOnDrop,
  });
  const sanitizationEnabled = options.contextSanitization?.enabled ?? true;

  const notifySubscribers = (flags: Partial<Schema>) => {
    cachedFlags = flags;
    subscribers.forEach((callback) => callback(flags));
  };

  return {
    id: "feature-flags",
    $InferServerPlugin: {} as ReturnType<typeof featureFlags>,

    getAtoms: (atoms?: any) => {
      // Integration point with Better Auth's reactive session state.
      // Atoms pattern enables framework-agnostic reactivity.
      if (atoms?.session) {
        const unsubscribe = atoms.session.subscribe((sessionState: any) => {
          const currentSessionId = sessionState?.data?.session?.id;

          // Check if session has changed
          if (currentSessionId !== lastSessionId) {
            lastSessionId = currentSessionId;

            // Invalidate cache on session change
            cache.invalidateOnSessionChange(currentSessionId);

            // Clear cached flags to force refresh
            cachedFlags = {};

            // Notify subscribers that flags need refresh
            if (currentSessionId) {
              // Session exists, flags should be refreshed
              notifySubscribers({});
            }
          }
        });

        // Store unsubscribe function for cleanup
        sessionUnsubscribe = unsubscribe;
      }

      return {};
    },

    getActions: (fetch) => {
      const handleError = (error: Error) => {
        if (options.debug) {
          console.error("[feature-flags]", error);
        }
        options.onError?.(error);
      };

      const logEvaluation = (flag: string, result: any) => {
        if (options.debug) {
          console.log(`[feature-flags] ${flag}:`, result);
        }
        options.onEvaluation?.(flag, result);
      };

      const evaluateFlag = async (
        key: keyof Schema | string,
      ): Promise<FeatureFlagResult> => {
        // Evaluation priority: override > cache > server.
        // Overrides enable local testing without server round-trips.
        const overrideValue = overrideManager.get(String(key));
        if (overrideValue !== undefined) {
          return {
            value: overrideValue,
            reason: "override",
          };
        }

        const cached = cache.get(String(key));
        if (cached !== undefined) {
          logEvaluation(String(key), cached);
          return cached; // Cache hit avoids network latency.
        }

        try {
          const params = new URLSearchParams();
          const keyStr = String(key);
          if (options.defaults?.[key as keyof Schema] !== undefined) {
            params.set(
              "default",
              JSON.stringify(options.defaults[key as keyof Schema]),
            );
          }

          // Add sanitized context if provided
          if (Object.keys(context).length > 0) {
            const sanitizedContext = sanitizationEnabled
              ? sanitizer.sanitizeForUrl(context)
              : JSON.stringify(context);
            if (sanitizedContext) {
              params.set("context", sanitizedContext);
            }
          }

          // Leverages Better Auth's fetch wrapper for automatic auth headers.
          const response = await fetch(
            `/api/flags/evaluate/${keyStr}?${params}`,
            {
              method: "GET",
            },
          );

          const result = response.data as FeatureFlagResult;

          // Cache the result
          cache.set(keyStr, result);

          logEvaluation(keyStr, result);
          return result;
        } catch (error) {
          handleError(error as Error);

          // Fallback chain: configured default > undefined.
          // Allows graceful degradation during outages.
          if (options.defaults?.[key as keyof Schema] !== undefined) {
            return {
              value: options.defaults[key as keyof Schema],
              reason: "default",
            };
          }

          return {
            value: undefined,
            reason: "not_found",
          };
        }
      };

      const actions = {
        featureFlags: {
          async isEnabled<K extends keyof Schema>(
            flag: K & { [P in K]: Schema[P] extends boolean ? K : never }[K],
            defaultValue = false,
          ): Promise<boolean> {
            const result = await evaluateFlag(flag);
            const value = result.value ?? defaultValue;
            return Boolean(value);
          },

          async getValue<K extends keyof Schema>(
            flag: K,
            defaultValue?: Schema[K],
          ): Promise<Schema[K]> {
            const result = await evaluateFlag(flag);
            return result.value ?? defaultValue;
          },

          async getVariant<K extends keyof Schema>(
            flag: K,
          ): Promise<FeatureFlagVariant | null> {
            const result = await evaluateFlag(flag);
            return result.variant || null;
          },

          async getAllFlags(): Promise<Partial<Schema>> {
            try {
              const params = new URLSearchParams();
              if (Object.keys(context).length > 0) {
                const sanitizedContext = sanitizationEnabled
                  ? sanitizer.sanitizeForUrl(context)
                  : JSON.stringify(context);
                if (sanitizedContext) {
                  params.set("context", sanitizedContext);
                }
              }

              const response = await fetch(`/api/flags/all?${params}`, {
                method: "GET",
              });

              const data = response.data as {
                flags: Record<string, FeatureFlagResult>;
              };

              const flags: Partial<Schema> = {};
              for (const [key, result] of Object.entries(data.flags)) {
                (flags as any)[key] = result.value;
                // Cache individual flags
                cache.set(key, result);
              }

              notifySubscribers(flags);
              return flags;
            } catch (error) {
              handleError(error as Error);
              return options.defaults || {};
            }
          },

          async evaluateBatch<K extends keyof Schema>(
            keys: K[],
          ): Promise<Record<K, FeatureFlagResult>> {
            // Optimized batch evaluation: 1 network call for N flags.
            // Cache-aware to minimize server load.
            const cachedResults = cache.getMany(keys.map(String));
            const results: Record<K, FeatureFlagResult> = {} as Record<
              K,
              FeatureFlagResult
            >;
            const uncachedKeys: string[] = [];
            for (const key of keys) {
              const cached = cachedResults.get(String(key));
              if (cached) {
                results[key] = cached;
                logEvaluation(String(key), cached);
              } else {
                uncachedKeys.push(String(key));
              }
            }

            // Early return optimization for fully-cached requests.
            if (uncachedKeys.length === 0) {
              return results;
            }

            // Fetch only missing flags to respect server resources.
            try {
              const response = await fetch("/api/flags/evaluate/batch", {
                method: "POST",
                body: {
                  keys: uncachedKeys,
                  defaults: options.defaults
                    ? Object.fromEntries(
                        uncachedKeys
                          .filter(
                            (k) =>
                              options.defaults![k as keyof Schema] !==
                              undefined,
                          )
                          .map((k) => [
                            k,
                            options.defaults![k as keyof Schema],
                          ]),
                      )
                    : undefined,
                  context:
                    Object.keys(context).length > 0
                      ? sanitizationEnabled
                        ? sanitizer.sanitizeForBody(context)
                        : context
                      : undefined,
                },
              });

              const data = response.data as {
                flags: Record<string, FeatureFlagResult>;
              };

              // Step 4: Batch cache update and merge results
              cache.setMany(data.flags);

              // Log evaluations and merge with cached results
              for (const [key, result] of Object.entries(data.flags)) {
                (results as any)[key] = result;
                logEvaluation(key, result);
              }

              return results;
            } catch (error) {
              handleError(error as Error);

              // Return defaults for uncached keys, keep cached values
              for (const key of uncachedKeys) {
                results[key as K] = {
                  value: options.defaults?.[key as keyof Schema],
                  reason: "default",
                };
              }
              return results;
            }
          },

          async track<K extends keyof Schema>(
            flag: K,
            event: string,
            value?: number | Record<string, any>,
          ): Promise<void> {
            try {
              await fetch("/api/flags/track", {
                method: "POST",
                body: {
                  flagKey: String(flag),
                  event,
                  data: value,
                },
              });
            } catch (error) {
              handleError(error as Error);
            }
          },

          setContext(newContext: Partial<EvaluationContext>): void {
            // Validate context for security warnings in development
            if (options.debug && sanitizationEnabled) {
              const warnings = ContextSanitizer.validate(newContext);
              if (warnings.length > 0) {
                console.warn(
                  "[feature-flags] Context validation warnings:\n" +
                    warnings.join("\n"),
                );
              }
            }

            context = { ...context, ...newContext };
            // Context change invalidates cache as evaluation rules may differ.
            cache.clear();
          },

          getContext(): EvaluationContext {
            return { ...context };
          },

          async prefetch<K extends keyof Schema>(flags: K[]): Promise<void> {
            // Warm cache for known flags (e.g., on route change).
            // Skips already-cached flags to avoid redundant requests.
            const uncached = flags.filter(
              (key) => cache.get(String(key)) === undefined,
            );
            if (uncached.length > 0) {
              await actions.featureFlags.evaluateBatch(uncached as K[]);
            }
          },

          clearCache(): void {
            cache.clear();
          },

          setOverride<K extends keyof Schema>(flag: K, value: Schema[K]): void {
            const success = overrideManager.set(String(flag), value);
            if (success) {
              // Notify subscribers of the change
              notifySubscribers({ ...cachedFlags, [flag]: value });
            }
          },

          clearOverrides(): void {
            overrideManager.clear();
            // Refresh flags to get real values
            actions.featureFlags.refresh();
          },

          async refresh(): Promise<void> {
            cache.clear();
            const flags = await actions.featureFlags.getAllFlags();
            notifySubscribers(flags);
          },

          subscribe(callback: (flags: Partial<Schema>) => void): () => void {
            subscribers.add(callback);
            // Immediately call with current flags
            callback(cachedFlags);

            return () => {
              subscribers.delete(callback);
            };
          },

          dispose(): void {
            // Cleanup prevents memory leaks in SPAs.
            // Called on unmount or navigation in framework integrations.
            if (smartPoller) {
              smartPoller.stop();
              smartPoller = null;
            }
            if (sessionUnsubscribe) {
              sessionUnsubscribe();
              sessionUnsubscribe = null;
            }
            cache.clear();
            subscribers.clear();
            overrideManager.dispose();
          },
        },
      };

      // Smart polling setup with runtime detection.
      // setTimeout check ensures compatibility with Edge Runtime.
      if (
        options.polling?.enabled &&
        options.polling.interval &&
        typeof globalThis !== "undefined" &&
        typeof globalThis.setTimeout === "function"
      ) {
        if (smartPoller) {
          smartPoller.stop(); // Prevent duplicate pollers.
        }

        smartPoller = new SmartPoller(
          options.polling.interval,
          async () => {
            await actions.featureFlags.refresh();
          },
          (error) => {
            handleError(new Error(`Polling refresh failed: ${error.message}`));
          },
        );

        smartPoller.start();
      }

      return actions;
    },
  } satisfies BetterAuthClientPlugin;
}

export default featureFlagsClient;
