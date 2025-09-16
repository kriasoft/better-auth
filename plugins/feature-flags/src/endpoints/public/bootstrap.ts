// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import type { BetterAuthPlugin } from "better-auth";
import { createAuthEndpoint } from "better-auth/api";
import { z } from "zod";
import { evaluateFlags } from "../../evaluation";
import { environmentParamSchema, selectSchema } from "../../schema/validation";
import type { PluginContext } from "../../types";
import { buildCtx, resolveEnvironment } from "../shared";

/** Better Auth plugin endpoints type, avoids import cycles with endpoints/index.ts */
export type FlagEndpoints = NonNullable<BetterAuthPlugin["endpoints"]>;

/**
 * Creates public endpoint for feature flag bootstrap/initialization.
 *
 * ENDPOINT: POST /feature-flags/bootstrap - Bulk flag initialization
 *
 * OPTIMIZATION: Designed for app startup and initial page loads,
 * providing all relevant flags in a single request.
 *
 * ENABLED FLAGS ONLY: Server-side filtering for performance and security:
 * - Reduces payload size
 * - Prevents clients seeing disabled experiments
 * - Simplifies client-side flag management
 *
 * @param pluginContext - Plugin context with DB, config, and utilities
 * @returns Bootstrap endpoint for bulk flag initialization
 * @see plugins/feature-flags/src/endpoints/shared.ts
 * @see plugins/feature-flags/src/evaluation.ts
 */
export function createPublicBootstrapEndpoints(
  pluginContext: PluginContext,
): FlagEndpoints {
  // POST /feature-flags/bootstrap (canonical)
  const bootstrapFeatureFlagsHandler = createAuthEndpoint(
    "/feature-flags/bootstrap",
    {
      method: "POST",
      body: z
        .object({
          context: z
            .record(z.string(), z.any())
            .optional()
            .describe("Additional evaluation context"),
          // Server-side filtering for efficiency
          include: z
            .array(z.string())
            .optional()
            .describe("Include only specific flag keys"),
          prefix: z
            .string()
            .optional()
            .describe("Include only flags with this prefix"),
          select: selectSchema
            .optional()
            .describe(
              "Response format: 'value', 'full', or array of specific fields",
            ),
          track: z
            .boolean()
            .optional()
            .default(true)
            .describe("Whether to track these evaluations"),
          debug: z
            .boolean()
            .optional()
            .describe("Include debug information in response"),
          environment: environmentParamSchema.optional(),
        })
        .optional(),
      metadata: {
        openapi: {
          operationId: "auth.api.bootstrapFeatureFlags",
          summary: "Bootstrap Feature Flags",
          description:
            "Retrieves and evaluates all enabled feature flags for the current user. This is the canonical method for bulk flag initialization.",
          responses: {
            "200": {
              description: "All evaluated flags",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      flags: {
                        type: "object",
                        additionalProperties: {
                          type: "object",
                          properties: {
                            value: { description: "The evaluated flag value" },
                            variant: {
                              type: "object",
                              description: "Variant information",
                            },
                            reason: {
                              type: "string",
                              description: "Evaluation reason",
                            },
                          },
                        },
                      },
                      context: {
                        type: "object",
                        description: "Evaluation context used",
                      },
                      evaluatedAt: { type: "string", format: "date-time" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (ctx) => {
      const {
        context: additionalContext = {},
        include,
        prefix,
        select,
        track,
        debug,
        environment,
      } = ctx.body || {};
      // Merge auth session + client context for evaluation
      const evaluationContext = await buildCtx(
        ctx,
        pluginContext,
        additionalContext,
      );

      // Resolve environment with header precedence (x-deployment-ring > body)
      const resolvedEnvironment = resolveEnvironment(ctx, environment);
      if (resolvedEnvironment) {
        (evaluationContext as any).attributes = {
          ...(evaluationContext as any).attributes,
          environment: resolvedEnvironment,
        };
      }

      // SECURITY: Multi-tenant flag scoping by organization
      const organizationId = pluginContext.config.multiTenant.enabled
        ? evaluationContext.organizationId
        : undefined;

      // PERF: Only return enabled flags to reduce payload size
      const flags = await pluginContext.storage.listFlags(organizationId, {
        filter: { enabled: true },
      });

      // Optional server-side key filtering by include/prefix
      const filterByInclude = Array.isArray(include) && include.length > 0;
      const filterByPrefix = typeof prefix === "string" && prefix.length > 0;

      const results: Record<string, any> = {};
      for (const flag of flags) {
        if (filterByInclude && !include!.includes(flag.key)) continue;
        if (filterByPrefix && !flag.key.startsWith(prefix!)) continue;
        const result = await evaluateFlags(
          flag,
          evaluationContext,
          pluginContext,
          debug,
          resolvedEnvironment,
        );
        results[flag.key] = result;
      }

      // Format response based on select parameter
      if (select === "value") {
        const values: Record<string, any> = {};
        for (const [k, r] of Object.entries(results))
          values[k] = (r as any).value;
        return ctx.json({
          flags: values,
          context: evaluationContext,
          evaluatedAt: new Date(),
        });
      }

      // Array of specific fields
      if (Array.isArray(select) && select.length > 0) {
        const projected: Record<string, any> = {};
        for (const [k, r] of Object.entries(results)) {
          const pr: any = {};
          for (const field of select) pr[field] = (r as any)[field];
          projected[k] = pr;
        }
        return ctx.json({
          flags: projected,
          context: evaluationContext,
          evaluatedAt: new Date(),
        });
      }

      // Default to full result (when select is undefined or "full")
      return ctx.json({
        flags: results,
        context: evaluationContext,
        evaluatedAt: new Date(),
      });
    },
  );

  return {
    // === CANONICAL PUBLIC API ===
    bootstrapFeatureFlags: bootstrapFeatureFlagsHandler,
  } as FlagEndpoints;
}
