// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import type { BetterAuthPlugin } from "better-auth";
import type { PluginContext } from "../../types";
import { createPublicBootstrapEndpoints } from "./bootstrap";
import { createPublicConfigEndpoints } from "./config";
import { createPublicEvaluateEndpoints } from "./evaluate";
import { createPublicEvaluateBatchEndpoints } from "./evaluate-batch";
import { createPublicEventsEndpoints } from "./events";
import { createPublicHealthEndpoints } from "./health";

/**
 * Better Auth public endpoint handlers for feature flags.
 * Composes all public endpoint groups by functional concern.
 *
 * PUBLIC MODULES (by concern):
 * - evaluate.ts: Single flag evaluation
 * - evaluate-batch.ts: Batch flag evaluation
 * - bootstrap.ts: Bulk flag initialization
 * - events.ts: Analytics event tracking
 * - config.ts: Public configuration
 * - health.ts: Service health checks
 *
 * Organized by use case for independent optimization (caching, rate limiting).
 *
 * PERFORMANCE: All modules prioritize performance and reliability:
 * - Graceful degradation on errors
 * - Efficient batch operations
 * - Non-blocking analytics
 * - Lightweight health checks
 *
 * @see plugins/feature-flags/src/endpoints/shared.ts
 * @see plugins/feature-flags/src/evaluation.ts
 */
export type FlagEndpoints = NonNullable<BetterAuthPlugin["endpoints"]>;

export function createPublicEndpoints(
  pluginContext: PluginContext,
): FlagEndpoints {
  // Create all public endpoint groups
  const evaluateEndpoints = createPublicEvaluateEndpoints(pluginContext);
  const evaluateBatchEndpoints =
    createPublicEvaluateBatchEndpoints(pluginContext);
  const bootstrapEndpoints = createPublicBootstrapEndpoints(pluginContext);
  const eventsEndpoints = createPublicEventsEndpoints(pluginContext);
  const configEndpoints = createPublicConfigEndpoints(pluginContext);
  const healthEndpoints = createPublicHealthEndpoints(pluginContext);

  // Compose all public endpoints into a single object
  return {
    // === CANONICAL PUBLIC API (per API spec) ===

    // Single flag evaluation (from evaluate.ts)
    ...evaluateEndpoints,

    // Batch flag evaluation (from evaluate-batch.ts)
    ...evaluateBatchEndpoints,

    // Bulk flag initialization (from bootstrap.ts)
    ...bootstrapEndpoints,

    // Analytics event tracking (from events.ts)
    ...eventsEndpoints,

    // === CORE ENDPOINTS ===

    // Public configuration (from config.ts)
    ...configEndpoints,

    // Service health checks (from health.ts)
    ...healthEndpoints,
  } as unknown as FlagEndpoints;
}
