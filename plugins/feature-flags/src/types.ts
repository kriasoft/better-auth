// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import type { LRUCache } from "./lru-cache";
import type { ContextCollectionOptions } from "./middleware/context";
import type { HeaderConfig, ValidationConfig } from "./middleware/validation";
import type { EvaluationContext, EvaluationReason } from "./schema";
import type { StorageAdapter } from "./storage/types";

/** Type utilities for schema validation and type inference */

/** Extracts boolean flag keys, constrains isEnabled() to boolean flags only */
export type BooleanFlags<Schema extends Record<string, any>> = {
  [K in keyof Schema]: Schema[K] extends boolean ? K : never;
}[keyof Schema];

/** Validates schema contains only serializable flag types */
export type ValidateFlagSchema<T> =
  T extends Record<string, any>
    ? {
        [K in keyof T]: T[K] extends
          | boolean
          | string
          | number
          | null
          | undefined
          ? T[K]
          : T[K] extends Array<infer U>
            ? U extends boolean | string | number | null | undefined
              ? T[K]
              : never
            : never;
      }
    : never;

/** Infers specific flag value type from schema */
export type InferFlagValue<
  Schema extends Record<string, any>,
  K extends keyof Schema,
> = Schema[K];

/** Type guard for boolean-only flags */
export function isBooleanFlag<Schema extends Record<string, any>>(
  schema: Schema,
  key: keyof Schema,
): key is BooleanFlags<Schema> {
  return typeof schema[key] === "boolean";
}

/** Plugin context shared across components, storage, and middleware */
export interface PluginContext {
  /** Better Auth instance (type not exported directly) */
  auth: any;
  /** Storage adapter for flag persistence */
  storage: StorageAdapter;
  /** Normalized plugin configuration */
  config: PluginConfig;
  /** LRU cache for flag evaluations */
  cache: LRUCache<CacheEntry>;
}

/** Normalized plugin configuration with defaults applied */
export interface PluginConfig {
  storage: "memory" | "database" | "redis";
  debug: boolean;
  analytics: {
    trackUsage: boolean;
    trackPerformance: boolean;
  };
  adminAccess: {
    enabled: boolean;
    roles: string[];
  };
  multiTenant: {
    enabled: boolean;
    useOrganizations: boolean;
  };
  caching: {
    enabled: boolean;
    ttl: number;
    maxSize?: number;
  };
  audit: {
    enabled: boolean;
    retentionDays: number;
  };
  contextCollection: ContextCollectionOptions;
  customHeaders?: {
    enabled: boolean;
    whitelist?: HeaderConfig[];
    strict?: boolean;
    logInvalid?: boolean;
  };
  contextValidation?: ValidationConfig;
  flags: Record<string, StaticFlagConfig>;
}

/** Static flag configuration defined in plugin options */
export interface StaticFlagConfig {
  /** Flag enabled state */
  enabled?: boolean;
  /** Default value when no rules match */
  default?: boolean;
  /** Percentage rollout (0-100) */
  rolloutPercentage?: number;
  /** User targeting rules */
  targeting?: {
    /** Required user roles */
    roles?: string[];
    /** Specific user IDs */
    userIds?: string[];
    /** Custom attribute matching */
    attributes?: Record<string, any>;
  };
  /** A/B test variants with weights */
  variants?: Array<{
    /** Variant identifier */
    key: string;
    /** Variant value */
    value: any;
    /** Traffic allocation percentage */
    weight?: number;
  }>;
}

/** Cache entry storing flag evaluation results with metadata */
export interface CacheEntry {
  /** Evaluated flag value */
  value: any;
  /** A/B test variant if applicable */
  variant?: string;
  /** Evaluation reason (rule_match, percentage_rollout, etc.) */
  reason: string;
  /** Additional evaluation metadata */
  metadata?: Record<string, any>;
  /** Evaluation timestamp */
  timestamp: number;
  /** Cache TTL in milliseconds */
  ttl: number;
}

/** Individual flag evaluation request */
export interface EvaluationRequest {
  /** Flag key to evaluate */
  key: string;
  /** User ID for targeting */
  userId?: string;
  /** Additional evaluation context */
  context?: EvaluationContext;
  /** Fallback value */
  defaultValue?: any;
}

/** Batch flag evaluation request for multiple flags */
export interface BatchEvaluationRequest {
  /** Flag keys to evaluate */
  keys: string[];
  /** User ID for targeting */
  userId?: string;
  /** Shared evaluation context */
  context?: EvaluationContext;
  /** Default values by flag key */
  defaults?: Record<string, any>;
}

/** Audit log entry for tracking flag operations */
export interface AuditLogEntry {
  /** User performing action */
  userId: string;
  /** Action type (create, update, delete) */
  action: string;
  /** Flag key if applicable */
  flagKey?: string;
  /** Flag ID if applicable (takes precedence over flagKey) */
  flagId?: string;
  /** Organization ID for multi-tenant scoping */
  organizationId?: string;
  /** Additional context data */
  metadata?: Record<string, any>;
  /** Action timestamp */
  timestamp?: Date;
}

/** Analytics tracking data for flag evaluations */
export interface EvaluationTracking {
  /** Flag key that was evaluated */
  flagKey: string;
  /** User ID for tracking */
  userId: string;
  /** Organization ID for multi-tenant scoping */
  organizationId?: string;
  /** Evaluation context data */
  context?: EvaluationContext;
  /** Evaluation timestamp */
  timestamp: Date;
  /** Evaluated flag value */
  value?: any;
  /** A/B test variant if applicable */
  variant?: string;
  /** Evaluation reason */
  reason?: EvaluationReason;
}

// Public plugin options (moved from src/index.ts to avoid circular deps)
export interface FeatureFlagsOptions {
  flags?: {
    [key: string]: {
      enabled?: boolean;
      default?: any; // Allow any type for flag default values
      rolloutPercentage?: number; // Percentage 0-100
      targeting?: {
        roles?: string[];
        userIds?: string[];
        attributes?: Record<string, any>;
      };
      variants?: Array<{
        key: string;
        value: any;
        weight?: number; // Distribution weight, must sum to 100 if specified
      }>;
    };
  };
  storage?: "memory" | "database" | "redis";
  debug?: boolean;
  analytics?: {
    trackUsage?: boolean;
    trackPerformance?: boolean;
  };
  adminAccess?: {
    enabled?: boolean;
    roles?: string[];
  };
  multiTenant?: {
    enabled?: boolean;
    useOrganizations?: boolean;
  };
  caching?: {
    enabled?: boolean;
    ttl?: number; // seconds
    maxSize?: number; // Maximum number of cache entries
  };
  audit?: {
    enabled?: boolean;
    retentionDays?: number;
  };
  /**
   * Configure what context data to collect for flag evaluation.
   * By default, only basic session data is collected for privacy.
   */
  contextCollection?: ContextCollectionOptions;
  /**
   * Configure custom header processing for feature flag evaluation.
   * Provides a secure whitelist-based approach for header extraction.
   */
  customHeaders?: {
    enabled?: boolean;
    whitelist?: HeaderConfig[];
    strict?: boolean;
    logInvalid?: boolean;
  };
  /**
   * Configure validation rules for context data.
   * Helps prevent memory exhaustion and security issues.
   */
  contextValidation?: ValidationConfig;
}
