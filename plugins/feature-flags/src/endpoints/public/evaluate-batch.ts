// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import type { BetterAuthPlugin } from "better-auth";
import { createAuthEndpoint } from "better-auth/api";
import { z } from "zod";
import { evaluateFlagsBatch } from "../../evaluation";
import { environmentParamSchema, selectSchema } from "../../schema/validation";
import type { PluginContext } from "../../types";
import { buildCtx, jsonError, resolveEnvironment } from "../shared";

/** Better Auth plugin endpoints type, avoids import cycles with endpoints/index.ts */
export type FlagEndpoints = NonNullable<BetterAuthPlugin["endpoints"]>;

/**
 * Creates public endpoint for batch feature flag evaluation.
 *
 * ENDPOINT: POST /feature-flags/evaluate-batch - Bulk flag evaluation
 *
 * PERFORMANCE: Optimizes multiple flag evaluation:
 * - Reduces network round-trips
 * - Enables database query optimization
 * - Efficient bulk processing
 *
 * CLIENT DEFAULTS: Graceful handling of missing flags:
 * - Server evaluates all requested flags
 * - Client defaults applied for flags not found
 * - Handles flag deletions or config errors
 *
 * @param pluginContext - Plugin context with DB, config, and utilities
 * @returns Batch flag evaluation endpoint
 * @see plugins/feature-flags/src/endpoints/shared.ts
 * @see plugins/feature-flags/src/evaluation.ts
 */
export function createPublicEvaluateBatchEndpoints(
  pluginContext: PluginContext,
): FlagEndpoints {
  // POST /feature-flags/evaluate-batch (canonical)
  const evaluateFeatureFlagsHandler = createAuthEndpoint(
    "/feature-flags/evaluate-batch",
    {
      method: "POST",
      body: z.object({
        flagKeys: z
          .array(z.string())
          .min(1)
          .describe("Array of feature flag keys to evaluate"),
        defaults: z
          .record(z.string(), z.any())
          .optional()
          .describe("Default values for flags by key"),
        context: z
          .record(z.string(), z.any())
          .optional()
          .describe("Additional evaluation context"),
        select: selectSchema
          .optional()
          .describe(
            "Response format: 'value', 'full', or array of specific fields",
          ),
        environment: environmentParamSchema.optional(),
        track: z
          .boolean()
          .optional()
          .default(true)
          .describe("Whether to track these evaluations"),
        debug: z
          .boolean()
          .optional()
          .describe("Include debug information in response"),
        contextInResponse: z
          .boolean()
          .optional()
          .default(true)
          .describe(
            "Include resolved context in response for consistency with single endpoint",
          ),
      }),
      metadata: {
        openapi: {
          operationId: "auth.api.evaluateFeatureFlags",
          summary: "Evaluate Multiple Feature Flags",
          description:
            "Evaluates multiple feature flag values in a single batch request. This is the canonical method for batch flag evaluation.",
          responses: {
            "200": {
              description: "Batch evaluation results",
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
      try {
        const normSchema = z.object({
          flagKeys: z.array(z.string()),
          defaults: z.record(z.string(), z.any()).optional(),
          context: z.record(z.string(), z.any()).optional(),
          select: selectSchema.optional(),
          track: z.boolean().optional().default(true),
          debug: z.boolean().optional(),
          environment: z.string().optional(),
          contextInResponse: z.boolean().optional().default(true),
        });

        const parsed = normSchema.safeParse(ctx.body || {});
        if (!parsed.success) {
          return jsonError(
            ctx,
            "INVALID_INPUT",
            "Invalid batch request",
            400,
            parsed.error.issues,
          );
        }
        const {
          flagKeys,
          defaults = {},
          context: additionalContext = {},
          select,
          debug,
          track,
          environment,
          contextInResponse = true,
        } = parsed.data as unknown as {
          flagKeys: string[];
          defaults: Record<string, any>;
          context: Record<string, any>;
          select?:
            | "value"
            | "full"
            | Array<"value" | "variant" | "reason" | "metadata">;
          debug?: boolean;
          track?: boolean;
          environment?: string;
          contextInResponse?: boolean;
        };

        for (const key of flagKeys) {
          if (!key || typeof key !== "string") {
            return jsonError(
              ctx,
              "INVALID_KEY",
              "All keys must be non-empty strings",
              400,
            );
          }
        }

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

        const results = await evaluateFlagsBatch(
          flagKeys,
          evaluationContext,
          pluginContext,
          debug,
          resolvedEnvironment,
        );

        // CLIENT DEFAULTS: Apply provided defaults for missing flags
        for (const key of flagKeys) {
          if (
            results[key]?.reason === "not_found" &&
            key in (defaults as any)
          ) {
            results[key] = {
              value: (defaults as any)[key],
              reason: "default",
            } as any;
          }
        }

        // Format response based on select parameter
        const baseResponse: any = { evaluatedAt: new Date() };
        if (contextInResponse) {
          baseResponse.context = evaluationContext;
        }

        if (select === "value") {
          const values: Record<string, any> = {};
          for (const [k, r] of Object.entries(results))
            values[k] = (r as any).value;
          return ctx.json({ flags: values, ...baseResponse });
        }

        // Array of specific fields
        if (Array.isArray(select) && select.length > 0) {
          const projected: Record<string, any> = {};
          for (const [k, r] of Object.entries(results)) {
            const pr: any = {};
            for (const field of select) pr[field] = (r as any)[field];
            projected[k] = pr;
          }
          return ctx.json({ flags: projected, ...baseResponse });
        }

        // Default to full result (when select is undefined or "full")
        return ctx.json({ flags: results, ...baseResponse });
      } catch (error) {
        console.error("[feature-flags] Error evaluating batch flags:", error);
        return jsonError(
          ctx,
          "EVALUATION_ERROR",
          error instanceof Error ? error.message : "Failed to evaluate flags",
          500,
        );
      }
    },
  );

  return {
    // === CANONICAL PUBLIC API ===
    evaluateFeatureFlags: evaluateFeatureFlagsHandler,
  } as FlagEndpoints;
}
