// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import type {
  FeatureFlag,
  FlagAudit,
  FlagEvaluation,
  FlagOverride,
  FlagRule,
} from "../schema";
import type { AuditLogEntry, EvaluationTracking } from "../types";
import { generateId } from "../utils";
import type {
  AuditQueryOptions,
  DateRange,
  EvaluationStats,
  ListOptions,
  RedisConfig,
  StorageAdapter,
  StorageConfig,
  UsageMetrics,
} from "./types";

/**
 * Redis storage adapter for high-throughput production environments.
 * Uses Redis data structures, TTL expiration, and efficient key patterns.
 * @see https://redis.io/docs/data-types/ for Redis data structure reference
 */
export class RedisStorage implements StorageAdapter {
  private redis: any; // Redis client instance
  private keyPrefix: string;
  private defaultTTL: number = 24 * 60 * 60; // 24h TTL

  constructor(private config: StorageConfig) {
    if (!config.redis) {
      throw new Error("Redis configuration is required for Redis storage");
    }
    this.keyPrefix = config.redis.keyPrefix || "ff:";
    this.redis = this.createRedisClient(config.redis);
  }

  private createRedisClient(redisConfig: RedisConfig): any {
    // TODO: Replace with actual Redis client (ioredis/node-redis)
    if (redisConfig.url) {
      // Connect via URL (redis://host:port)
      return {
        url: redisConfig.url,
        // Mock methods - replace with real client
        connect: async () => {},
        disconnect: async () => {},
        get: async (key: string) => null,
        set: async (key: string, value: string, options?: any) => {},
        del: async (key: string) => {},
        hget: async (hash: string, field: string) => null,
        hset: async (hash: string, field: string, value: string) => {},
        hdel: async (hash: string, field: string) => {},
        hgetall: async (hash: string) => ({}),
        sadd: async (set: string, member: string) => {},
        srem: async (set: string, member: string) => {},
        smembers: async (set: string) => [],
        zadd: async (sortedSet: string, score: number, member: string) => {},
        zrange: async (sortedSet: string, start: number, stop: number) => [],
        zrem: async (sortedSet: string, member: string) => {},
        keys: async (pattern: string) => [],
        exists: async (key: string) => 0,
        expire: async (key: string, seconds: number) => {},
      };
    } else {
      // Connect via host/port
      return {
        host: redisConfig.host || "localhost",
        port: redisConfig.port || 6379,
        password: redisConfig.password,
        db: redisConfig.db || 0,
        // Mock methods
        connect: async () => {},
        disconnect: async () => {},
        get: async (key: string) => null,
        set: async (key: string, value: string, options?: any) => {},
        del: async (key: string) => {},
        hget: async (hash: string, field: string) => null,
        hset: async (hash: string, field: string, value: string) => {},
        hdel: async (hash: string, field: string) => {},
        hgetall: async (hash: string) => ({}),
        sadd: async (set: string, member: string) => {},
        srem: async (set: string, member: string) => {},
        smembers: async (set: string) => [],
        zadd: async (sortedSet: string, score: number, member: string) => {},
        zrange: async (sortedSet: string, start: number, stop: number) => [],
        zrem: async (sortedSet: string, member: string) => {},
        keys: async (pattern: string) => [],
        exists: async (key: string) => 0,
        expire: async (key: string, seconds: number) => {},
      };
    }
  }

  private getKey(type: string, id: string): string {
    return `${this.keyPrefix}${type}:${id}`;
  }

  private getFlagIndexKey(flagKey: string, organizationId?: string): string {
    return organizationId ? `${organizationId}:${flagKey}` : flagKey;
  }

  async initialize(): Promise<void> {
    if (this.redis.connect) {
      await this.redis.connect();
    }
  }

  async close(): Promise<void> {
    if (this.redis.disconnect) {
      await this.redis.disconnect();
    }
  }

  // Flag CRUD with Redis data structures
  async createFlag(
    flag: Omit<FeatureFlag, "id" | "createdAt" | "updatedAt">,
  ): Promise<FeatureFlag> {
    const id = generateId();
    const now = new Date();
    const newFlag: FeatureFlag = {
      ...flag,
      id,
      createdAt: now,
      updatedAt: now,
    };

    // Store JSON data with TTL
    const flagKey = this.getKey("flag", id);
    await this.redis.set(flagKey, JSON.stringify(newFlag));
    await this.redis.expire(flagKey, this.defaultTTL);

    // Index for key -> id lookups
    const indexKey = this.getFlagIndexKey(flag.key, flag.organizationId);
    const indexStoreKey = this.getKey("flag_index", indexKey);
    await this.redis.set(indexStoreKey, id);
    await this.redis.expire(indexStoreKey, this.defaultTTL);

    // Organization flag set
    if (flag.organizationId) {
      const orgFlagsKey = this.getKey("org_flags", flag.organizationId);
      await this.redis.sadd(orgFlagsKey, id);
      await this.redis.expire(orgFlagsKey, this.defaultTTL);
    }

    return newFlag;
  }

  async getFlag(
    key: string,
    organizationId?: string,
  ): Promise<FeatureFlag | null> {
    const indexKey = this.getFlagIndexKey(key, organizationId);
    const indexStoreKey = this.getKey("flag_index", indexKey);
    const id = await this.redis.get(indexStoreKey);

    if (!id) return null;

    const flagKey = this.getKey("flag", id);
    const flagData = await this.redis.get(flagKey);

    return flagData ? JSON.parse(flagData) : null;
  }

  async getFlagById(id: string): Promise<FeatureFlag | null> {
    const flagKey = this.getKey("flag", id);
    const flagData = await this.redis.get(flagKey);

    return flagData ? JSON.parse(flagData) : null;
  }

  async listFlags(
    organizationId?: string,
    options?: ListOptions,
  ): Promise<FeatureFlag[]> {
    let flagIds: string[] = [];

    if (organizationId) {
      // Get org-specific flags from set
      const orgFlagsKey = this.getKey("org_flags", organizationId);
      flagIds = await this.redis.smembers(orgFlagsKey);
    } else {
      // Get all flags (less efficient KEYS scan)
      const flagKeys = await this.redis.keys(`${this.keyPrefix}flag:*`);
      flagIds = flagKeys.map((key: string) =>
        key.replace(`${this.keyPrefix}flag:`, ""),
      );
    }

    // Fetch flag data
    const flags: FeatureFlag[] = [];
    for (const id of flagIds) {
      const flag = await this.getFlagById(id);
      if (flag) flags.push(flag);
    }

    // Sort and paginate
    let result = flags;

    if (options?.orderBy) {
      const direction = options.orderDirection === "desc" ? -1 : 1;
      result.sort((a, b) => {
        const aVal = (a as any)[options.orderBy!];
        const bVal = (b as any)[options.orderBy!];
        return aVal < bVal ? -direction : aVal > bVal ? direction : 0;
      });
    }

    if (options?.offset || options?.limit) {
      const start = options.offset || 0;
      const end = options.limit ? start + options.limit : undefined;
      result = result.slice(start, end);
    }

    return result;
  }

  async updateFlag(
    id: string,
    updates: Partial<FeatureFlag>,
  ): Promise<FeatureFlag> {
    const existing = await this.getFlagById(id);
    if (!existing) {
      throw new Error(`Flag with id ${id} not found`);
    }

    const updated: FeatureFlag = {
      ...existing,
      ...updates,
      id, // Ensure ID doesn't change
      updatedAt: new Date(),
    };

    const flagKey = this.getKey("flag", id);
    await this.redis.set(flagKey, JSON.stringify(updated));
    await this.redis.expire(flagKey, this.defaultTTL);

    return updated;
  }

  async deleteFlag(id: string): Promise<void> {
    const flag = await this.getFlagById(id);
    if (!flag) return;

    // Remove from main storage
    const flagKey = this.getKey("flag", id);
    await this.redis.del(flagKey);

    // Remove from index
    const indexKey = this.getFlagIndexKey(flag.key, flag.organizationId);
    const indexStoreKey = this.getKey("flag_index", indexKey);
    await this.redis.del(indexStoreKey);

    // Remove from organization set
    if (flag.organizationId) {
      const orgFlagsKey = this.getKey("org_flags", flag.organizationId);
      await this.redis.srem(orgFlagsKey, id);
    }

    // Cleanup related rules
    const rulesKey = this.getKey("flag_rules", id);
    const ruleIds = await this.redis.smembers(rulesKey);
    for (const ruleId of ruleIds) {
      await this.redis.del(this.getKey("rule", ruleId));
    }
    await this.redis.del(rulesKey);
  }

  // Rule CRUD with set indexing
  async createRule(
    rule: Omit<FlagRule, "id" | "createdAt">,
  ): Promise<FlagRule> {
    const id = generateId();
    const now = new Date();
    const newRule: FlagRule = {
      ...rule,
      id,
      createdAt: now,
    };

    // Store rule data
    const ruleKey = this.getKey("rule", id);
    await this.redis.set(ruleKey, JSON.stringify(newRule));
    await this.redis.expire(ruleKey, this.defaultTTL);

    // Add to flag's rules set
    const flagRulesKey = this.getKey("flag_rules", rule.flagId);
    await this.redis.sadd(flagRulesKey, id);
    await this.redis.expire(flagRulesKey, this.defaultTTL);

    return newRule;
  }

  async getRule(id: string): Promise<FlagRule | null> {
    const ruleKey = this.getKey("rule", id);
    const ruleData = await this.redis.get(ruleKey);

    return ruleData ? JSON.parse(ruleData) : null;
  }

  async getRulesForFlag(flagId: string): Promise<FlagRule[]> {
    const flagRulesKey = this.getKey("flag_rules", flagId);
    const ruleIds = await this.redis.smembers(flagRulesKey);

    const rules: FlagRule[] = [];
    for (const id of ruleIds) {
      const rule = await this.getRule(id);
      if (rule) rules.push(rule);
    }

    // Sort by priority
    return rules.sort((a, b) => a.priority - b.priority);
  }

  async updateRule(id: string, updates: Partial<FlagRule>): Promise<FlagRule> {
    const existing = await this.getRule(id);
    if (!existing) {
      throw new Error(`Rule with id ${id} not found`);
    }

    const updated: FlagRule = {
      ...existing,
      ...updates,
      id, // Ensure ID doesn't change
    };

    const ruleKey = this.getKey("rule", id);
    await this.redis.set(ruleKey, JSON.stringify(updated));
    await this.redis.expire(ruleKey, this.defaultTTL);

    return updated;
  }

  async deleteRule(id: string): Promise<void> {
    const rule = await this.getRule(id);
    if (!rule) return;

    // Remove from main storage
    const ruleKey = this.getKey("rule", id);
    await this.redis.del(ruleKey);

    // Remove from flag's rules set
    const flagRulesKey = this.getKey("flag_rules", rule.flagId);
    await this.redis.srem(flagRulesKey, id);
  }

  async reorderRules(flagId: string, ruleIds: string[]): Promise<void> {
    // Update priority based on array position
    for (let i = 0; i < ruleIds.length; i++) {
      const rule = await this.getRule(ruleIds[i]!);
      if (rule && rule.flagId === flagId) {
        await this.updateRule(rule.id, { priority: i });
      }
    }
  }

  // User override CRUD
  async createOverride(
    override: Omit<FlagOverride, "id" | "createdAt">,
  ): Promise<FlagOverride> {
    const id = generateId();
    const now = new Date();
    const newOverride: FlagOverride = {
      ...override,
      id,
      createdAt: now,
    };

    // Store override data
    const overrideKey = this.getKey("override", id);
    await this.redis.set(overrideKey, JSON.stringify(newOverride));
    await this.redis.expire(overrideKey, this.defaultTTL);

    // Index for flagId:userId -> overrideId lookups
    const lookupKey = `${override.flagId}:${override.userId}`;
    const lookupStoreKey = this.getKey("override_lookup", lookupKey);
    await this.redis.set(lookupStoreKey, id);
    await this.redis.expire(lookupStoreKey, this.defaultTTL);

    return newOverride;
  }

  async getOverride(
    flagId: string,
    userId: string,
  ): Promise<FlagOverride | null> {
    const lookupKey = `${flagId}:${userId}`;
    const lookupStoreKey = this.getKey("override_lookup", lookupKey);
    const id = await this.redis.get(lookupStoreKey);

    if (!id) return null;

    const overrideKey = this.getKey("override", id);
    const overrideData = await this.redis.get(overrideKey);

    return overrideData ? JSON.parse(overrideData) : null;
  }

  async getOverrideById(id: string): Promise<FlagOverride | null> {
    const overrideKey = this.getKey("override", id);
    const overrideData = await this.redis.get(overrideKey);

    return overrideData ? JSON.parse(overrideData) : null;
  }

  async updateOverride(
    id: string,
    updates: Partial<FlagOverride>,
  ): Promise<FlagOverride> {
    const existing = await this.getOverrideById(id);
    if (!existing) {
      throw new Error(`Override with id ${id} not found`);
    }

    const updated: FlagOverride = {
      ...existing,
      ...updates,
      id, // Ensure ID doesn't change
    };

    const overrideKey = this.getKey("override", id);
    await this.redis.set(overrideKey, JSON.stringify(updated));
    await this.redis.expire(overrideKey, this.defaultTTL);

    return updated;
  }

  async listOverrides(
    flagId?: string,
    userId?: string,
  ): Promise<FlagOverride[]> {
    // TODO: Better indexing strategy for production
    const overrideKeys = await this.redis.keys(`${this.keyPrefix}override:*`);
    const overrides: FlagOverride[] = [];

    for (const key of overrideKeys) {
      const overrideData = await this.redis.get(key);
      if (overrideData) {
        const override = JSON.parse(overrideData);
        if (
          (!flagId || override.flagId === flagId) &&
          (!userId || override.userId === userId)
        ) {
          overrides.push(override);
        }
      }
    }

    return overrides;
  }

  async deleteOverride(id: string): Promise<void> {
    const override = await this.getOverrideById(id);
    if (!override) return;

    // Remove from main storage
    const overrideKey = this.getKey("override", id);
    await this.redis.del(overrideKey);

    // Remove from lookup index
    const lookupKey = `${override.flagId}:${override.userId}`;
    const lookupStoreKey = this.getKey("override_lookup", lookupKey);
    await this.redis.del(lookupStoreKey);
  }

  // Analytics with TTL management
  async trackEvaluation(tracking: EvaluationTracking): Promise<void> {
    const flagId = await this.getFlagIdFromKey(
      tracking.flagKey,
      tracking.organizationId,
    );

    if (!flagId) {
      const orgScope = tracking.organizationId
        ? ` (org: ${tracking.organizationId})`
        : "";
      const strategy = this.config.unknownFlagStrategy || "log";

      switch (strategy) {
        case "throw":
          throw new Error(
            `[feature-flags] Flag not found for key '${tracking.flagKey}'${orgScope}`,
          );
        case "track-unknown":
          await this.trackUnknownFlagEvaluation(tracking);
          return;
        case "log":
        default:
          console.warn(
            `[feature-flags] Cannot track evaluation: flag not found for key '${tracking.flagKey}'${orgScope}`,
          );
          return;
      }
    }

    const id = generateId();
    const evaluation: FlagEvaluation = {
      id,
      flagId,
      userId: tracking.userId,
      value: tracking.value,
      variant: tracking.variant,
      reason: tracking.reason || "default",
      context: tracking.context || {},
      evaluatedAt: tracking.timestamp,
    };

    const evalKey = this.getKey("evaluation", id);
    await this.redis.set(evalKey, JSON.stringify(evaluation));
    // Shorter TTL for analytics data
    await this.redis.expire(evalKey, 7 * 24 * 60 * 60); // 7d
  }

  /** Track unknown flag evaluations using system flag */
  private async trackUnknownFlagEvaluation(
    tracking: EvaluationTracking,
  ): Promise<void> {
    const unknownFlagId = await this.getOrCreateUnknownFlagId();
    const id = generateId();

    // Store original key in context
    const contextWithOriginalKey = {
      ...tracking.context,
      originalFlagKey: tracking.flagKey,
      originalOrganizationId: tracking.organizationId,
    };

    const evaluation: FlagEvaluation = {
      id,
      flagId: unknownFlagId,
      userId: tracking.userId,
      value: tracking.value,
      variant: tracking.variant,
      reason: "not_found",
      context: contextWithOriginalKey,
      evaluatedAt: tracking.timestamp,
    };

    const evalKey = this.getKey("evaluation", id);
    await this.redis.set(evalKey, JSON.stringify(evaluation));
    await this.redis.expire(evalKey, 7 * 24 * 60 * 60); // 7 days
  }

  /** Get or create system flag for unknown evaluations */
  private async getOrCreateUnknownFlagId(): Promise<string> {
    const unknownFlagKey = "__unknown__";

    let unknownFlag = await this.getFlag(unknownFlagKey);

    if (!unknownFlag) {
      unknownFlag = await this.createFlag({
        key: unknownFlagKey,
        name: "Unknown Flag Evaluations",
        description:
          "System flag for tracking evaluations of non-existent flags",
        type: "boolean",
        enabled: false,
        defaultValue: false,
        rolloutPercentage: 0,
      });
    }

    return unknownFlag.id;
  }

  /** Resolve flag key to ID with org scoping */
  private async getFlagIdFromKey(
    flagKey: string,
    organizationId?: string,
  ): Promise<string | null> {
    try {
      const flag = await this.getFlag(flagKey, organizationId);
      return flag ? flag.id : null;
    } catch (error) {
      console.error(
        `[feature-flags] Error looking up flag ID for key ${flagKey}:`,
        error,
      );
      return null;
    }
  }

  async getEvaluations(
    flagId: string,
    options?: ListOptions,
  ): Promise<FlagEvaluation[]> {
    // TODO: Better indexing for production
    const evalKeys = await this.redis.keys(`${this.keyPrefix}evaluation:*`);
    const evaluations: FlagEvaluation[] = [];

    for (const key of evalKeys) {
      const evalData = await this.redis.get(key);
      if (evalData) {
        const evaluation = JSON.parse(evalData);
        if (evaluation.flagId === flagId) {
          evaluations.push(evaluation);
        }
      }
    }

    return evaluations.slice(0, options?.limit || 100);
  }

  async getEvaluationStats(
    flagId: string,
    period?: DateRange,
    options?: import("./types").AnalyticsOptions,
  ): Promise<EvaluationStats> {
    // Basic stats from evaluations
    const evaluations = await this.getEvaluations(flagId);

    const metrics = options?.metrics;
    const stats: EvaluationStats = {};

    // Selective metric computation for performance optimization
    if (!metrics || metrics.includes("total")) {
      stats.totalEvaluations = evaluations.length;
    }

    if (!metrics || metrics.includes("uniqueUsers")) {
      stats.uniqueUsers = new Set(evaluations.map((e) => e.userId)).size;
    }

    if (!metrics || metrics.includes("variants")) {
      const variants: Record<string, number> = {};
      evaluations.forEach((evaluation) => {
        const variant =
          typeof evaluation.value === "string" ? evaluation.value : "default";
        variants[variant] = (variants[variant] || 0) + 1;
      });
      stats.variants = variants;
    }

    if (!metrics || metrics.includes("reasons")) {
      const reasons: Record<string, number> = {};
      evaluations.forEach((evaluation) => {
        const reason = evaluation.reason || "default";
        reasons[reason] = (reasons[reason] || 0) + 1;
      });
      stats.reasons = reasons;
    }

    // Note: avgLatency and errorRate not implemented in Redis storage
    // These would require additional time-series tracking

    return stats;
  }

  async getUsageMetrics(
    organizationId?: string,
    _period?: DateRange,
    options?: import("./types").AnalyticsOptions,
  ): Promise<UsageMetrics> {
    // Basic metrics
    const flags = await this.listFlags(organizationId);

    const metrics = options?.metrics;
    const result: import("./types").UsageMetrics = {};

    // Selective metric computation for performance optimization
    if (!metrics || metrics.includes("total")) {
      result.totalFlags = flags.length;
      result.activeFlags = flags.filter((f) => f.enabled).length;
      result.totalEvaluations = 0; // TODO: Implement evaluation tracking
      result.topFlags = [];
      result.evaluationsByDate = {};
    }

    if (!metrics || metrics.includes("uniqueUsers")) {
      result.uniqueUsers = 0; // TODO: Implement user tracking
    }

    if (!metrics || metrics.includes("errorRate")) {
      result.errorRate = 0; // TODO: Implement error tracking
    }

    // Note: avgLatency not implemented in Redis storage
    // This would require additional time-series tracking

    return result;
  }

  // Audit operations
  async logAudit(entry: AuditLogEntry): Promise<void> {
    const id = generateId();
    let flagId: string | null = null;

    // Resolve flagId from direct ID or key lookup
    if (entry.flagId) {
      flagId = entry.flagId;
    } else if (entry.flagKey) {
      flagId = await this.getFlagIdFromKey(entry.flagKey, entry.organizationId);
      if (!flagId) {
        const orgScope = entry.organizationId
          ? ` (org: ${entry.organizationId})`
          : "";
        console.warn(
          `[feature-flags] Orphaned audit log - flagKey '${entry.flagKey}'${orgScope} not found`,
        );
      }
    }

    // Skip if flagId cannot be resolved
    if (!flagId) {
      console.warn(
        `[feature-flags] Skipping audit log - cannot resolve flagId for action '${entry.action}'`,
      );
      return;
    }

    const audit: FlagAudit = {
      id,
      flagId,
      userId: entry.userId,
      action: entry.action as any, // Type assertion for Redis storage simplicity
      metadata: entry.metadata || {},
      createdAt: entry.timestamp || new Date(),
    };

    const auditKey = this.getKey("audit", id);
    await this.redis.set(auditKey, JSON.stringify(audit));
    // Longer TTL for compliance
    await this.redis.expire(auditKey, 90 * 24 * 60 * 60); // 90d
  }

  async getAuditLogs(options?: AuditQueryOptions): Promise<FlagAudit[]> {
    // Basic audit log retrieval
    const auditKeys = await this.redis.keys(`${this.keyPrefix}audit:*`);
    const audits: FlagAudit[] = [];

    for (const key of auditKeys) {
      const auditData = await this.redis.get(key);
      if (auditData) {
        audits.push(JSON.parse(auditData));
      }
    }

    return audits.slice(0, options?.limit || 100);
  }

  async getAuditEntry(id: string): Promise<FlagAudit | null> {
    const auditKey = this.getKey("audit", id);
    const auditData = await this.redis.get(auditKey);

    return auditData ? JSON.parse(auditData) : null;
  }

  async cleanupAuditLogs(_olderThan: Date): Promise<number> {
    // TTL handles automatic cleanup
    return 0;
  }
}
