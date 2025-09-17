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
  AnalyticsOptions,
  AuditQueryOptions,
  DateRange,
  EvaluationStats,
  ListOptions,
  StorageAdapter,
  StorageConfig,
  UsageMetrics,
} from "./types";

/**
 * In-memory storage for development/testing. Fast O(1) lookups, no persistence.
 * Uses Map indexes for multi-tenant key isolation and efficient queries.
 */
export class MemoryStorage implements StorageAdapter {
  private flags: Map<string, FeatureFlag> = new Map();
  private rules: Map<string, FlagRule> = new Map();
  private overrides: Map<string, FlagOverride> = new Map();
  private evaluations: Map<string, FlagEvaluation> = new Map();
  private auditLogs: Map<string, FlagAudit> = new Map();
  private flagKeyIndex: Map<string, string> = new Map(); // org:key -> flagId
  private flagRulesIndex: Map<string, Set<string>> = new Map(); // flagId -> ruleIds
  private overrideIndex: Map<string, string> = new Map(); // flagId:userId -> overrideId

  constructor(private config: StorageConfig) {}

  /** O(1) flag key resolution with org scoping */
  private getFlagIdFromKey(flagKey: string): string | null {
    return this.flagKeyIndex.get(flagKey) || null;
  }

  async initialize(): Promise<void> {
    // Memory storage requires no setup
  }

  async close(): Promise<void> {
    // Clear all Maps and indexes
    this.flags.clear();
    this.rules.clear();
    this.overrides.clear();
    this.evaluations.clear();
    this.auditLogs.clear();
    this.flagKeyIndex.clear();
    this.flagRulesIndex.clear();
    this.overrideIndex.clear();
  }

  // Flag CRUD with org-scoped indexing
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

    this.flags.set(id, newFlag);
    // Org-scoped key prevents cross-org collisions
    const indexKey = this.getFlagIndexKey(flag.key, flag.organizationId);
    this.flagKeyIndex.set(indexKey, id);

    return newFlag;
  }

  async getFlag(
    key: string,
    organizationId?: string,
  ): Promise<FeatureFlag | null> {
    const indexKey = this.getFlagIndexKey(key, organizationId);
    const id = this.flagKeyIndex.get(indexKey);
    return id ? this.flags.get(id) || null : null;
  }

  async getFlagById(id: string): Promise<FeatureFlag | null> {
    return this.flags.get(id) || null;
  }

  async listFlags(
    organizationId?: string,
    options?: ListOptions,
  ): Promise<FeatureFlag[]> {
    let flags = Array.from(this.flags.values());

    if (organizationId) {
      flags = flags.filter((f) => f.organizationId === organizationId);
    }

    if (options?.filter) {
      flags = flags.filter((flag) => {
        return Object.entries(options.filter!).every(([key, value]) => {
          return (flag as any)[key] === value;
        });
      });
    }

    // Sort by specified field
    if (options?.orderBy) {
      flags.sort((a, b) => {
        const aVal = (a as any)[options.orderBy!];
        const bVal = (b as any)[options.orderBy!];
        const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return options.orderDirection === "desc" ? -comparison : comparison;
      });
    }

    // Apply pagination
    const offset = options?.offset || 0;
    const limit = options?.limit || flags.length;
    return flags.slice(offset, offset + limit);
  }

  async updateFlag(
    id: string,
    updates: Partial<FeatureFlag>,
  ): Promise<FeatureFlag> {
    const flag = this.flags.get(id);
    if (!flag) {
      throw new Error(`Flag not found: ${id}`);
    }

    const updatedFlag: FeatureFlag = {
      ...flag,
      ...updates,
      id: flag.id, // Ensure ID doesn't change
      createdAt: flag.createdAt, // Ensure createdAt doesn't change
      updatedAt: new Date(),
    };

    this.flags.set(id, updatedFlag);

    // Reindex if key changes
    if (updates.key && updates.key !== flag.key) {
      const oldIndexKey = this.getFlagIndexKey(flag.key, flag.organizationId);
      const newIndexKey = this.getFlagIndexKey(
        updates.key,
        flag.organizationId,
      );
      this.flagKeyIndex.delete(oldIndexKey);
      this.flagKeyIndex.set(newIndexKey, id);
    }

    return updatedFlag;
  }

  async deleteFlag(id: string): Promise<void> {
    const flag = this.flags.get(id);
    if (flag) {
      const indexKey = this.getFlagIndexKey(flag.key, flag.organizationId);
      this.flagKeyIndex.delete(indexKey);
      this.flags.delete(id);

      // Cascade delete dependent rules
      const ruleIds = this.flagRulesIndex.get(id);
      if (ruleIds) {
        for (const ruleId of ruleIds) {
          this.rules.delete(ruleId);
        }
        this.flagRulesIndex.delete(id);
      }

      // Cascade delete dependent overrides
      for (const [key, overrideId] of this.overrideIndex.entries()) {
        if (key.startsWith(`${id}:`)) {
          this.overrides.delete(overrideId);
          this.overrideIndex.delete(key);
        }
      }
    }
  }

  // Rule CRUD with flag indexing
  async createRule(
    rule: Omit<FlagRule, "id" | "createdAt">,
  ): Promise<FlagRule> {
    const id = generateId();
    const newRule: FlagRule = {
      ...rule,
      id,
      createdAt: new Date(),
    };

    this.rules.set(id, newRule);

    // Index by flagId for fast lookups
    if (!this.flagRulesIndex.has(rule.flagId)) {
      this.flagRulesIndex.set(rule.flagId, new Set());
    }
    this.flagRulesIndex.get(rule.flagId)!.add(id);

    return newRule;
  }

  async getRulesForFlag(flagId: string): Promise<FlagRule[]> {
    const ruleIds = this.flagRulesIndex.get(flagId);
    if (!ruleIds) return [];

    const rules: FlagRule[] = [];
    for (const ruleId of ruleIds) {
      const rule = this.rules.get(ruleId);
      if (rule) rules.push(rule);
    }

    // Sort by evaluation priority
    return rules.sort((a, b) => a.priority - b.priority);
  }

  async updateRule(id: string, updates: Partial<FlagRule>): Promise<FlagRule> {
    const rule = this.rules.get(id);
    if (!rule) {
      throw new Error(`Rule not found: ${id}`);
    }

    const updatedRule: FlagRule = {
      ...rule,
      ...updates,
      id: rule.id,
      createdAt: rule.createdAt,
    };

    this.rules.set(id, updatedRule);
    return updatedRule;
  }

  async deleteRule(id: string): Promise<void> {
    const rule = this.rules.get(id);
    if (rule) {
      this.rules.delete(id);
      const ruleIds = this.flagRulesIndex.get(rule.flagId);
      if (ruleIds) {
        ruleIds.delete(id);
      }
    }
  }

  async getRule(id: string): Promise<FlagRule | null> {
    return this.rules.get(id) || null;
  }

  async reorderRules(flagId: string, ruleIds: string[]): Promise<void> {
    // Update priority based on array position
    for (let i = 0; i < ruleIds.length; i++) {
      const rule = this.rules.get(ruleIds[i]!);
      if (rule && rule.flagId === flagId) {
        rule.priority = i;
      }
    }
  }

  // User overrides with composite indexing
  async createOverride(
    override: Omit<FlagOverride, "id" | "createdAt">,
  ): Promise<FlagOverride> {
    const id = generateId();
    const newOverride: FlagOverride = {
      ...override,
      id,
      createdAt: new Date(),
    };

    this.overrides.set(id, newOverride);
    const indexKey = `${override.flagId}:${override.userId}`;
    this.overrideIndex.set(indexKey, id);

    return newOverride;
  }

  async getOverride(
    flagId: string,
    userId: string,
  ): Promise<FlagOverride | null> {
    const indexKey = `${flagId}:${userId}`;
    const id = this.overrideIndex.get(indexKey);
    return id ? this.overrides.get(id) || null : null;
  }

  async updateOverride(
    id: string,
    updates: Partial<FlagOverride>,
  ): Promise<FlagOverride> {
    const override = this.overrides.get(id);
    if (!override) {
      throw new Error(`Override not found: ${id}`);
    }

    const updatedOverride: FlagOverride = {
      ...override,
      ...updates,
      id: override.id,
      createdAt: override.createdAt,
    };

    this.overrides.set(id, updatedOverride);
    return updatedOverride;
  }

  async listOverrides(
    flagId?: string,
    userId?: string,
  ): Promise<FlagOverride[]> {
    let overrides = Array.from(this.overrides.values());

    if (flagId) {
      overrides = overrides.filter((o) => o.flagId === flagId);
    }
    if (userId) {
      overrides = overrides.filter((o) => o.userId === userId);
    }

    return overrides;
  }

  async deleteOverride(id: string): Promise<void> {
    const override = this.overrides.get(id);
    if (override) {
      const indexKey = `${override.flagId}:${override.userId}`;
      this.overrideIndex.delete(indexKey);
      this.overrides.delete(id);
    }
  }

  async getOverrideById(id: string): Promise<FlagOverride | null> {
    return this.overrides.get(id) || null;
  }

  // Analytics: in-memory evaluation tracking
  async trackEvaluation(tracking: EvaluationTracking): Promise<void> {
    const flagId = this.getFlagIdFromKey(tracking.flagKey);

    if (!flagId) {
      const strategy = this.config.unknownFlagStrategy || "log";

      switch (strategy) {
        case "throw":
          throw new Error(
            `[feature-flags] Flag not found for key '${tracking.flagKey}'`,
          );
        case "track-unknown":
          await this.trackUnknownFlagEvaluation(tracking);
          return;
        case "log":
        default:
          console.warn(
            `[feature-flags] Cannot track evaluation: flag not found for key '${tracking.flagKey}'`,
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
      reason: tracking.reason ?? "default",
      context: tracking.context || {},
      evaluatedAt: tracking.timestamp,
    };

    this.evaluations.set(id, evaluation);
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

    this.evaluations.set(id, evaluation);
  }

  /** Get or create system flag for unknown evaluations */
  private async getOrCreateUnknownFlagId(): Promise<string> {
    const unknownFlagKey = "__unknown__";

    let unknownFlagId = this.getFlagIdFromKey(unknownFlagKey);

    if (!unknownFlagId) {
      const unknownFlag = await this.createFlag({
        key: unknownFlagKey,
        name: "Unknown Flag Evaluations",
        description:
          "System flag for tracking evaluations of non-existent flags",
        type: "boolean",
        enabled: false,
        defaultValue: false,
        rolloutPercentage: 0,
      });
      unknownFlagId = unknownFlag.id;
    }

    return unknownFlagId;
  }

  async getEvaluations(
    flagId: string,
    options?: ListOptions,
  ): Promise<FlagEvaluation[]> {
    let evaluations = Array.from(this.evaluations.values()).filter(
      (e) => e.flagId === flagId,
    );

    // Sort by timestamp, newest first
    evaluations.sort(
      (a, b) => b.evaluatedAt.getTime() - a.evaluatedAt.getTime(),
    );

    // Apply pagination
    const offset = options?.offset || 0;
    const limit = options?.limit || evaluations.length;
    return evaluations.slice(offset, offset + limit);
  }

  async getEvaluationStats(
    flagId: string,
    period?: DateRange,
    options?: AnalyticsOptions,
  ): Promise<EvaluationStats> {
    let evaluations = Array.from(this.evaluations.values()).filter(
      (e) => e.flagId === flagId,
    );

    if (period) {
      evaluations = evaluations.filter(
        (e) => e.evaluatedAt >= period.start && e.evaluatedAt <= period.end,
      );
    }

    const metrics = options?.metrics;
    const result: EvaluationStats = {};

    // Selective metric computation for performance optimization
    if (!metrics || metrics.includes("total")) {
      result.totalEvaluations = evaluations.length;
    }

    if (!metrics || metrics.includes("uniqueUsers")) {
      const uniqueUsers = new Set(evaluations.map((e) => e.userId));
      result.uniqueUsers = uniqueUsers.size;
    }

    if (!metrics || metrics.includes("variants")) {
      const variants: Record<string, number> = {};
      for (const evaluation of evaluations) {
        if (evaluation.variant) {
          variants[evaluation.variant] =
            (variants[evaluation.variant] || 0) + 1;
        }
      }
      result.variants = variants;
    }

    if (!metrics || metrics.includes("reasons")) {
      const reasons: Record<string, number> = {};
      for (const evaluation of evaluations) {
        const reasonKey = evaluation.reason ?? "default";
        reasons[reasonKey] = (reasons[reasonKey] || 0) + 1;
      }
      result.reasons = reasons;
    }

    // Note: avgLatency and errorRate not implemented in memory storage
    // These would require additional tracking in production storage

    return result;
  }

  // Audit: in-memory trail for development
  async logAudit(entry: AuditLogEntry): Promise<void> {
    let flagId: string = "";

    if (entry.flagKey) {
      const resolvedFlagId = this.getFlagIdFromKey(entry.flagKey);

      if (!resolvedFlagId) {
        const strategy = this.config.unknownFlagStrategy || "log";

        switch (strategy) {
          case "throw":
            throw new Error(
              `[feature-flags] Flag not found for audit key '${entry.flagKey}'`,
            );
          case "track-unknown":
            flagId = await this.getOrCreateUnknownFlagId();
            break;
          case "log":
          default:
            console.warn(
              `[feature-flags] Cannot audit: flag not found for key '${entry.flagKey}'`,
            );
            return;
        }
      } else {
        flagId = resolvedFlagId;
      }
    }

    const id = generateId();
    const audit: FlagAudit = {
      id,
      userId: entry.userId,
      action: entry.action as any,
      flagId,
      metadata: entry.metadata || {},
      createdAt: entry.timestamp || new Date(),
    };

    this.auditLogs.set(id, audit);
  }

  async getAuditLogs(options?: AuditQueryOptions): Promise<FlagAudit[]> {
    let logs = Array.from(this.auditLogs.values());

    if (options?.userId) {
      logs = logs.filter((l) => l.userId === options.userId);
    }
    if (options?.flagId) {
      logs = logs.filter((l) => l.flagId === options.flagId);
    }
    if (options?.action) {
      logs = logs.filter((l) => l.action === options.action);
    }
    if (options?.startDate) {
      logs = logs.filter((l) => l.createdAt >= options.startDate!);
    }
    if (options?.endDate) {
      logs = logs.filter((l) => l.createdAt <= options.endDate!);
    }

    // Sort chronologically, newest first
    logs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // Apply pagination
    const offset = options?.offset || 0;
    const limit = options?.limit || logs.length;
    return logs.slice(offset, offset + limit);
  }

  async cleanupAuditLogs(olderThan: Date): Promise<number> {
    let deletedCount = 0;
    for (const [id, log] of this.auditLogs.entries()) {
      if (log.createdAt < olderThan) {
        this.auditLogs.delete(id);
        deletedCount++;
      }
    }
    return deletedCount;
  }

  async getAuditEntry(id: string): Promise<FlagAudit | null> {
    return this.auditLogs.get(id) || null;
  }

  async getUsageMetrics(
    organizationId?: string,
    period?: DateRange,
    options?: AnalyticsOptions,
  ): Promise<UsageMetrics> {
    // Calculate metrics from in-memory data
    const allFlags = Array.from(this.flags.values());
    const orgFlags = organizationId
      ? allFlags.filter((f) => f.organizationId === organizationId)
      : allFlags;

    const allEvaluations = Array.from(this.evaluations.values());
    const periodEvaluations = period
      ? allEvaluations.filter(
          (e) => e.evaluatedAt >= period.start && e.evaluatedAt <= period.end,
        )
      : allEvaluations;

    const metrics = options?.metrics;
    const result: UsageMetrics = {};

    // Selective metric computation for performance optimization
    if (!metrics || metrics.includes("total")) {
      result.totalFlags = orgFlags.length;
      result.activeFlags = orgFlags.filter((f) => f.enabled).length;
      result.totalEvaluations = periodEvaluations.length;

      // Top flags by evaluation count (expensive operation)
      const flagEvaluationCounts = new Map<string, number>();
      const flagUserCounts = new Map<string, Set<string>>();

      for (const evaluation of periodEvaluations) {
        flagEvaluationCounts.set(
          evaluation.flagId,
          (flagEvaluationCounts.get(evaluation.flagId) || 0) + 1,
        );
        if (!flagUserCounts.has(evaluation.flagId)) {
          flagUserCounts.set(evaluation.flagId, new Set());
        }
        if (evaluation.userId) {
          flagUserCounts.get(evaluation.flagId)!.add(evaluation.userId);
        }
      }

      result.topFlags = Array.from(flagEvaluationCounts.entries())
        .map(([key, evaluations]) => ({
          key,
          evaluations,
          uniqueUsers: flagUserCounts.get(key)?.size || 0,
        }))
        .sort((a, b) => b.evaluations - a.evaluations)
        .slice(0, 10);

      // Daily evaluation counts
      const evaluationsByDate: Record<string, number> = {};
      for (const evaluation of periodEvaluations) {
        const dateKey = evaluation.evaluatedAt.toISOString().split("T")[0]!;
        evaluationsByDate[dateKey] = (evaluationsByDate[dateKey] || 0) + 1;
      }
      result.evaluationsByDate = evaluationsByDate;
    }

    if (!metrics || metrics.includes("uniqueUsers")) {
      const uniqueUsers = new Set(
        periodEvaluations.map((e) => e.userId).filter(Boolean),
      ).size;
      result.uniqueUsers = uniqueUsers;
    }

    if (!metrics || metrics.includes("errorRate")) {
      result.errorRate = 0; // No error tracking in memory storage
    }

    if (!metrics || metrics.includes("avgLatency")) {
      result.avgLatency = 0; // Memory storage is instant
    }

    return result;
  }

  // Multi-tenancy: org-scoped key generation
  private getFlagIndexKey(key: string, organizationId?: string): string {
    return organizationId ? `${organizationId}:${key}` : key;
  }
}
