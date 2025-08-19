// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import type { StorageAdapter } from "./storage/types";
import type { EvaluationContext } from "./schema";
import type { ContextCollectionOptions } from "./middleware/context";
import type { HeaderConfig, ValidationConfig } from "./middleware/validation";

/**
 * Type utilities for flag schema validation and inference
 */

/**
 * Extracts boolean-only flag keys from a schema.
 * Used to constrain isEnabled() to only accept boolean flags.
 */
export type BooleanFlags<Schema extends Record<string, any>> = {
  [K in keyof Schema]: Schema[K] extends boolean ? K : never;
}[keyof Schema];

/**
 * Validates that a flag schema only contains valid flag value types.
 * Prevents using complex objects that can't be properly serialized.
 */
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

/**
 * Helper type to infer the value type of a specific flag
 */
export type InferFlagValue<
  Schema extends Record<string, any>,
  K extends keyof Schema,
> = Schema[K];

/**
 * Type guard to check if a flag is boolean-only
 */
export function isBooleanFlag<Schema extends Record<string, any>>(
  schema: Schema,
  key: keyof Schema,
): key is BooleanFlags<Schema> {
  return typeof schema[key] === "boolean";
}

/**
 * Internal plugin context shared across all components
 */
export interface PluginContext {
  auth: any; // Better Auth instance (type not exported directly)
  storage: StorageAdapter;
  config: PluginConfig;
  cache: Map<string, CacheEntry>;
}

/**
 * Normalized plugin configuration
 */
export interface PluginConfig {
  storage: "memory" | "database" | "redis";
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

/**
 * Static flag configuration from options
 */
export interface StaticFlagConfig {
  enabled?: boolean;
  default?: boolean;
  rollout?: number;
  targeting?: {
    roles?: string[];
    userIds?: string[];
    attributes?: Record<string, any>;
  };
  variants?: Record<string, any>;
}

/**
 * Cache entry for flag evaluations
 */
export interface CacheEntry {
  value: any;
  variant?: string;
  reason: string;
  metadata?: Record<string, any>;
  timestamp: number;
  ttl: number;
}

/**
 * Flag evaluation request
 */
export interface EvaluationRequest {
  key: string;
  userId?: string;
  context?: EvaluationContext;
  defaultValue?: any;
}

/**
 * Batch evaluation request
 */
export interface BatchEvaluationRequest {
  keys: string[];
  userId?: string;
  context?: EvaluationContext;
  defaults?: Record<string, any>;
}

/**
 * Audit log entry
 */
export interface AuditLogEntry {
  userId: string;
  action: string;
  flagKey?: string;
  metadata?: Record<string, any>;
  timestamp?: Date;
}

/**
 * Evaluation tracking data
 */
export interface EvaluationTracking {
  flagKey: string;
  userId: string;
  context?: EvaluationContext;
  timestamp: Date;
  value?: any;
  variant?: string;
  reason?: string;
}
