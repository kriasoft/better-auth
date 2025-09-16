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
  StorageAdapter,
  StorageConfig,
  UsageMetrics,
} from "./types";

/**
 * SQL database adapter using Better Auth's Drizzle instance.
 * Handles JSON serialization, multi-tenancy, and referential integrity.
 * @see vendor/better-auth/docs for schema requirements
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
    // Tables created by Better Auth migrations
    try {
      await this.db.query.featureFlags?.findFirst?.();
    } catch (error) {
      console.warn("[feature-flags] Tables missing - run migrations:", error);
    }
  }

  async close(): Promise<void> {
    // Connection managed by Better Auth core
  }

  /** Resolve flag key to ID with organization scoping */
  private async getFlagIdFromKey(
    flagKey: string,
    organizationId?: string,
  ): Promise<string | null> {
    try {
      // Build where clause with organization scoping
      const whereClause = (featureFlags: any, { eq, and }: any) => {
        const conditions = [eq(featureFlags.key, flagKey)];

        if (organizationId !== undefined) {
          conditions.push(eq(featureFlags.organizationId, organizationId));
        }

        return conditions.length === 1 ? conditions[0] : and(...conditions);
      };

      const flag = await this.db.query.featureFlags.findFirst({
        where: whereClause,
        columns: { id: true },
      });

      if (!flag) {
        const orgScope = organizationId ? ` (org: ${organizationId})` : "";
        console.warn(
          `[feature-flags] Cannot find flag ID for key: ${flagKey}${orgScope}`,
        );
        return null;
      }

      return flag.id;
    } catch (error) {
      console.error(
        `[feature-flags] Error looking up flag ID for key ${flagKey}:`,
        error,
      );
      return null;
    }
  }

  // Flag CRUD with JSON serialization
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
    // DB foreign keys with onDelete: "cascade" handle related records automatically
    await this.db.delete(this.db.schema.featureFlags).where({ id });
  }

  // Rule CRUD with priority ordering
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
    // Atomic reordering prevents race conditions
    await this.db.transaction(async (tx: any) => {
      for (let i = 0; i < ruleIds.length; i++) {
        await tx
          .update(this.db.schema.flagRules)
          .set({ priority: i })
          .where({ id: ruleIds[i], flagId });
      }
    });
  }

  // User-specific overrides
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

  // Analytics: evaluation tracking
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
          return; // Maintain FK integrity
      }
    }

    const id = generateId();

    await this.db.insert(this.db.schema.flagEvaluations).values({
      id,
      flagId,
      userId: tracking.userId,
      value:
        tracking.value !== undefined ? JSON.stringify(tracking.value) : null,
      variant: tracking.variant,
      reason: tracking.reason || "default",
      context: JSON.stringify(tracking.context || {}),
      evaluatedAt: tracking.timestamp,
    });
  }

  /** Track unknown flag evaluations using system flag */
  private async trackUnknownFlagEvaluation(
    tracking: EvaluationTracking,
  ): Promise<void> {
    const unknownFlagId = await this.getOrCreateUnknownFlagId();
    const id = generateId();

    // Store original key in context for debugging
    const contextWithOriginalKey = {
      ...tracking.context,
      originalFlagKey: tracking.flagKey,
      originalOrganizationId: tracking.organizationId,
    };

    await this.db.insert(this.db.schema.flagEvaluations).values({
      id,
      flagId: unknownFlagId,
      userId: tracking.userId,
      value:
        tracking.value !== undefined ? JSON.stringify(tracking.value) : null,
      variant: tracking.variant,
      reason: "not_found",
      context: JSON.stringify(contextWithOriginalKey),
      evaluatedAt: tracking.timestamp,
    });
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

  // Audit trail for compliance
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

    // Skip audit if flagId cannot be resolved (prevents FK violations)
    if (!flagId) {
      console.warn(
        `[feature-flags] Skipping audit log - cannot resolve flagId for action '${entry.action}'`,
      );
      return;
    }

    await this.db.insert(this.db.schema.flagAudits).values({
      id,
      userId: entry.userId,
      action: entry.action,
      flagId,
      metadata: JSON.stringify(entry.metadata || {}),
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

  async getRule(id: string): Promise<FlagRule | null> {
    const rule = await this.db.query.flagRules?.findFirst?.({
      where: { id },
    });
    return rule ? this.deserializeRule(rule) : null;
  }

  async getOverrideById(id: string): Promise<FlagOverride | null> {
    const override = await this.db.query.flagOverrides?.findFirst?.({
      where: { id },
    });
    return override ? this.deserializeOverride(override) : null;
  }

  async getAuditEntry(id: string): Promise<FlagAudit | null> {
    const audit = await this.db.query.flagAudits?.findFirst?.({
      where: { id },
    });
    return audit ? this.deserializeAudit(audit) : null;
  }

  async getUsageMetrics(
    organizationId?: string,
    period?: DateRange,
  ): Promise<UsageMetrics> {
    // TODO: Use SQL aggregations for better performance

    // Get flag counts
    const flagCountQuery = organizationId ? { organizationId } : {};

    const allFlags =
      (await this.db.query.featureFlags?.findMany?.({
        where: flagCountQuery,
      })) || [];

    const totalFlags = allFlags.length;
    const activeFlags = allFlags.filter((f: any) => f.enabled).length;

    // Get evaluation counts (simplified - would use SQL aggregations in production)
    const evaluationQuery: any = {};
    if (period) {
      evaluationQuery.evaluatedAt = {
        gte: period.start,
        lte: period.end,
      };
    }

    const evaluations =
      (await this.db.query.flagEvaluations?.findMany?.({
        where: evaluationQuery,
      })) || [];

    const totalEvaluations = evaluations.length;
    const uniqueUsers = new Set(
      evaluations.map((e: any) => e.userId).filter(Boolean),
    ).size;

    // Calculate top flags by evaluation count
    const flagCounts = new Map<string, number>();
    const flagUserCounts = new Map<string, Set<string>>();

    for (const evaluation of evaluations) {
      const flagId = evaluation.flagId;
      flagCounts.set(flagId, (flagCounts.get(flagId) || 0) + 1);

      if (!flagUserCounts.has(flagId)) {
        flagUserCounts.set(flagId, new Set());
      }
      if (evaluation.userId) {
        flagUserCounts.get(flagId)!.add(evaluation.userId);
      }
    }

    const topFlags = Array.from(flagCounts.entries())
      .map(([flagId, evaluationCount]) => {
        const flag = allFlags.find((f: any) => f.id === flagId);
        return {
          key: flag?.key || flagId,
          evaluations: evaluationCount,
          uniqueUsers: flagUserCounts.get(flagId)?.size || 0,
        };
      })
      .sort((a, b) => b.evaluations - a.evaluations)
      .slice(0, 10);

    // Evaluations by date
    const evaluationsByDate: Record<string, number> = {};
    for (const evaluation of evaluations) {
      const dateKey = new Date(evaluation.evaluatedAt)
        .toISOString()
        .split("T")[0]!;
      evaluationsByDate[dateKey] = (evaluationsByDate[dateKey] || 0) + 1;
    }

    return {
      totalFlags,
      activeFlags,
      totalEvaluations,
      uniqueUsers,
      topFlags,
      evaluationsByDate,
      errorRate: 0, // Would calculate from error tracking
      avgLatency: 0, // Would calculate from performance metrics
    };
  }

  // JSON deserialization with date parsing
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
      metadata: JSON.parse(audit.metadata || "{}"),
      createdAt: new Date(audit.createdAt),
    };
  }
}
