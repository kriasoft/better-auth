// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import type { BetterAuthClientPlugin } from "better-auth/client";
import { FlagCache } from "./client/cache";
import { ContextSanitizer } from "./context-sanitizer";
import { SecureOverrideManager, type OverrideConfig } from "./override-manager";
import type { FeatureFlagsServerPlugin } from "./plugin";
import { SmartPoller } from "./polling";
import type { BooleanFlags } from "./types";

export type { EvaluationContext } from "./schema/types";
export type { BooleanFlags, InferFlagValue, ValidateFlagSchema } from "./types";

export interface FeatureFlagVariant {
  /** Unique variant identifier */
  key: string;
  /** Variant value of any type */
  value: any;
  /** Rollout percentage weight (0-100) */
  weight?: number;
}

export interface FeatureFlagResult {
  /** Evaluated flag value */
  value: any;
  /** Variant key returned by server */
  variant?: string;
  /** Evaluation reason for debugging */
  reason:
    | "default"
    | "rule_match"
    | "override"
    | "percentage_rollout"
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
  /** Client-side flag caching for performance and offline support */
  cache?: {
    enabled?: boolean;
    /** TTL in ms - flags re-evaluate server-side after expiry */
    ttl?: number;
    storage?: "memory" | "localStorage" | "sessionStorage";
    keyPrefix?: string;
    /** Increment to bust cache across deployments */
    version?: string;
    /** Maximum cache entries (default: 100) */
    maxEntries?: number;
    /** Whitelist: only these flags are cached */
    include?: string[];
    /** Blacklist: these flags bypass cache (e.g., high-frequency A/B tests) */
    exclude?: string[];
  };

  /** Smart polling with exponential backoff, prevents thundering herd */
  polling?: {
    enabled?: boolean;
    /** Base interval in ms - backs off exponentially on errors */
    interval?: number;
  };

  /** Default flag values for fallback */
  defaults?: Partial<Schema>;

  /** Enable debug logging */
  debug?: boolean;

  /** Global error handler for flag evaluation failures */
  onError?: (error: Error) => void;

  /** Called after each flag evaluation for analytics */
  onEvaluation?: (flag: string, result: any) => void;

  /** Context sanitization - prevents PII leakage and enforces size limits */
  contextSanitization?: {
    /** Default: true */
    enabled?: boolean;
    /** Only allow whitelisted fields (default: true) */
    strict?: boolean;
    /** Additional allowed fields beyond defaults */
    allowedFields?: string[];
    /** Max context size for GET requests (default: 2KB) */
    maxUrlSize?: number;
    /** Max context size for POST requests (default: 10KB) */
    maxBodySize?: number;
    /** Log warnings when fields are dropped */
    warnOnDrop?: boolean;
  };

  /** Override config for local testing - auto-disabled in production */
  overrides?: OverrideConfig;
}

import type { EvaluationContext } from "./schema/types";

/**
 * Type-safe feature flags client interface.
 *
 * @template Schema - Optional flag schema for type safety
 * @example
 * interface MyFlags {
 *   "feature.darkMode": boolean;
 *   "experiment.algorithm": "A" | "B" | "C";
 * }
 * const client: FeatureFlagsClient<MyFlags> = createAuthClient();
 */
export interface FeatureFlagsClient<
  Schema extends Record<string, any> = Record<string, any>,
> {
  featureFlags: {
    /** Check if boolean flag is enabled */
    isEnabled: <K extends BooleanFlags<Schema>>(
      flag: K,
      defaultValue?: boolean,
    ) => Promise<boolean>;
    /** Get typed flag value with fallback */
    getValue: <K extends keyof Schema>(
      flag: K,
      defaultValue?: Schema[K],
    ) => Promise<Schema[K]>;
    /** Get variant key for A/B tests */
    getVariant: <K extends keyof Schema>(flag: K) => Promise<string | null>;

    // === CANONICAL PUBLIC API ===
    /** Evaluate single flag */
    evaluate: <K extends keyof Schema>(
      flag: K,
      options?: {
        default?: Schema[K];
        context?: EvaluationContext;
        environment?: string;
        select?:
          | "value"
          | "full"
          | Array<"value" | "variant" | "reason" | "metadata">;
        contextInResponse?: boolean;
      },
    ) => Promise<FeatureFlagResult>;
    /** Evaluate multiple flags efficiently */
    evaluateMany: <K extends keyof Schema>(
      flags: K[],
      options?: {
        defaults?: Partial<Record<K, Schema[K]>>;
        context?: EvaluationContext;
        environment?: string;
        select?:
          | "value"
          | "full"
          | Array<"value" | "variant" | "reason" | "metadata">;
        contextInResponse?: boolean;
      },
    ) => Promise<Record<K, FeatureFlagResult>>;
    /** Bootstrap all flags for client */
    bootstrap: (options?: {
      context?: EvaluationContext;
      environment?: string;
      include?: string[];
      prefix?: string;
      select?:
        | "value"
        | "full"
        | Array<"value" | "variant" | "reason" | "metadata">;
      contextInResponse?: boolean;
    }) => Promise<Partial<Schema>>;
    /** Track flag events for analytics */
    track: <K extends keyof Schema>(
      flag: K,
      event: string,
      value?: number | Record<string, any>,
      options?: {
        idempotencyKey?: string;
        timestamp?: Date;
        sampleRate?: number;
        debug?: boolean;
      },
    ) => Promise<{ success: boolean; eventId: string; sampled?: boolean }>;
    /** Track multiple flag events in a single batch for efficiency */
    trackBatch: <K extends keyof Schema>(
      events: Array<{
        flag: K;
        event: string;
        data?: number | Record<string, any>;
        timestamp?: Date;
        sampleRate?: number;
      }>,
      options?: { idempotencyKey?: string; sampleRate?: number },
    ) => Promise<{
      success: number;
      failed: number;
      sampled?: number;
      batchId: string;
    }>;

    /** Set evaluation context (session auto-managed) */
    setContext: (context: Partial<EvaluationContext>) => void;
    /** Get current evaluation context */
    getContext: () => EvaluationContext;

    /** Warm cache for known flags */
    prefetch: <K extends keyof Schema>(flags: K[]) => Promise<void>;
    /** Clear all cached flags */
    clearCache: () => void;

    /** Override flag value for local testing */
    setOverride: <K extends keyof Schema>(flag: K, value: Schema[K]) => void;
    /** Clear all local overrides */
    clearOverrides: () => void;

    /** Force refresh all flags from server */
    refresh: () => Promise<void>;
    /** Subscribe to flag changes */
    subscribe: (callback: (flags: Partial<Schema>) => void) => () => void;

    /** Cleanup resources and stop polling */
    dispose?: () => void;

    // === ADMIN NAMESPACE (canonical per API spec) ===
    admin: {
      /** Flags management */
      flags: {
        list: (options?: {
          organizationId?: string;
          cursor?: string;
          limit?: number;
          q?: string;
          sort?: string;
          include?: "stats";
        }) => Promise<{
          flags: any[];
          page: { nextCursor?: string; limit: number; hasMore: boolean };
        }>;
        create: (flag: {
          key: string;
          name: string;
          description?: string;
          enabled?: boolean;
          type: "string" | "number" | "boolean" | "json";
          defaultValue: any;
          rolloutPercentage?: number;
          organizationId?: string;
        }) => Promise<any>;
        get: (id: string) => Promise<any>;
        update: (
          id: string,
          updates: {
            key?: string;
            name?: string;
            description?: string;
            enabled?: boolean;
            type?: "string" | "number" | "boolean" | "json";
            defaultValue?: any;
            rolloutPercentage?: number;
          },
        ) => Promise<any>;
        delete: (id: string) => Promise<{ success: boolean }>;
        enable: (id: string) => Promise<any>;
        disable: (id: string) => Promise<any>;
      };

      /** Rules management */
      rules: {
        list: (flagId: string) => Promise<{ rules: any[] }>;
        create: (rule: {
          flagId: string;
          priority: number;
          conditions: any;
          value: any;
          variant?: string;
        }) => Promise<any>;
        get: (flagId: string, ruleId: string) => Promise<any>;
        update: (flagId: string, ruleId: string, updates: any) => Promise<any>;
        delete: (flagId: string, ruleId: string) => Promise<any>;
        reorder: (flagId: string, ids: string[]) => Promise<any>;
      };

      /** Overrides management */
      overrides: {
        list: (options?: {
          organizationId?: string;
          cursor?: string;
          limit?: number;
          q?: string;
          sort?: string; // e.g., "-createdAt"
          flagId?: string;
          userId?: string;
        }) => Promise<{
          overrides: any[];
          page: { nextCursor?: string; limit: number; hasMore: boolean };
        }>;
        create: (override: {
          flagId: string;
          userId: string;
          value: any;
          enabled?: boolean;
          variant?: string;
          expiresAt?: string;
        }) => Promise<any>;
        get: (id: string) => Promise<any>;
        update: (id: string, updates: any) => Promise<any>;
        delete: (id: string) => Promise<any>;
      };

      /** Analytics */
      analytics: {
        stats: {
          get: (
            flagId: string,
            options?: {
              granularity?: "hour" | "day" | "week" | "month";
              start?: string;
              end?: string;
              timezone?: string;
            },
          ) => Promise<{ stats: any }>;
        };
        usage: {
          get: (options?: {
            start?: string;
            end?: string;
            timezone?: string;
            organizationId?: string;
          }) => Promise<{ usage: any }>;
        };
      };

      /** Audit logs */
      audit: {
        list: (options: {
          flagId?: string;
          userId?: string;
          action?: "create" | "update" | "delete" | "evaluate";
          startDate?: string;
          endDate?: string;
          limit?: number;
          offset?: number;
        }) => Promise<{ entries: any[] }>;
        get: (id: string) => Promise<any>;
      };

      /** Environments */
      environments: {
        list: () => Promise<{ environments: any[] }>;
        create: (env: any) => Promise<any>;
        update: (id: string, updates: any) => Promise<any>;
        delete: (id: string) => Promise<any>;
      };

      /** Data exports */
      exports: {
        create: (options: any) => Promise<any>;
      };
    };
  };
}

// REF: ./client/cache.ts for FlagCache implementation

/**
 * Creates a type-safe feature flags client plugin for Better Auth.
 *
 * @template Schema - Optional flag schema for type safety
 * @see src/endpoints/ for server implementation
 */
export function featureFlagsClient<
  Schema extends Record<string, any> = Record<string, any>,
>(options: FeatureFlagsClientOptions<Schema> = {}) {
  const cache = new FlagCache(options.cache);
  const overrideManager = new SecureOverrideManager(options.overrides);
  const subscribers = new Set<(flags: Partial<Schema>) => void>();
  let context: EvaluationContext = {};
  let cachedFlags: Partial<Schema> = {};
  let smartPoller: SmartPoller | null = null;
  let sessionUnsubscribe: (() => void) | null = null;
  let lastSessionId: string | undefined = undefined;

  // Context sanitization prevents PII leakage (see: src/context-sanitizer.ts)
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
    $InferServerPlugin: {} as FeatureFlagsServerPlugin,

    // HTTP methods for feature-flags endpoints - canonical only
    pathMethods: {
      // Public endpoints
      "/feature-flags/evaluate": "POST",
      "/feature-flags/evaluate-batch": "POST",
      "/feature-flags/bootstrap": "POST",
      "/feature-flags/events": "POST",
      "/feature-flags/events/batch": "POST",
      "/feature-flags/config": "GET",
      "/feature-flags/health": "GET",

      // Admin endpoints (RESTful)
      "/feature-flags/admin/flags": "GET",
      "/feature-flags/admin/flags/:id": "GET",
      "/feature-flags/admin/flags/:id/enable": "POST",
      "/feature-flags/admin/flags/:id/disable": "POST",
      "/feature-flags/admin/flags/:flagId/rules": "GET",
      "/feature-flags/admin/flags/:flagId/rules/:ruleId": "GET",
      "/feature-flags/admin/flags/:flagId/rules/reorder": "POST",
      "/feature-flags/admin/flags/:flagId/stats": "GET",
      "/feature-flags/admin/overrides": "GET",
      "/feature-flags/admin/overrides/:id": "GET",
      "/feature-flags/admin/metrics/usage": "GET",
      "/feature-flags/admin/audit": "GET",
      "/feature-flags/admin/audit/:id": "GET",
      "/feature-flags/admin/environments": "GET",
      "/feature-flags/admin/environments/:id": "GET",
      "/feature-flags/admin/export": "POST",
    },

    // No atoms exposed currently
    getAtoms: (..._args: any[]) => ({}),

    getActions: (
      fetch: any,
      $store: any,
      _clientOptions: import("better-auth/client").ClientOptions | undefined,
    ) => {
      // Session subscription invalidates cache on user change
      if ($store?.atoms?.session) {
        const unsubscribe = $store.atoms.session.subscribe(
          (sessionState: any) => {
            const currentSessionId = sessionState?.data?.session?.id;

            if (currentSessionId !== lastSessionId) {
              lastSessionId = currentSessionId;

              // Prevent cross-user flag contamination
              cache.invalidateOnSessionChange(currentSessionId);

              cachedFlags = {};

              // Refresh flags for new authenticated sessions
              if (currentSessionId) {
                notifySubscribers({});
              }
            }
          },
        );

        sessionUnsubscribe = unsubscribe;
      }

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
        evaluateOptions?: {
          track?: boolean;
          select?:
            | "value"
            | "full"
            | Array<"value" | "variant" | "reason" | "metadata">;
          debug?: boolean;
          contextInResponse?: boolean;
        },
      ): Promise<FeatureFlagResult> => {
        // Priority: override > cache > server evaluation
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
          return cached; // Cache hit - no network call
        }

        try {
          const keyStr = String(key);

          // Better Auth fetch includes auth headers automatically
          const requestBody: any = {
            flagKey: keyStr,
            context:
              Object.keys(context).length > 0
                ? sanitizationEnabled
                  ? sanitizer.sanitizeForBody(context)
                  : context
                : undefined,
            default: options.defaults?.[key as keyof Schema],
          };

          // Add optional parameters if provided
          if (evaluateOptions?.track !== undefined) {
            requestBody.track = evaluateOptions.track;
          }
          if (evaluateOptions?.select !== undefined) {
            requestBody.select = evaluateOptions.select;
          }
          if (evaluateOptions?.debug !== undefined) {
            requestBody.debug = evaluateOptions.debug;
          }
          if (evaluateOptions?.contextInResponse !== undefined) {
            requestBody.contextInResponse = evaluateOptions.contextInResponse;
          }

          const response = await fetch(`/feature-flags/evaluate`, {
            method: "POST",
            body: requestBody,
          });

          const result = response.data as FeatureFlagResult;

          cache.set(keyStr, result);

          logEvaluation(keyStr, result);
          return result;
        } catch (error) {
          handleError(error as Error);

          // Graceful degradation during server outages
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
          async isEnabled<K extends BooleanFlags<Schema>>(
            flag: K,
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
          ): Promise<string | null> {
            const result = await evaluateFlag(flag);
            return result.variant || null;
          },

          // Core evaluation methods

          async evaluate<K extends keyof Schema>(
            flag: K,
            opts?: {
              default?: Schema[K];
              context?: EvaluationContext;
              environment?: string;
              select?:
                | "value"
                | "full"
                | Array<"value" | "variant" | "reason" | "metadata">;
              contextInResponse?: boolean;
              track?: boolean;
              debug?: boolean;
            },
          ): Promise<FeatureFlagResult> {
            // Back-compat: if previous signature used, opts may be default value
            let defaultValue: any = undefined;
            let environment: string | undefined = undefined;
            // Context override is currently not applied; use setContext() instead
            if (
              opts &&
              typeof opts === "object" &&
              ("default" in opts ||
                "environment" in opts ||
                "select" in opts ||
                "contextInResponse" in opts ||
                "track" in opts ||
                "debug" in opts ||
                "context" in opts)
            ) {
              defaultValue = (opts as any).default;
              environment = (opts as any).environment;
            }

            // Temporarily enrich context with environment for this call
            const originalContext = { ...context };
            if (environment) {
              const next = { ...context } as any;
              next.attributes = { ...(next.attributes || {}), environment };
              context = next;
            }
            try {
              const result = await evaluateFlag(flag, opts);
              return defaultValue !== undefined && result.value === undefined
                ? { ...result, value: defaultValue }
                : result;
            } finally {
              // Restore context
              context = originalContext;
            }
          },

          async evaluateMany<K extends keyof Schema>(
            keys: K[],
            opts?: {
              defaults?: Partial<Record<K, Schema[K]>>;
              context?: EvaluationContext;
              environment?: string;
              select?:
                | "value"
                | "full"
                | Array<"value" | "variant" | "reason" | "metadata">;
              contextInResponse?: boolean;
              track?: boolean;
              debug?: boolean;
            },
          ): Promise<Record<K, FeatureFlagResult>> {
            // Batch optimization: 1 network call for N flags, cache-aware
            const cachedResults = cache.getMany(keys.map(String));
            const results: Record<K, FeatureFlagResult> = {} as Record<
              K,
              FeatureFlagResult
            >;
            const uncachedKeys: string[] = [];
            const defaultsMap = (opts?.defaults || {}) as Record<string, any>;
            for (const key of keys) {
              const cached = cachedResults.get(String(key));
              if (cached) {
                results[key] = cached;
                logEvaluation(String(key), cached);
              } else {
                uncachedKeys.push(String(key));
              }
            }

            // Skip network if all flags cached
            if (uncachedKeys.length === 0) {
              return results;
            }

            // Fetch only uncached flags
            try {
              // Optionally enrich context with environment for this call
              const originalContext = { ...context } as any;
              if (opts?.environment) {
                const next = { ...context } as any;
                next.attributes = {
                  ...(next.attributes || {}),
                  environment: opts.environment,
                };
                context = next;
              }
              const batchRequestBody: any = {
                flagKeys: uncachedKeys,
                defaults:
                  Object.keys(defaultsMap).length > 0
                    ? Object.fromEntries(
                        uncachedKeys
                          .filter((k) => defaultsMap[k] !== undefined)
                          .map((k) => [k, defaultsMap[k]]),
                      )
                    : undefined,
                context:
                  Object.keys(context).length > 0
                    ? sanitizationEnabled
                      ? sanitizer.sanitizeForBody(context)
                      : context
                    : undefined,
                // Do not pass select='value' from client to keep return type stable
                // environment support via context enrichment below
              };

              // Add optional parameters if provided
              if (opts?.track !== undefined) {
                batchRequestBody.track = opts.track;
              }
              if (opts?.select !== undefined) {
                batchRequestBody.select = opts.select;
              }
              if (opts?.debug !== undefined) {
                batchRequestBody.debug = opts.debug;
              }
              if (opts?.contextInResponse !== undefined) {
                batchRequestBody.contextInResponse = opts.contextInResponse;
              }

              const response = await fetch("/feature-flags/evaluate-batch", {
                method: "POST",
                body: batchRequestBody,
              });
              // Restore context after preparing body
              context = originalContext;

              const data = response.data as {
                flags: Record<string, FeatureFlagResult>;
                evaluatedAt?: string; // ISO string when received over HTTP
              };

              // Batch cache update
              cache.setMany(data.flags);

              // Merge server results with cache
              for (const [key, result] of Object.entries(data.flags)) {
                (results as any)[key] = result as FeatureFlagResult;
                logEvaluation(key, result);
              }

              return results;
            } catch (error) {
              handleError(error as Error);

              // Fallback to defaults on failure
              for (const key of uncachedKeys) {
                results[key as K] = {
                  value: defaultsMap[key],
                  reason: "default",
                } as FeatureFlagResult as any;
              }
              return results;
            }
          },

          async bootstrap(options?: {
            context?: EvaluationContext;
            environment?: string;
            include?: string[];
            prefix?: string;
            select?:
              | "value"
              | "full"
              | Array<"value" | "variant" | "reason" | "metadata">;
            contextInResponse?: boolean;
            track?: boolean;
            debug?: boolean;
            defaults?: Partial<Schema>;
          }): Promise<Partial<Schema>> {
            try {
              const bootstrapRequestBody: any = {
                include: options?.include,
                prefix: options?.prefix,
                environment: options?.environment,
                context:
                  Object.keys(context).length > 0
                    ? sanitizationEnabled
                      ? sanitizer.sanitizeForBody(context)
                      : context
                    : undefined,
              };

              // Add optional parameters if provided
              if (options?.select !== undefined) {
                bootstrapRequestBody.select = options.select;
              }
              if (options?.track !== undefined) {
                bootstrapRequestBody.track = options.track;
              }
              if (options?.debug !== undefined) {
                bootstrapRequestBody.debug = options.debug;
              }
              if (options?.contextInResponse !== undefined) {
                bootstrapRequestBody.contextInResponse =
                  options.contextInResponse;
              }

              const response = await fetch(`/feature-flags/bootstrap`, {
                method: "POST",
                body: bootstrapRequestBody,
              });

              const data = response.data as {
                flags: Record<string, FeatureFlagResult>;
              };

              const flags: Partial<Schema> = {};
              for (const [key, result] of Object.entries(data.flags)) {
                (flags as any)[key] = result.value;
                // Cache bootstrap results individually
                cache.set(key, result);
              }

              notifySubscribers(flags);
              return flags;
            } catch (error) {
              handleError(error as Error);
              return options?.defaults || {};
            }
          },

          async track<K extends keyof Schema>(
            flag: K,
            event: string,
            value?: number | Record<string, any>,
            options?: {
              idempotencyKey?: string;
              timestamp?: Date;
              sampleRate?: number;
              debug?: boolean;
            },
          ): Promise<{ success: boolean; eventId: string; sampled?: boolean }> {
            try {
              // CLIENT-SIDE SAMPLING: Skip network call if sampled out
              if (
                options?.sampleRate !== undefined &&
                typeof options.sampleRate === "number"
              ) {
                if (options.sampleRate < 0 || options.sampleRate > 1) {
                  throw new Error("sampleRate must be between 0 and 1");
                }

                // Probabilistic sampling: skip if random value exceeds sample rate
                if (Math.random() > options.sampleRate) {
                  if (options.debug) {
                    console.log(
                      `[feature-flags] Event sampled out (rate: ${options.sampleRate})`,
                    );
                  }
                  return {
                    success: true,
                    eventId: "sampled_out",
                    sampled: true,
                  };
                }
              }

              const headers: Record<string, string> = {};
              if (options?.idempotencyKey) {
                headers["Idempotency-Key"] = options.idempotencyKey;
              }

              const response = await fetch("/feature-flags/events", {
                method: "POST",
                headers,
                body: {
                  flagKey: String(flag),
                  event: event,
                  properties: value,
                  timestamp: options?.timestamp,
                  sampleRate: options?.sampleRate,
                },
              });
              return response.data;
            } catch (error) {
              handleError(error as Error);
              return { success: false, eventId: "" };
            }
          },

          async trackBatch<K extends keyof Schema>(
            events: Array<{
              flag: K;
              event: string;
              data?: number | Record<string, any>;
              timestamp?: Date;
              sampleRate?: number;
            }>,
            options?: { idempotencyKey?: string; sampleRate?: number },
          ): Promise<{
            success: number;
            failed: number;
            sampled?: number;
            batchId: string;
          }> {
            try {
              // CLIENT-SIDE SAMPLING: Filter out events based on sampling
              const filteredEvents = [];
              let sampledCount = 0;

              for (const eventData of events) {
                const eventSampleRate =
                  eventData.sampleRate ?? options?.sampleRate;

                if (
                  eventSampleRate !== undefined &&
                  typeof eventSampleRate === "number"
                ) {
                  if (eventSampleRate < 0 || eventSampleRate > 1) {
                    continue; // Skip invalid sample rates
                  }

                  // Probabilistic sampling: skip if random value exceeds sample rate
                  if (Math.random() > eventSampleRate) {
                    sampledCount++;
                    continue;
                  }
                }

                filteredEvents.push(eventData);
              }

              // If all events were sampled out, return early
              if (filteredEvents.length === 0) {
                return {
                  success: 0,
                  failed: 0,
                  sampled: sampledCount,
                  batchId: "sampled_out",
                };
              }

              // Transform for server schema
              const transformedEvents = filteredEvents.map(
                ({ flag, event, data, timestamp, sampleRate }) => ({
                  flagKey: String(flag),
                  event: event,
                  properties: data,
                  timestamp,
                  sampleRate,
                }),
              );

              const response = await fetch("/feature-flags/events/batch", {
                method: "POST",
                body: {
                  events: transformedEvents,
                  sampleRate: options?.sampleRate,
                  idempotencyKey: options?.idempotencyKey,
                },
              });

              const result = response.data;
              return {
                ...result,
                sampled: sampledCount + (result.sampled || 0),
              };
            } catch (error) {
              handleError(error as Error);
              // Return failure metrics
              return {
                success: 0,
                failed: events.length,
                sampled: 0,
                batchId: options?.idempotencyKey || "",
              };
            }
          },

          setContext(newContext: Partial<EvaluationContext>): void {
            // Validate context in debug mode (security)
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
            // Context change invalidates cache (rules may differ)
            cache.clear();
          },

          getContext(): EvaluationContext {
            return { ...context };
          },

          async prefetch<K extends keyof Schema>(flags: K[]): Promise<void> {
            // Warm cache for route changes
            const uncached = flags.filter(
              (key) => cache.get(String(key)) === undefined,
            );
            if (uncached.length > 0) {
              await actions.featureFlags.evaluateMany(uncached as K[]);
            }
          },

          clearCache(): void {
            cache.clear();
          },

          setOverride<K extends keyof Schema>(flag: K, value: Schema[K]): void {
            const success = overrideManager.set(String(flag), value);
            if (success) {
              // Notify subscribers of local override
              notifySubscribers({ ...cachedFlags, [flag]: value });
            }
          },

          clearOverrides(): void {
            overrideManager.clear();
            // Refresh with real server values
            actions.featureFlags.refresh();
          },

          async refresh(): Promise<void> {
            cache.clear();
            const flags = await actions.featureFlags.bootstrap();
            notifySubscribers(flags);
          },

          subscribe(callback: (flags: Partial<Schema>) => void): () => void {
            subscribers.add(callback);
            // Immediate callback with current flags
            callback(cachedFlags);

            return () => {
              subscribers.delete(callback);
            };
          },

          // Admin API methods
          admin: {
            // Flag CRUD operations
            flags: {
              async list(options?: {
                organizationId?: string;
                cursor?: string;
                limit?: number;
                q?: string;
                sort?: string;
                include?: "stats";
              }): Promise<{
                flags: any[];
                page: { nextCursor?: string; limit: number; hasMore: boolean };
              }> {
                try {
                  const response = await fetch("/feature-flags/admin/flags", {
                    method: "GET",
                    query: options,
                  });
                  return response.data;
                } catch (error) {
                  handleError(error as Error);
                  return { flags: [], page: { limit: 50, hasMore: false } };
                }
              },

              async create(flag: {
                key: string;
                name: string;
                description?: string;
                enabled?: boolean;
                type: "string" | "number" | "boolean" | "json";
                defaultValue: any;
                rolloutPercentage?: number;
                organizationId?: string;
              }): Promise<any> {
                try {
                  const response = await fetch("/feature-flags/admin/flags", {
                    method: "POST",
                    body: flag,
                  });
                  return response.data;
                } catch (error) {
                  handleError(error as Error);
                  throw error;
                }
              },

              async get(id: string): Promise<any> {
                try {
                  const response = await fetch(
                    `/feature-flags/admin/flags/${id}`,
                    {
                      method: "GET",
                    },
                  );
                  return response.data;
                } catch (error) {
                  handleError(error as Error);
                  throw error;
                }
              },

              async update(
                id: string,
                updates: {
                  key?: string;
                  name?: string;
                  description?: string;
                  enabled?: boolean;
                  type?: "string" | "number" | "boolean" | "json";
                  defaultValue?: any;
                  rolloutPercentage?: number;
                },
              ): Promise<any> {
                try {
                  const response = await fetch(
                    `/feature-flags/admin/flags/${id}`,
                    {
                      method: "PATCH",
                      body: updates,
                    },
                  );
                  return response.data;
                } catch (error) {
                  handleError(error as Error);
                  throw error;
                }
              },

              async delete(id: string): Promise<{ success: boolean }> {
                try {
                  const response = await fetch(
                    `/feature-flags/admin/flags/${id}`,
                    {
                      method: "DELETE",
                    },
                  );
                  return response.data;
                } catch (error) {
                  handleError(error as Error);
                  throw error;
                }
              },

              async enable(id: string): Promise<any> {
                try {
                  const response = await fetch(
                    `/feature-flags/admin/flags/${id}/enable`,
                    {
                      method: "POST",
                    },
                  );
                  return response.data;
                } catch (error) {
                  handleError(error as Error);
                  throw error;
                }
              },

              async disable(id: string): Promise<any> {
                try {
                  const response = await fetch(
                    `/feature-flags/admin/flags/${id}/disable`,
                    {
                      method: "POST",
                    },
                  );
                  return response.data;
                } catch (error) {
                  handleError(error as Error);
                  throw error;
                }
              },
            },

            // Rule CRUD operations
            rules: {
              async list(flagId: string): Promise<{ rules: any[] }> {
                try {
                  const response = await fetch(
                    `/feature-flags/admin/flags/${flagId}/rules`,
                    {
                      method: "GET",
                    },
                  );
                  return response.data;
                } catch (error) {
                  handleError(error as Error);
                  return { rules: [] };
                }
              },

              async create(rule: {
                flagId: string;
                priority: number;
                conditions: any;
                value: any;
                variant?: string;
              }): Promise<any> {
                try {
                  const response = await fetch(
                    `/feature-flags/admin/flags/${rule.flagId}/rules`,
                    {
                      method: "POST",
                      body: rule,
                    },
                  );
                  return response.data;
                } catch (error) {
                  handleError(error as Error);
                  throw error;
                }
              },

              async get(flagId: string, ruleId: string): Promise<any> {
                try {
                  const response = await fetch(
                    `/feature-flags/admin/flags/${flagId}/rules/${ruleId}`,
                    {
                      method: "GET",
                    },
                  );
                  return response.data;
                } catch (error) {
                  handleError(error as Error);
                  throw error;
                }
              },

              async update(
                flagId: string,
                ruleId: string,
                updates: any,
              ): Promise<any> {
                try {
                  const response = await fetch(
                    `/feature-flags/admin/flags/${flagId}/rules/${ruleId}`,
                    {
                      method: "PATCH",
                      body: updates,
                    },
                  );
                  return response.data;
                } catch (error) {
                  handleError(error as Error);
                  throw error;
                }
              },

              async delete(flagId: string, ruleId: string): Promise<any> {
                try {
                  const response = await fetch(
                    `/feature-flags/admin/flags/${flagId}/rules/${ruleId}`,
                    {
                      method: "DELETE",
                    },
                  );
                  return response.data;
                } catch (error) {
                  handleError(error as Error);
                  throw error;
                }
              },

              async reorder(flagId: string, ids: string[]): Promise<any> {
                try {
                  const response = await fetch(
                    `/feature-flags/admin/flags/${flagId}/rules/reorder`,
                    {
                      method: "POST",
                      body: { ids },
                    },
                  );
                  return response.data;
                } catch (error) {
                  handleError(error as Error);
                  throw error;
                }
              },
            },

            // Override CRUD operations
            overrides: {
              async list(options?: {
                organizationId?: string;
                cursor?: string;
                limit?: number;
                q?: string;
                sort?: string; // e.g., "-createdAt"
                flagId?: string;
                userId?: string;
              }): Promise<{
                overrides: any[];
                page: { nextCursor?: string; limit: number; hasMore: boolean };
              }> {
                try {
                  const response = await fetch(
                    "/feature-flags/admin/overrides",
                    {
                      method: "GET",
                      query: options,
                    },
                  );
                  return response.data;
                } catch (error) {
                  handleError(error as Error);
                  return { overrides: [], page: { limit: 50, hasMore: false } };
                }
              },

              async create(override: {
                flagId: string;
                userId: string;
                value: any;
                enabled?: boolean;
                variant?: string;
                expiresAt?: string;
              }): Promise<any> {
                try {
                  const response = await fetch(
                    "/feature-flags/admin/overrides",
                    {
                      method: "POST",
                      body: override,
                    },
                  );
                  return response.data;
                } catch (error) {
                  handleError(error as Error);
                  throw error;
                }
              },

              async get(id: string): Promise<any> {
                try {
                  const response = await fetch(
                    `/feature-flags/admin/overrides/${id}`,
                    {
                      method: "GET",
                    },
                  );
                  return response.data;
                } catch (error) {
                  handleError(error as Error);
                  throw error;
                }
              },

              async update(id: string, updates: any): Promise<any> {
                try {
                  const response = await fetch(
                    `/feature-flags/admin/overrides/${id}`,
                    {
                      method: "PATCH",
                      body: updates,
                    },
                  );
                  return response.data;
                } catch (error) {
                  handleError(error as Error);
                  throw error;
                }
              },

              async delete(id: string): Promise<any> {
                try {
                  const response = await fetch(
                    `/feature-flags/admin/overrides/${id}`,
                    {
                      method: "DELETE",
                    },
                  );
                  return response.data;
                } catch (error) {
                  handleError(error as Error);
                  throw error;
                }
              },
            },

            // Analytics
            analytics: {
              stats: {
                async get(
                  flagId: string,
                  options: {
                    granularity?: "hour" | "day" | "week" | "month";
                    start?: string;
                    end?: string;
                    timezone?: string;
                  } = {},
                ): Promise<{ stats: any }> {
                  try {
                    const response = await fetch(
                      `/feature-flags/admin/flags/${flagId}/stats`,
                      {
                        method: "GET",
                        query: options,
                      },
                    );
                    return response.data;
                  } catch (error) {
                    handleError(error as Error);
                    return { stats: {} };
                  }
                },
              },

              usage: {
                async get(
                  options: {
                    start?: string;
                    end?: string;
                    timezone?: string;
                    organizationId?: string;
                  } = {},
                ): Promise<{ usage: any }> {
                  try {
                    const response = await fetch(
                      "/feature-flags/admin/metrics/usage",
                      {
                        method: "GET",
                        query: options,
                      },
                    );
                    return response.data;
                  } catch (error) {
                    handleError(error as Error);
                    return { usage: {} };
                  }
                },
              },
            },

            // Audit logs
            audit: {
              async list(_options: {
                flagId?: string;
                userId?: string;
                action?: "create" | "update" | "delete" | "evaluate";
                startDate?: string;
                endDate?: string;
                limit?: number;
                offset?: number;
              }): Promise<{ entries: any[] }> {
                try {
                  const response = await fetch("/feature-flags/admin/audit", {
                    method: "GET",
                  });
                  return response.data;
                } catch (error) {
                  handleError(error as Error);
                  return { entries: [] };
                }
              },

              async get(id: string): Promise<any> {
                try {
                  const response = await fetch(
                    `/feature-flags/admin/audit/${id}`,
                    {
                      method: "GET",
                    },
                  );
                  return response.data;
                } catch (error) {
                  handleError(error as Error);
                  throw error;
                }
              },
            },

            // Environments
            environments: {
              async list(): Promise<{ environments: any[] }> {
                try {
                  const response = await fetch(
                    "/feature-flags/admin/environments",
                    {
                      method: "GET",
                    },
                  );
                  return response.data;
                } catch (error) {
                  handleError(error as Error);
                  return { environments: [] };
                }
              },
              async create(env: any): Promise<any> {
                try {
                  const response = await fetch(
                    "/feature-flags/admin/environments",
                    {
                      method: "POST",
                      body: env,
                    },
                  );
                  return response.data;
                } catch (error) {
                  handleError(error as Error);
                  throw error;
                }
              },
              async update(id: string, updates: any): Promise<any> {
                try {
                  const response = await fetch(
                    `/feature-flags/admin/environments/${id}`,
                    {
                      method: "PATCH",
                      body: updates,
                    },
                  );
                  return response.data;
                } catch (error) {
                  handleError(error as Error);
                  throw error;
                }
              },
              async delete(id: string): Promise<any> {
                try {
                  const response = await fetch(
                    `/feature-flags/admin/environments/${id}`,
                    {
                      method: "DELETE",
                    },
                  );
                  return response.data;
                } catch (error) {
                  handleError(error as Error);
                  throw error;
                }
              },
            },

            // Data exports
            exports: {
              async create(options: any): Promise<any> {
                try {
                  const response = await fetch("/feature-flags/admin/export", {
                    method: "POST",
                    body: options,
                  });
                  return response.data;
                } catch (error) {
                  handleError(error as Error);
                  throw error;
                }
              },
            },
          },

          dispose(): void {
            // Cleanup prevents SPA memory leaks
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

      // Smart polling (Edge Runtime compatible)
      if (
        options.polling?.enabled &&
        options.polling.interval &&
        typeof globalThis !== "undefined" &&
        typeof globalThis.setTimeout === "function"
      ) {
        if (smartPoller) {
          smartPoller.stop(); // Prevent duplicates
        }

        smartPoller = new SmartPoller(
          options.polling.interval,
          async () => {
            await actions.featureFlags.refresh();
          },
          (error: any) => {
            handleError(
              new Error(
                `Polling refresh failed: ${error?.message || String(error)}`,
              ),
            );
          },
        );

        smartPoller.start();
      }

      return actions;
    },
  } satisfies BetterAuthClientPlugin;
}

export default featureFlagsClient;
