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

/**
 * Storage adapter interface for memory, database, and Redis backends.
 * Provides unified API for feature flag CRUD, analytics, and audit operations.
 * @see src/storage/database.ts, src/storage/memory.ts, src/storage/redis.ts
 */
export interface StorageAdapter {
  /** Initialize storage connections and schema. Optional for memory adapter. */
  initialize?(): Promise<void>;

  /** Cleanup connections and release resources. */
  close?(): Promise<void>;

  // Feature flag CRUD with multi-tenant support
  /** Create new feature flag with auto-generated ID and timestamps */
  createFlag(
    flag: Omit<FeatureFlag, "id" | "createdAt" | "updatedAt">,
  ): Promise<FeatureFlag>;
  /** Get flag by key with optional organization scoping */
  getFlag(key: string, organizationId?: string): Promise<FeatureFlag | null>;
  /** Get flag by internal ID */
  getFlagById(id: string): Promise<FeatureFlag | null>;
  /** List flags with optional filtering, sorting, and pagination */
  listFlags(
    organizationId?: string,
    options?: ListOptions,
  ): Promise<FeatureFlag[]>;
  /** Update flag and auto-set updatedAt timestamp */
  updateFlag(id: string, updates: Partial<FeatureFlag>): Promise<FeatureFlag>;
  /** Delete flag and cascade to rules/overrides */
  deleteFlag(id: string): Promise<void>;

  // Evaluation rules with priority ordering
  /** Create rule with auto-generated ID and timestamp */
  createRule(rule: Omit<FlagRule, "id" | "createdAt">): Promise<FlagRule>;
  getRule(id: string): Promise<FlagRule | null>;
  /** Get all rules for flag ordered by priority */
  getRulesForFlag(flagId: string): Promise<FlagRule[]>;
  updateRule(id: string, updates: Partial<FlagRule>): Promise<FlagRule>;
  deleteRule(id: string): Promise<void>;
  /** Reorder rules by updating priority based on array position */
  reorderRules(flagId: string, ruleIds: string[]): Promise<void>;

  // User-specific flag value overrides
  /** Create user override with auto-generated ID */
  createOverride(
    override: Omit<FlagOverride, "id" | "createdAt">,
  ): Promise<FlagOverride>;
  /** Get override for specific flag and user combination */
  getOverride(flagId: string, userId: string): Promise<FlagOverride | null>;
  getOverrideById(id: string): Promise<FlagOverride | null>;
  updateOverride(
    id: string,
    updates: Partial<FlagOverride>,
  ): Promise<FlagOverride>;
  listOverrides(flagId?: string, userId?: string): Promise<FlagOverride[]>;
  deleteOverride(id: string): Promise<void>;

  // Analytics: evaluation tracking and metrics
  /** Record flag evaluation event for analytics */
  trackEvaluation(tracking: EvaluationTracking): Promise<void>;
  getEvaluations(
    flagId: string,
    options?: ListOptions,
  ): Promise<FlagEvaluation[]>;
  /** Get aggregated evaluation metrics for flag */
  getEvaluationStats(
    flagId: string,
    period?: DateRange,
    options?: AnalyticsOptions,
  ): Promise<EvaluationStats>;
  getUsageMetrics(
    organizationId?: string,
    period?: DateRange,
    options?: AnalyticsOptions,
  ): Promise<UsageMetrics>;

  // Audit trail for compliance and debugging
  /** Record audit event for flag operations */
  logAudit(entry: AuditLogEntry): Promise<void>;
  getAuditLogs(options?: AuditQueryOptions): Promise<FlagAudit[]>;
  getAuditEntry(id: string): Promise<FlagAudit | null>;
  /** Remove old audit logs and return count deleted */
  cleanupAuditLogs(olderThan: Date): Promise<number>;

  // Batch operations for performance optimization (optional)
  bulkCreateFlags?(
    flags: Array<Omit<FeatureFlag, "id" | "createdAt" | "updatedAt">>,
  ): Promise<FeatureFlag[]>;
  bulkDeleteFlags?(ids: string[]): Promise<void>;
}

/** Pagination and filtering options for list operations */
export interface ListOptions {
  /** Maximum records to return */
  limit?: number;
  /** Number of records to skip */
  offset?: number;
  /** Field name for sorting */
  orderBy?: string;
  /** Sort direction */
  orderDirection?: "asc" | "desc";
  /** Field-value filters */
  filter?: Record<string, any>;
}

/** Time period filter for analytics queries */
export interface DateRange {
  /** Period start timestamp (inclusive) */
  start: Date;
  /** Period end timestamp (inclusive) */
  end: Date;
}

/** Selective metrics configuration for analytics queries */
export type MetricsFilter = Array<
  "total" | "uniqueUsers" | "errorRate" | "avgLatency" | "variants" | "reasons"
>;

/** Analytics query options for performance optimization */
export interface AnalyticsOptions {
  /** Granularity for time-series data */
  granularity?: "hour" | "day" | "week" | "month";
  /** Timezone for date calculations */
  timezone?: string;
  /** Selective metrics to compute (performance optimization) */
  metrics?: MetricsFilter;
}

/** Aggregated flag evaluation metrics with selective computation */
export interface EvaluationStats {
  /** Total evaluation count - included when metrics contains 'total' or undefined */
  totalEvaluations?: number;
  /** Distinct user count - included when metrics contains 'uniqueUsers' or undefined */
  uniqueUsers?: number;
  /** Variant distribution counts - included when metrics contains 'variants' or undefined */
  variants?: Record<string, number>;
  /** Evaluation reason counts - included when metrics contains 'reasons' or undefined */
  reasons?: Record<string, number>;
  /** Average response time in ms - included when metrics contains 'avgLatency' or undefined */
  avgLatency?: number;
  /** Error percentage (0-1) - included when metrics contains 'errorRate' or undefined */
  errorRate?: number;
}

/** Audit log query filters and pagination */
export interface AuditQueryOptions extends ListOptions {
  /** Filter by user who performed action */
  userId?: string;
  /** Filter by flag ID */
  flagId?: string;
  /** Filter by action type */
  action?: string;
  /** Filter events after this date */
  startDate?: Date;
  /** Filter events before this date */
  endDate?: Date;
}

/** Organization-level usage analytics with selective computation */
export interface UsageMetrics {
  /** Total flag count - included when metrics contains 'total' or undefined */
  totalFlags?: number;
  /** Enabled flag count - included when metrics contains 'total' or undefined */
  activeFlags?: number;
  /** Total evaluation count - included when metrics contains 'total' or undefined */
  totalEvaluations?: number;
  /** Distinct user count - included when metrics contains 'uniqueUsers' or undefined */
  uniqueUsers?: number;
  /** Most evaluated flags - included when metrics contains 'total' or undefined */
  topFlags?: Array<{
    key: string;
    evaluations: number;
    uniqueUsers: number;
  }>;
  /** Daily evaluation counts - included when metrics contains 'total' or undefined */
  evaluationsByDate?: Record<string, number>;
  /** Error rate percentage - included when metrics contains 'errorRate' or undefined */
  errorRate?: number;
  /** Average latency in ms - included when metrics contains 'avgLatency' or undefined */
  avgLatency?: number;
}

/** Storage adapter configuration */
export interface StorageConfig {
  /** Better Auth Drizzle database instance */
  db?: any;
  /** Redis connection settings */
  redis?: RedisConfig;
  /** Cache configuration */
  caching?: {
    enabled: boolean;
    ttl: number;
  };
  /** Strategy for unknown flag evaluations: log (warn), throw (error), track-unknown (store) */
  unknownFlagStrategy?: "log" | "throw" | "track-unknown";
}

/** Redis connection configuration */
export interface RedisConfig {
  /** Redis connection URL (redis://host:port) */
  url?: string;
  /** Redis host (default: localhost) */
  host?: string;
  /** Redis port (default: 6379) */
  port?: number;
  /** Redis auth password */
  password?: string;
  /** Redis database number (default: 0) */
  db?: number;
  /** Key prefix for namespacing (default: ff:) */
  keyPrefix?: string;
}
