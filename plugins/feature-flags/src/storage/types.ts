// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import type {
  FeatureFlag,
  FlagRule,
  FlagOverride,
  FlagEvaluation,
  FlagAudit,
  EvaluationContext,
} from "../schema";
import type { AuditLogEntry, EvaluationTracking } from "../types";

/**
 * Common storage adapter interface for all backends
 */
export interface StorageAdapter {
  /**
   * Initialize the storage backend (create tables, establish connections, etc.)
   */
  initialize?(): Promise<void>;

  /**
   * Close/cleanup storage connections
   */
  close?(): Promise<void>;

  // Flag operations
  createFlag(
    flag: Omit<FeatureFlag, "id" | "createdAt" | "updatedAt">,
  ): Promise<FeatureFlag>;
  getFlag(key: string, organizationId?: string): Promise<FeatureFlag | null>;
  getFlagById(id: string): Promise<FeatureFlag | null>;
  listFlags(
    organizationId?: string,
    options?: ListOptions,
  ): Promise<FeatureFlag[]>;
  updateFlag(id: string, updates: Partial<FeatureFlag>): Promise<FeatureFlag>;
  deleteFlag(id: string): Promise<void>;

  // Rule operations
  createRule(rule: Omit<FlagRule, "id" | "createdAt">): Promise<FlagRule>;
  getRulesForFlag(flagId: string): Promise<FlagRule[]>;
  updateRule(id: string, updates: Partial<FlagRule>): Promise<FlagRule>;
  deleteRule(id: string): Promise<void>;
  reorderRules(flagId: string, ruleIds: string[]): Promise<void>;

  // Override operations
  createOverride(
    override: Omit<FlagOverride, "id" | "createdAt">,
  ): Promise<FlagOverride>;
  getOverride(flagId: string, userId: string): Promise<FlagOverride | null>;
  updateOverride(
    id: string,
    updates: Partial<FlagOverride>,
  ): Promise<FlagOverride>;
  listOverrides(flagId?: string, userId?: string): Promise<FlagOverride[]>;
  deleteOverride(id: string): Promise<void>;

  // Evaluation tracking (optional for analytics)
  trackEvaluation(tracking: EvaluationTracking): Promise<void>;
  getEvaluations(
    flagId: string,
    options?: ListOptions,
  ): Promise<FlagEvaluation[]>;
  getEvaluationStats(
    flagId: string,
    period?: DateRange,
  ): Promise<EvaluationStats>;

  // Audit logging (optional)
  logAudit(entry: AuditLogEntry): Promise<void>;
  getAuditLogs(options?: AuditQueryOptions): Promise<FlagAudit[]>;
  cleanupAuditLogs(olderThan: Date): Promise<number>;

  // Bulk operations
  bulkCreateFlags?(
    flags: Array<Omit<FeatureFlag, "id" | "createdAt" | "updatedAt">>,
  ): Promise<FeatureFlag[]>;
  bulkDeleteFlags?(ids: string[]): Promise<void>;
}

/**
 * Options for listing operations
 */
export interface ListOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: "asc" | "desc";
  filter?: Record<string, any>;
}

/**
 * Date range for queries
 */
export interface DateRange {
  start: Date;
  end: Date;
}

/**
 * Statistics for flag evaluations
 */
export interface EvaluationStats {
  totalEvaluations: number;
  uniqueUsers: number;
  variants: Record<string, number>;
  reasons: Record<string, number>;
  avgLatency?: number;
  errorRate?: number;
}

/**
 * Options for querying audit logs
 */
export interface AuditQueryOptions extends ListOptions {
  userId?: string;
  flagId?: string;
  action?: string;
  startDate?: Date;
  endDate?: Date;
}

/**
 * Configuration for storage adapters
 */
export interface StorageConfig {
  db?: any; // Better Auth database instance
  redis?: RedisConfig;
  caching?: {
    enabled: boolean;
    ttl: number;
  };
}

/**
 * Redis configuration
 */
export interface RedisConfig {
  url?: string;
  host?: string;
  port?: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
}
