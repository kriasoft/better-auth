// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import type { BetterAuthPlugin } from "better-auth";
import { createAuthEndpoint } from "better-auth/api";
import { z } from "zod";
import { evaluateFlags } from "../../evaluation";
import {
  environmentParamSchema,
  evaluationContextSchema,
  selectSchema,
} from "../../schema/validation";
import type { PluginContext } from "../../types";
import { buildCtx, jsonError, resolveEnvironment } from "../shared";

/** Better Auth plugin endpoints type, avoids import cycles with endpoints/index.ts */
export type FlagEndpoints = NonNullable<BetterAuthPlugin["endpoints"]>;

/**
 * Creates public endpoint for single feature flag evaluation.
 *
 * ENDPOINT: POST /feature-flags/evaluate - Canonical single flag evaluation
 *
 * PERFORMANCE: Optimized for the most common use case with simplicity.
 *
 * RESILIENCE: Graceful degradation ensures app functionality:
 * - Returns default value if flag not found
 * - Falls back to client defaults on evaluation errors
 * - Non-blocking analytics (failures don't affect evaluation)
 *
 * @param pluginContext - Plugin context with DB, config, and utilities
 * @returns Single flag evaluation endpoint
 * @see plugins/feature-flags/src/endpoints/shared.ts
 * @see plugins/feature-flags/src/evaluation.ts
 */
export function createPublicEvaluateEndpoints(
  pluginContext: PluginContext,
): FlagEndpoints {
  // POST /feature-flags/evaluate (canonical)
  const evaluateFeatureFlagHandler = createAuthEndpoint(
    "/feature-flags/evaluate",
    {
      method: "POST",
      body: z.object({
        flagKey: z.string().describe("The feature flag key to evaluate"),
        context: z
          .record(z.string(), z.any())
          .optional()
          .describe("Additional evaluation context"),
        default: z.any().optional().describe("Default value if flag not found"),
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
          .describe("Whether to track this evaluation"),
        debug: z
          .boolean()
          .optional()
          .describe("Include debug information in response"),
        contextInResponse: z
          .boolean()
          .optional()
          .describe(
            "Include resolved context in response for consistency with batch endpoint",
          ),
      }),
      metadata: {
        openapi: {
          operationId: "auth.api.evaluateFeatureFlag",
          summary: "Evaluate Feature Flag",
          description:
            "Evaluates a feature flag value for the current user and context. This is the canonical method for single flag evaluation.",
          responses: {
            "200": {
              description: "Flag evaluation result",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      value: { description: "The evaluated flag value" },
                      variant: {
                        type: "object",
                        description: "Variant information if applicable",
                      },
                      reason: {
                        type: "string",
                        enum: [
                          "default",
                          "rule_match",
                          "override",
                          "percentage_rollout",
                          "not_found",
                          "disabled",
                        ],
                        description: "Reason for the evaluation result",
                      },
                      context: {
                        type: "object",
                        description:
                          "Evaluation context used (if contextInResponse is true)",
                      },
                      evaluatedAt: {
                        type: "string",
                        format: "date-time",
                        description: "Timestamp when evaluation was performed",
                      },
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
        const inputSchema = z.object({
          flagKey: z.string().min(1, "Flag key is required"),
          context: evaluationContextSchema.optional().default({}),
          default: z.any().optional(),
          select: selectSchema.optional(),
          track: z.boolean().optional().default(true),
          debug: z.boolean().optional(),
          environment: z.string().optional(),
          contextInResponse: z.boolean().optional(),
        });
        const parseResult = inputSchema.safeParse(ctx.body);
        if (!parseResult.success) {
          return jsonError(
            ctx,
            "INVALID_INPUT",
            "Invalid evaluation request",
            400,
            parseResult.error.issues,
          );
        }

        const {
          flagKey,
          context: additionalContext,
          default: defaultValue,
          select,
          debug,
          track,
          environment,
          contextInResponse,
        } = parseResult.data as unknown as {
          flagKey: string;
          context: any;
          default?: any;
          select?:
            | "value"
            | "full"
            | Array<"value" | "variant" | "reason" | "metadata">;
          debug?: boolean;
          track?: boolean;
          environment?: string;
          contextInResponse?: boolean;
        };

        // Merge auth session + client context for evaluation
        const evaluationContext = await buildCtx(
          ctx,
          pluginContext,
          additionalContext,
        );

        // Resolve environment with header precedence (x-deployment-ring > body)
        const resolvedEnvironment = resolveEnvironment(ctx, environment);

        // Enrich environment into attributes for targeting/rules
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
        const flagModel = await pluginContext.storage.getFlag(
          flagKey,
          organizationId,
        );

        if (!flagModel) {
          const response: any = {
            value: defaultValue ?? undefined,
            reason: "not_found",
            evaluatedAt: new Date(),
          };
          if (contextInResponse) {
            response.context = evaluationContext;
          }
          return ctx.json(response);
        }

        const result = await evaluateFlags(
          flagModel,
          evaluationContext,
          pluginContext,
          debug,
          resolvedEnvironment,
        );

        // PERF: Non-blocking analytics - track usage without affecting evaluation
        if (pluginContext.config.analytics.trackUsage && track !== false) {
          await pluginContext.storage
            .trackEvaluation({
              flagKey: flagKey,
              userId: evaluationContext.userId || "anonymous",
              context: evaluationContext,
              timestamp: new Date(),
              value: result.value,
              variant: result.variant,
              reason: result.reason,
            })
            .catch((err) => {
              console.error(
                `[feature-flags] Failed to track evaluation: ${err.message}`,
              );
            });
        }

        // Add evaluatedAt and optional context to result
        const enhancedResult = {
          ...result,
          evaluatedAt: new Date(),
        };

        if (contextInResponse) {
          (enhancedResult as any).context = evaluationContext;
        }

        // Format response based on select parameter
        if (select === "value") {
          const response: any = {
            value: enhancedResult.value,
            evaluatedAt: enhancedResult.evaluatedAt,
          };
          if (contextInResponse) {
            response.context = evaluationContext;
          }
          return ctx.json(response);
        }
        // Array of specific fields
        if (Array.isArray(select) && select.length > 0) {
          const projected: any = { evaluatedAt: enhancedResult.evaluatedAt };
          for (const field of select) {
            projected[field] = (enhancedResult as any)[field];
          }
          if (contextInResponse) {
            projected.context = evaluationContext;
          }
          return ctx.json(projected);
        }
        // Default to full result (when select is undefined or "full")
        return ctx.json(enhancedResult);
      } catch (error) {
        // RESILIENCE: Graceful degradation - return default on failure
        console.error("[feature-flags] Error evaluating flag:", error);
        const { default: defaultValue } = ctx.body || {};
        const resolvedDefault = defaultValue;
        return jsonError(
          ctx,
          "EVALUATION_ERROR",
          "Failed to evaluate flag",
          500,
          { value: resolvedDefault ?? undefined, reason: "not_found" },
        );
      }
    },
  );

  return {
    // === CANONICAL PUBLIC API ===
    evaluateFeatureFlag: evaluateFeatureFlagHandler,
  } as FlagEndpoints;
}
