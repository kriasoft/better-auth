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
 * Database storage adapter using Better Auth's database connection
 */
export class DatabaseStorage implements StorageAdapter {
  private db: any;

  constructor(private config: StorageConfig) {
    if (!config.db) {
      throw new Error("Database instance is required for DatabaseStorage");
    }
    this.db = config.db;
  }

  async initialize(): Promise<void> {
    // Tables should be created by Better Auth's migration system
    // This is just for verification
    try {
      // Check if tables exist by doing a simple query
      await this.db.query.featureFlags?.findFirst?.();
    } catch (error) {
      console.warn(
        "[feature-flags] Database tables may not be initialized:",
        error,
      );
    }
  }

  async close(): Promise<void> {
    // Database connection is managed by Better Auth
  }

  // Flag operations
  async createFlag(
    flag: Omit<FeatureFlag, "id" | "createdAt" | "updatedAt">,
  ): Promise<FeatureFlag> {
    const id = generateId();
    const now = new Date();

    const newFlag = await this.db
      .insert(this.db.schema.featureFlags)
      .values({
        id,
        ...flag,
        variants: flag.variants ? JSON.stringify(flag.variants) : null,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return this.deserializeFlag(newFlag[0]);
  }

  async getFlag(
    key: string,
    organizationId?: string,
  ): Promise<FeatureFlag | null> {
    const where: any = { key };
    if (organizationId !== undefined) {
      where.organizationId = organizationId;
    }

    const flag = await this.db.query.featureFlags.findFirst({
      where,
    });

    return flag ? this.deserializeFlag(flag) : null;
  }

  async getFlagById(id: string): Promise<FeatureFlag | null> {
    const flag = await this.db.query.featureFlags.findFirst({
      where: { id },
    });

    return flag ? this.deserializeFlag(flag) : null;
  }

  async listFlags(
    organizationId?: string,
    options?: ListOptions,
  ): Promise<FeatureFlag[]> {
    const where: any = {};
    if (organizationId) {
      where.organizationId = organizationId;
    }

    if (options?.filter) {
      Object.assign(where, options.filter);
    }

    const query: any = {
      where,
      limit: options?.limit,
      offset: options?.offset,
    };

    if (options?.orderBy) {
      query.orderBy = {
        [options.orderBy]: options.orderDirection || "asc",
      };
    }

    const flags = await this.db.query.featureFlags.findMany(query);
    return flags.map((f: any) => this.deserializeFlag(f));
  }

  async updateFlag(
    id: string,
    updates: Partial<FeatureFlag>,
  ): Promise<FeatureFlag> {
    const updateData: any = {
      ...updates,
      updatedAt: new Date(),
    };

    if (updates.variants) {
      updateData.variants = JSON.stringify(updates.variants);
    }

    const updated = await this.db
      .update(this.db.schema.featureFlags)
      .set(updateData)
      .where({ id })
      .returning();

    if (!updated[0]) {
      throw new Error(`Flag not found: ${id}`);
    }

    return this.deserializeFlag(updated[0]);
  }

  async deleteFlag(id: string): Promise<void> {
    // Delete associated data first (cascading delete)
    await this.db.delete(this.db.schema.flagRules).where({ flagId: id });
    await this.db.delete(this.db.schema.flagOverrides).where({ flagId: id });
    await this.db.delete(this.db.schema.flagEvaluations).where({ flagId: id });
    await this.db.delete(this.db.schema.flagAudits).where({ flagId: id });

    // Delete the flag
    await this.db.delete(this.db.schema.featureFlags).where({ id });
  }

  // Rule operations
  async createRule(
    rule: Omit<FlagRule, "id" | "createdAt">,
  ): Promise<FlagRule> {
    const id = generateId();

    const newRule = await this.db
      .insert(this.db.schema.flagRules)
      .values({
        id,
        ...rule,
        conditions: JSON.stringify(rule.conditions),
        value: rule.value !== undefined ? JSON.stringify(rule.value) : null,
        createdAt: new Date(),
      })
      .returning();

    return this.deserializeRule(newRule[0]);
  }

  async getRulesForFlag(flagId: string): Promise<FlagRule[]> {
    const rules = await this.db.query.flagRules.findMany({
      where: { flagId },
      orderBy: { priority: "asc" },
    });

    return rules.map((r: any) => this.deserializeRule(r));
  }

  async updateRule(id: string, updates: Partial<FlagRule>): Promise<FlagRule> {
    const updateData: any = { ...updates };

    if (updates.conditions) {
      updateData.conditions = JSON.stringify(updates.conditions);
    }
    if (updates.value !== undefined) {
      updateData.value = JSON.stringify(updates.value);
    }

    const updated = await this.db
      .update(this.db.schema.flagRules)
      .set(updateData)
      .where({ id })
      .returning();

    if (!updated[0]) {
      throw new Error(`Rule not found: ${id}`);
    }

    return this.deserializeRule(updated[0]);
  }

  async deleteRule(id: string): Promise<void> {
    await this.db.delete(this.db.schema.flagRules).where({ id });
  }

  async reorderRules(flagId: string, ruleIds: string[]): Promise<void> {
    // Update priorities in a transaction
    await this.db.transaction(async (tx: any) => {
      for (let i = 0; i < ruleIds.length; i++) {
        await tx
          .update(this.db.schema.flagRules)
          .set({ priority: i })
          .where({ id: ruleIds[i], flagId });
      }
    });
  }

  // Override operations
  async createOverride(
    override: Omit<FlagOverride, "id" | "createdAt">,
  ): Promise<FlagOverride> {
    const id = generateId();

    const newOverride = await this.db
      .insert(this.db.schema.flagOverrides)
      .values({
        id,
        ...override,
        value: JSON.stringify(override.value),
        createdAt: new Date(),
      })
      .returning();

    return this.deserializeOverride(newOverride[0]);
  }

  async getOverride(
    flagId: string,
    userId: string,
  ): Promise<FlagOverride | null> {
    const override = await this.db.query.flagOverrides.findFirst({
      where: { flagId, userId },
    });

    return override ? this.deserializeOverride(override) : null;
  }

  async updateOverride(
    id: string,
    updates: Partial<FlagOverride>,
  ): Promise<FlagOverride> {
    const updateData: any = { ...updates };

    if (updates.value !== undefined) {
      updateData.value = JSON.stringify(updates.value);
    }

    const updated = await this.db
      .update(this.db.schema.flagOverrides)
      .set(updateData)
      .where({ id })
      .returning();

    if (!updated[0]) {
      throw new Error(`Override not found: ${id}`);
    }

    return this.deserializeOverride(updated[0]);
  }

  async listOverrides(
    flagId?: string,
    userId?: string,
  ): Promise<FlagOverride[]> {
    const where: any = {};
    if (flagId) where.flagId = flagId;
    if (userId) where.userId = userId;

    const overrides = await this.db.query.flagOverrides.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return overrides.map((o: any) => this.deserializeOverride(o));
  }

  async deleteOverride(id: string): Promise<void> {
    await this.db.delete(this.db.schema.flagOverrides).where({ id });
  }

  // Evaluation tracking
  async trackEvaluation(tracking: EvaluationTracking): Promise<void> {
    const id = generateId();

    await this.db.insert(this.db.schema.flagEvaluations).values({
      id,
      flagId: tracking.flagKey, // Note: should map to actual flagId
      userId: tracking.userId,
      value:
        tracking.value !== undefined ? JSON.stringify(tracking.value) : null,
      variant: tracking.variant,
      reason: tracking.reason || "default",
      context: JSON.stringify(tracking.context || {}),
      evaluatedAt: tracking.timestamp,
    });
  }

  async getEvaluations(
    flagId: string,
    options?: ListOptions,
  ): Promise<FlagEvaluation[]> {
    const evaluations = await this.db.query.flagEvaluations.findMany({
      where: { flagId },
      orderBy: { evaluatedAt: "desc" },
      limit: options?.limit,
      offset: options?.offset,
    });

    return evaluations.map((e: any) => this.deserializeEvaluation(e));
  }

  async getEvaluationStats(
    flagId: string,
    period?: DateRange,
  ): Promise<EvaluationStats> {
    const where: any = { flagId };
    if (period) {
      where.evaluatedAt = {
        gte: period.start,
        lte: period.end,
      };
    }

    const evaluations = await this.db.query.flagEvaluations.findMany({
      where,
    });

    const uniqueUsers = new Set(evaluations.map((e: any) => e.userId));
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

    await this.db.insert(this.db.schema.flagAudits).values({
      id,
      userId: entry.userId,
      action: entry.action,
      flagId: entry.flagKey || null,
      details: JSON.stringify(entry.metadata || {}),
      createdAt: entry.timestamp || new Date(),
    });
  }

  async getAuditLogs(options?: AuditQueryOptions): Promise<FlagAudit[]> {
    const where: any = {};
    if (options?.userId) where.userId = options.userId;
    if (options?.flagId) where.flagId = options.flagId;
    if (options?.action) where.action = options.action;
    if (options?.startDate) {
      where.createdAt = { ...where.createdAt, gte: options.startDate };
    }
    if (options?.endDate) {
      where.createdAt = { ...where.createdAt, lte: options.endDate };
    }

    const logs = await this.db.query.flagAudits.findMany({
      where,
      orderBy: { createdAt: "desc" },
      limit: options?.limit,
      offset: options?.offset,
    });

    return logs.map((l: any) => this.deserializeAudit(l));
  }

  async cleanupAuditLogs(olderThan: Date): Promise<number> {
    const result = await this.db
      .delete(this.db.schema.flagAudits)
      .where({ createdAt: { lt: olderThan } });

    return result.rowCount || 0;
  }

  // Deserialization helpers
  private deserializeFlag(flag: any): FeatureFlag {
    return {
      ...flag,
      variants: flag.variants ? JSON.parse(flag.variants) : undefined,
      createdAt: new Date(flag.createdAt),
      updatedAt: new Date(flag.updatedAt),
    };
  }

  private deserializeRule(rule: any): FlagRule {
    return {
      ...rule,
      conditions: JSON.parse(rule.conditions),
      value: rule.value ? JSON.parse(rule.value) : undefined,
      createdAt: new Date(rule.createdAt),
    };
  }

  private deserializeOverride(override: any): FlagOverride {
    return {
      ...override,
      value: JSON.parse(override.value),
      createdAt: new Date(override.createdAt),
    };
  }

  private deserializeEvaluation(evaluation: any): FlagEvaluation {
    return {
      ...evaluation,
      value: evaluation.value ? JSON.parse(evaluation.value) : undefined,
      context: JSON.parse(evaluation.context),
      evaluatedAt: new Date(evaluation.evaluatedAt),
    };
  }

  private deserializeAudit(audit: any): FlagAudit {
    return {
      ...audit,
      details: JSON.parse(audit.details),
      createdAt: new Date(audit.createdAt),
    };
  }
}
