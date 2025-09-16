// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import type { BetterAuthPlugin } from "better-auth";
import type { PluginContext } from "../../types";
import { createAdminAnalyticsEndpoints } from "./analytics";
import { createAdminAuditEndpoints } from "./audit";
import { createAdminEnvironmentsEndpoints } from "./environments";
import { createAdminFlagsEndpoints } from "./flags";
import { createAdminOverridesEndpoints } from "./overrides";
import { createAdminRulesEndpoints } from "./rules";

/**
 * Better Auth admin endpoint handlers for feature flags.
 * Composes all admin endpoint groups by REST resource type.
 *
 * ADMIN MODULES (by resource):
 * - flags.ts: Flag CRUD operations
 * - rules.ts: Rule management for flags
 * - overrides.ts: User override management
 * - analytics.ts: Stats and metrics
 * - audit.ts: Audit log access
 * - environments.ts: Environment management + data export
 *
 * SECURITY: All admin modules implement consistent multi-tenant model:
 * - Organization-scoped access via resolveEffectiveOrgId()
 * - Resource ownership validation via ensureFlagOwnership()
 * - Consistent error handling and response formats
 *
 * @see plugins/feature-flags/src/endpoints/shared.ts
 */
export type FlagEndpoints = NonNullable<BetterAuthPlugin["endpoints"]>;

export function createAdminEndpoints(
  pluginContext: PluginContext,
): FlagEndpoints {
  // Create all admin endpoint groups
  const flagsEndpoints = createAdminFlagsEndpoints(pluginContext);
  const rulesEndpoints = createAdminRulesEndpoints(pluginContext);
  const overridesEndpoints = createAdminOverridesEndpoints(pluginContext);
  const analyticsEndpoints = createAdminAnalyticsEndpoints(pluginContext);
  const auditEndpoints = createAdminAuditEndpoints(pluginContext);
  const environmentsEndpoints = createAdminEnvironmentsEndpoints(pluginContext);

  // Compose all admin endpoints into a single object
  return {
    // Flags CRUD + enable/disable (from flags.ts)
    ...flagsEndpoints,

    // Rules CRUD + reorder (from rules.ts)
    ...rulesEndpoints,

    // Overrides CRUD (from overrides.ts)
    ...overridesEndpoints,

    // Analytics (from analytics.ts)
    ...analyticsEndpoints,

    // Audit (from audit.ts)
    ...auditEndpoints,

    // Environments + Data Export (from environments.ts)
    ...environmentsEndpoints,
  } as unknown as FlagEndpoints;
}
