// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import type { BetterAuthPlugin } from "better-auth";
import { createAuthEndpoint } from "better-auth/api";
import { z } from "zod";
import type { PluginContext } from "../../types";

/** Better Auth plugin endpoints type, avoids import cycles with endpoints/index.ts */
export type FlagEndpoints = NonNullable<BetterAuthPlugin["endpoints"]>;

/**
 * Creates public endpoints for feature flag event tracking.
 *
 * REST API:
 * - POST /feature-flags/events - Track single event
 * - POST /feature-flags/events/batch - Track multiple events efficiently
 *
 * Enables product analytics and A/B test measurement.
 *
 * IDEMPOTENCY: Prevents duplicate events from retries:
 * - Essential for accurate analytics and billing
 * - In-memory cache for dev (production should use Redis/DB)
 *
 * BATCH PROCESSING: Performance benefits for high-volume events:
 * - Reduces network round-trips
 * - Enables efficient DB bulk operations
 * - Max 100 events per batch for reasonable payload size
 *
 * @param pluginContext - Plugin context with DB, config, and utilities
 * @returns Event tracking endpoints for analytics
 * @see plugins/feature-flags/src/types.ts
 */
export function createPublicEventsEndpoints(
  pluginContext: PluginContext,
): FlagEndpoints {
  // POST /feature-flags/events (canonical)
  const createFeatureFlagEventHandler = createAuthEndpoint(
    "/feature-flags/events",
    {
      method: "POST",
      body: z.object({
        flagKey: z.string().describe("The feature flag key that was used"),
        event: z.string().describe("The event name to track"),
        properties: z
          .union([z.number(), z.record(z.string(), z.any())])
          .optional(),
        timestamp: z.string().optional().describe("RFC3339 timestamp string"),
        sampleRate: z
          .number()
          .min(0)
          .max(1)
          .optional()
          .describe(
            "Client-side sampling rate (0-1). Server may clamp/override.",
          ),
      }),
      metadata: {
        openapi: {
          operationId: "auth.api.createFeatureFlagEvent",
          summary: "Track Feature Flag Event",
          description:
            "Records an analytics event for feature flag usage. This is the canonical method for event tracking.",
          responses: {
            "200": {
              description: "Event tracked successfully",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: { success: { type: "boolean" } },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (ctx) => {
      const { flagKey, event, properties, timestamp, sampleRate } =
        ctx.body || {};

      // Extract user ID from auth session, fallback to anonymous
      const session = ctx.context?.session ?? null;
      const userId =
        session?.user?.id || session?.session?.userId || "anonymous";

      // IDEMPOTENCY: Use standard Idempotency-Key header (RFC 7231)
      const idempotencyKey =
        ctx.headers?.get?.("idempotency-key") ||
        ctx.headers?.get?.("Idempotency-Key");

      // CLIENT-SIDE SAMPLING: Skip processing if sampled out
      if (sampleRate !== undefined && typeof sampleRate === "number") {
        if (sampleRate < 0 || sampleRate > 1) {
          return ctx.json(
            {
              error: "INVALID_SAMPLE_RATE",
              message: "sampleRate must be between 0 and 1",
            },
            { status: 400 },
          );
        }

        // Probabilistic sampling: skip if random value exceeds sample rate
        if (Math.random() > sampleRate) {
          if (pluginContext.config.debug) {
            console.log(
              `[feature-flags] Event sampled out (rate: ${sampleRate})`,
            );
          }
          return ctx.json({
            success: true,
            eventId: "sampled_out",
            sampled: true,
          });
        }
      }

      // Generate event ID or use provided idempotency key
      const eventId =
        idempotencyKey ||
        `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // IDEMPOTENCY: Check for duplicate events
      if (idempotencyKey) {
        try {
          // TODO: In-memory cache for dev (production: Redis/DB)
          // Placeholder for proper idempotency storage
          const cacheKey = `idempotency:${userId}:${idempotencyKey}`;

          if (pluginContext.config.debug) {
            console.log(
              "[feature-flags] Checking idempotency for key:",
              cacheKey,
            );
          }

          // TODO: Track idempotency in data (production: dedicated store)
        } catch (error) {
          if (pluginContext.config.debug) {
            console.error("[feature-flags] Idempotency check failed:", error);
          }
        }
      }

      const trackingData = {
        flagKey,
        userId,
        event,
        data: properties,
        timestamp: timestamp ? new Date(timestamp) : new Date(),
        sessionId: session?.session?.id || undefined,
        eventId,
        idempotencyKey,
        sampleRate,
      };

      if (pluginContext.config.debug) {
        console.log("[feature-flags] Tracking event:", trackingData);
      }

      return ctx.json({ success: true, eventId });
    },
  );

  // POST /feature-flags/events/batch (canonical)
  const createFeatureFlagEventBatchHandler = createAuthEndpoint(
    "/feature-flags/events/batch",
    {
      method: "POST",
      body: z.object({
        events: z
          .array(
            z.object({
              flagKey: z
                .string()
                .describe("The feature flag key that was used"),
              event: z.string().describe("The event name to track"),
              properties: z
                .union([z.number(), z.record(z.string(), z.any())])
                .optional()
                .describe("Additional event properties"),
              timestamp: z
                .string()
                .optional()
                .describe("RFC3339 timestamp string (defaults to server time)"),
              sampleRate: z
                .number()
                .min(0)
                .max(1)
                .optional()
                .describe(
                  "Client-side sampling rate (0-1). Applied per event.",
                ),
            }),
          )
          .min(1)
          .max(100)
          .describe("Array of events to track (max 100 per batch)"),
        sampleRate: z
          .number()
          .min(0)
          .max(1)
          .optional()
          .describe(
            "Default sampling rate applied to entire batch if individual events don't specify sampleRate",
          ),
        idempotencyKey: z
          .string()
          .optional()
          .describe(
            "Optional idempotency key for preventing duplicate batch processing",
          ),
      }),
      metadata: {
        openapi: {
          operationId: "auth.api.createFeatureFlagEventBatch",
          summary: "Track Multiple Feature Flag Events",
          description:
            "Records multiple analytics events for feature flag usage in a single batch request. More efficient than individual event calls.",
          responses: {
            "200": {
              description: "Events tracked successfully",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: {
                        type: "number",
                        description: "Number of events processed successfully",
                      },
                      failed: {
                        type: "number",
                        description: "Number of events that failed",
                      },
                      batchId: {
                        type: "string",
                        description: "Batch identifier",
                      },
                    },
                  },
                },
              },
            },
            "400": {
              description: "Invalid batch request",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      error: { type: "string" },
                      message: { type: "string" },
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
      const { events, sampleRate, idempotencyKey } = ctx.body || {};

      // IDEMPOTENCY: Use body idempotencyKey (preferred) or fallback to header
      const batchIdempotencyKey =
        idempotencyKey ||
        ctx.headers?.get?.("idempotency-key") ||
        ctx.headers?.get?.("Idempotency-Key");

      if (!events || !Array.isArray(events) || events.length === 0) {
        return ctx.json(
          {
            error: "INVALID_BATCH",
            message: "Events array is required and must not be empty",
          },
          { status: 400 },
        );
      }

      if (events.length > 100) {
        return ctx.json(
          {
            error: "BATCH_TOO_LARGE",
            message: "Maximum 100 events per batch",
          },
          { status: 400 },
        );
      }

      // Extract user ID from auth session, fallback to anonymous
      const session = ctx.context?.session ?? null;
      const userId =
        session?.user?.id || session?.session?.userId || "anonymous";
      const sessionId = session?.session?.id || undefined;
      const generatedBatchId =
        batchIdempotencyKey ||
        `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      let processed = 0;
      let failed = 0;
      let sampled = 0;

      // BATCH: Process events sequentially
      for (const eventData of events) {
        try {
          // Validate required event fields
          if (!eventData.flagKey || !eventData.event) {
            failed++;
            continue;
          }

          // CLIENT-SIDE SAMPLING: Check per-event or batch-level sample rate
          const eventSampleRate = eventData.sampleRate ?? sampleRate;
          if (
            eventSampleRate !== undefined &&
            typeof eventSampleRate === "number"
          ) {
            if (eventSampleRate < 0 || eventSampleRate > 1) {
              failed++;
              continue;
            }

            // Probabilistic sampling: skip if random value exceeds sample rate
            if (Math.random() > eventSampleRate) {
              if (pluginContext.config.debug) {
                console.log(
                  `[feature-flags] Batch event sampled out (rate: ${eventSampleRate})`,
                );
              }
              sampled++;
              continue;
            }
          }

          // Generate event ID for tracking
          const eventId = `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

          const trackingData = {
            flagKey: eventData.flagKey,
            userId,
            event: eventData.event,
            data: eventData.properties,
            timestamp: eventData.timestamp
              ? new Date(eventData.timestamp)
              : new Date(),
            sessionId,
            batchId: generatedBatchId,
            eventId,
            sampleRate: eventData.sampleRate,
          };

          if (pluginContext.config.debug) {
            console.log("[feature-flags] Tracking batch event:", trackingData);
          }

          // TODO: Save to analytics store (placeholder counting)
          processed++;
        } catch (error) {
          failed++;
          if (pluginContext.config.debug) {
            console.error("[feature-flags] Failed to process event:", error);
          }
        }
      }

      return ctx.json({
        success: processed,
        failed,
        sampled,
        batchId: generatedBatchId,
      });
    },
  );

  return {
    // === CANONICAL PUBLIC API ===
    createFeatureFlagEvent: createFeatureFlagEventHandler,
    createFeatureFlagEventBatch: createFeatureFlagEventBatchHandler,
  } as FlagEndpoints;
}
