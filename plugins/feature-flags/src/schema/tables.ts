// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import type { AuthPluginSchema } from "better-auth";
import * as z from "zod";
import { parseJSON } from "../utils";

/**
 * Database schema for <100ms P99 evaluation at 100K+ RPS.
 *
 * REQUIRED CONSTRAINTS (add manually):
 * ```sql
 * ALTER TABLE flag_overrides ADD CONSTRAINT uk_flag_user UNIQUE (flag_id, user_id);
 * ALTER TABLE feature_flags ADD CONSTRAINT uk_org_key UNIQUE (organization_id, key);
 * ```
 *
 * CRITICAL INDEXES:
 * - (organizationId, key) on featureFlag - O(1) tenant lookups
 * - (flagId, priority) on flagRule - O(log n) ordered evaluation
 * - (flagId, userId) on flagOverride - O(1) override checks
 *
 * @invariant Percentages: 0 ≤ n ≤ 100
 * @invariant Variant weights sum to 100 ± 0.01
 * @invariant Priority: -1000 ≤ n ≤ 1000, lower first
 * @see ../utils/index.ts for parseJSON utility
 */

export const featureFlagsSchema = {
  featureFlag: {
    modelName: "featureFlag",
    fields: {
      key: {
        type: "string",
        required: true,
        unique: true,
      },
      name: {
        type: "string",
        required: true,
      },
      description: {
        type: "string",
        required: false,
      },
      type: {
        type: "string",
        defaultValue: "boolean",
        validator: {
          input: z.enum(["boolean", "string", "number", "json"]),
          output: z.enum(["boolean", "string", "number", "json"]),
        },
      },
      enabled: {
        type: "boolean",
        defaultValue: false,
      },
      defaultValue: {
        type: "string",
        required: false,
        transform: {
          input(value: any) {
            return value !== undefined ? JSON.stringify(value) : null;
          },
          output(value: any) {
            if (!value) return null;
            return parseJSON<any>(value as string);
          },
        },
      },
      rolloutPercentage: {
        type: "number",
        defaultValue: 0,
        validator: {
          input: z.number().min(0).max(100),
          output: z.number().min(0).max(100),
        },
      },
      organizationId: {
        type: "string",
        references: {
          model: "organization",
          field: "id",
          onDelete: "cascade",
        },
        required: false,
      },
      createdAt: {
        type: "date",
        required: true,
        defaultValue: () => new Date(),
      },
      updatedAt: {
        type: "date",
        required: true,
        defaultValue: () => new Date(),
      },
      variants: {
        type: "string",
        required: false,
        transform: {
          input(value: any) {
            return value ? JSON.stringify(value) : null;
          },
          output(value: any) {
            if (!value) return null;
            return parseJSON<any>(value as string);
          },
        },
      },
      metadata: {
        type: "string",
        required: false,
        transform: {
          input(value: any) {
            return value ? JSON.stringify(value) : null;
          },
          output(value: any) {
            if (!value) return null;
            return parseJSON<any>(value as string);
          },
        },
      },
    },
  },

  flagRule: {
    modelName: "flagRule",
    fields: {
      flagId: {
        type: "string",
        references: {
          model: "featureFlag",
          field: "id",
          onDelete: "cascade",
        },
        required: true,
      },
      priority: {
        type: "number",
        defaultValue: 0,
        validator: {
          input: z.number().int().min(-1000).max(1000),
          output: z.number().int(),
        },
      },
      name: {
        type: "string",
        required: false,
      },
      conditions: {
        type: "string",
        required: true,
        transform: {
          input(value: any) {
            return JSON.stringify(value);
          },
          output(value: any) {
            return parseJSON<any>(value as string);
          },
        },
      },
      value: {
        type: "string",
        required: true,
        transform: {
          input(value: any) {
            return JSON.stringify(value);
          },
          output(value: any) {
            return parseJSON<any>(value as string);
          },
        },
      },
      percentage: {
        type: "number",
        required: false,
        validator: {
          input: z.number().min(0).max(100).optional(),
          output: z.number().min(0).max(100).optional(),
        },
      },
      enabled: {
        type: "boolean",
        defaultValue: true,
      },
      createdAt: {
        type: "date",
        required: true,
        defaultValue: () => new Date(),
      },
    },
  },

  flagOverride: {
    modelName: "flagOverride",
    fields: {
      flagId: {
        type: "string",
        references: {
          model: "featureFlag",
          field: "id",
          onDelete: "cascade",
        },
        required: true,
      },
      userId: {
        type: "string",
        references: {
          model: "user",
          field: "id",
          onDelete: "cascade",
        },
        required: true,
      },
      value: {
        type: "string",
        required: true,
        transform: {
          input(value: any) {
            return JSON.stringify(value);
          },
          output(value: any) {
            return parseJSON<any>(value as string);
          },
        },
      },
      enabled: {
        type: "boolean",
        defaultValue: true,
      },
      variant: {
        type: "string",
        required: false,
      },
      reason: {
        type: "string",
        required: false,
      },
      expiresAt: {
        type: "date",
        required: false,
      },
      createdAt: {
        type: "date",
        required: true,
        defaultValue: () => new Date(),
      },
    },
  },

  flagEvaluation: {
    modelName: "flagEvaluation",
    fields: {
      flagId: {
        type: "string",
        references: {
          model: "featureFlag",
          field: "id",
          onDelete: "cascade",
        },
        required: true,
      },
      userId: {
        type: "string",
        references: {
          model: "user",
          field: "id",
          onDelete: "set null",
        },
        required: false,
      },
      sessionId: {
        type: "string",
        required: false,
      },
      value: {
        type: "string",
        required: true,
        transform: {
          input(value: any) {
            return JSON.stringify(value);
          },
          output(value: any) {
            return parseJSON<any>(value as string);
          },
        },
      },
      variant: {
        type: "string",
        required: false,
      },
      reason: {
        type: "string",
        required: false,
        validator: {
          input: z
            .enum([
              "rule_match",
              "override",
              "percentage_rollout",
              "default",
              "disabled",
              "not_found",
            ])
            .optional(),
          output: z
            .enum([
              "rule_match",
              "override",
              "percentage_rollout",
              "default",
              "disabled",
              "not_found",
            ])
            .optional(),
        },
      },
      context: {
        type: "string",
        required: false,
        transform: {
          input(value: any) {
            return value ? JSON.stringify(value) : null;
          },
          output(value: any) {
            if (!value) return null;
            return parseJSON<any>(value as string);
          },
        },
      },
      evaluatedAt: {
        type: "date",
        required: true,
        defaultValue: () => new Date(),
      },
    },
  },

  flagAudit: {
    modelName: "flagAudit",
    fields: {
      flagId: {
        type: "string",
        references: {
          model: "featureFlag",
          field: "id",
          onDelete: "cascade",
        },
        required: true,
      },
      userId: {
        type: "string",
        references: {
          model: "user",
          field: "id",
          onDelete: "set null",
        },
        required: false,
      },
      action: {
        type: "string",
        required: true,
        validator: {
          input: z.enum([
            "created",
            "updated",
            "deleted",
            "enabled",
            "disabled",
            "rule_added",
            "rule_updated",
            "rule_deleted",
            "override_added",
            "override_removed",
          ]),
          output: z.enum([
            "created",
            "updated",
            "deleted",
            "enabled",
            "disabled",
            "rule_added",
            "rule_updated",
            "rule_deleted",
            "override_added",
            "override_removed",
          ]),
        },
      },
      previousValue: {
        type: "string",
        required: false,
        transform: {
          input(value: any) {
            return value ? JSON.stringify(value) : null;
          },
          output(value: any) {
            if (!value) return null;
            return parseJSON<any>(value as string);
          },
        },
      },
      newValue: {
        type: "string",
        required: false,
        transform: {
          input(value: any) {
            return value ? JSON.stringify(value) : null;
          },
          output(value: any) {
            if (!value) return null;
            return parseJSON<any>(value as string);
          },
        },
      },
      metadata: {
        type: "string",
        required: false,
        transform: {
          input(value: any) {
            return value ? JSON.stringify(value) : null;
          },
          output(value: any) {
            if (!value) return null;
            return parseJSON<any>(value as string);
          },
        },
      },
      createdAt: {
        type: "date",
        required: true,
        defaultValue: () => new Date(),
      },
    },
  },
} satisfies AuthPluginSchema;
