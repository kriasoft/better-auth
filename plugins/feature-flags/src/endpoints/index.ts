// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import type { BetterAuthPlugin } from "better-auth";
import type { PluginContext } from "../types";
import { createAdminEndpoints } from "./admin";
import { createPublicEndpoints } from "./public";

/**
 * Better Auth endpoint handlers for feature flags.
 * Composes public and admin endpoint groups from modular architecture.
 *
 * PUBLIC ENDPOINTS (by concern):
 * - evaluate.ts: Single flag evaluation
 * - evaluate-batch.ts: Batch flag evaluation
 * - bootstrap.ts: Bulk flag initialization
 * - events.ts: Analytics event tracking
 * - config.ts: Public configuration
 * - health.ts: Service health checks
 *
 * ADMIN ENDPOINTS (by resource):
 * - flags.ts: Flag CRUD operations
 * - rules.ts: Rule management
 * - overrides.ts: Override management
 * - analytics.ts: Stats and metrics
 * - audit.ts: Audit log access
 * - environments.ts: Environment management + data export
 *
 * Benefits: Single responsibility per module (200-300 lines), better tree-shaking,
 * easier testing, clear separation of concerns, independent development.
 *
 * @see plugins/feature-flags/src/endpoints/public/
 * @see plugins/feature-flags/src/endpoints/admin/
 */
export type FlagEndpoints = NonNullable<BetterAuthPlugin["endpoints"]>;

export function createFlagEndpoints(
  pluginContext: PluginContext,
): FlagEndpoints {
  const publicEndpoints = createPublicEndpoints(pluginContext);
  const adminEndpoints = createAdminEndpoints(pluginContext);

  return {
    ...publicEndpoints,
    ...adminEndpoints,
  } as unknown as FlagEndpoints;
}
