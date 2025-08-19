// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import type {
  StorageAdapter,
  StorageConfig,
  ListOptions,
  DateRange,
  EvaluationStats,
  AuditQueryOptions,
} from "./types";
import type {
  FeatureFlag,
  FlagRule,
  FlagOverride,
  FlagEvaluation,
  FlagAudit,
} from "../schema";
import type { AuditLogEntry, EvaluationTracking } from "../types";
import { generateId } from "../utils";

/**
 * In-memory storage adapter for development and testing
 */
export class MemoryStorage implements StorageAdapter {
  private flags: Map<string, FeatureFlag> = new Map();
  private rules: Map<string, FlagRule> = new Map();
  private overrides: Map<string, FlagOverride> = new Map();
  private evaluations: Map<string, FlagEvaluation> = new Map();
  private auditLogs: Map<string, FlagAudit> = new Map();
  private flagKeyIndex: Map<string, string> = new Map(); // key -> id mapping
  private flagRulesIndex: Map<string, Set<string>> = new Map(); // flagId -> ruleIds
  private overrideIndex: Map<string, string> = new Map(); // flagId:userId -> overrideId

  constructor(private config: StorageConfig) {}

  async initialize(): Promise<void> {
    // No initialization needed for memory storage
  }

  async close(): Promise<void> {
    // Clear all data
    this.flags.clear();
    this.rules.clear();
    this.overrides.clear();
    this.evaluations.clear();
    this.auditLogs.clear();
    this.flagKeyIndex.clear();
    this.flagRulesIndex.clear();
    this.overrideIndex.clear();
  }

  // Flag operations
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
    // @important Key index uses org:key format for multi-tenancy
    // This ensures flags with same key in different orgs don't collide
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

    // Apply sorting
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

    // Update index if key changed
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

      // Delete associated rules
      const ruleIds = this.flagRulesIndex.get(id);
      if (ruleIds) {
        for (const ruleId of ruleIds) {
          this.rules.delete(ruleId);
        }
        this.flagRulesIndex.delete(id);
      }

      // Delete associated overrides
      for (const [key, overrideId] of this.overrideIndex.entries()) {
        if (key.startsWith(`${id}:`)) {
          this.overrides.delete(overrideId);
          this.overrideIndex.delete(key);
        }
      }
    }
  }

  // Rule operations
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

    // Update index
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

    // Sort by priority
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

  async reorderRules(flagId: string, ruleIds: string[]): Promise<void> {
    // Update priority based on order in the array
    for (let i = 0; i < ruleIds.length; i++) {
      const rule = this.rules.get(ruleIds[i]);
      if (rule && rule.flagId === flagId) {
        rule.priority = i;
      }
    }
  }

  // Override operations
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

  // Evaluation tracking
  async trackEvaluation(tracking: EvaluationTracking): Promise<void> {
    const id = generateId();
    const evaluation: FlagEvaluation = {
      id,
      flagId: tracking.flagKey, // Note: this should be flagId in production
      userId: tracking.userId,
      value: tracking.value,
      variant: tracking.variant,
      reason: tracking.reason || "default",
      context: tracking.context || {},
      evaluatedAt: tracking.timestamp,
    };

    this.evaluations.set(id, evaluation);
  }

  async getEvaluations(
    flagId: string,
    options?: ListOptions,
  ): Promise<FlagEvaluation[]> {
    let evaluations = Array.from(this.evaluations.values()).filter(
      (e) => e.flagId === flagId,
    );

    // Apply sorting (default to newest first)
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
  ): Promise<EvaluationStats> {
    let evaluations = Array.from(this.evaluations.values()).filter(
      (e) => e.flagId === flagId,
    );

    if (period) {
      evaluations = evaluations.filter(
        (e) => e.evaluatedAt >= period.start && e.evaluatedAt <= period.end,
      );
    }

    const uniqueUsers = new Set(evaluations.map((e) => e.userId));
    const variants: Record<string, number> = {};
    const reasons: Record<string, number> = {};

    for (const evaluation of evaluations) {
      if (evaluation.variant) {
        variants[evaluation.variant] = (variants[evaluation.variant] || 0) + 1;
      }
      reasons[evaluation.reason] = (reasons[evaluation.reason] || 0) + 1;
    }

    return {
      totalEvaluations: evaluations.length,
      uniqueUsers: uniqueUsers.size,
      variants,
      reasons,
    };
  }

  // Audit logging
  async logAudit(entry: AuditLogEntry): Promise<void> {
    const id = generateId();
    const audit: FlagAudit = {
      id,
      userId: entry.userId,
      action: entry.action as any,
      flagId: entry.flagKey || "",
      details: entry.metadata || {},
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

    // Sort by date (newest first)
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

  // Helper methods
  private getFlagIndexKey(key: string, organizationId?: string): string {
    return organizationId ? `${organizationId}:${key}` : key;
  }
}
