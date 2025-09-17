// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import type { BetterAuthPlugin } from "better-auth";
import { buildEvaluationContext } from "../middleware/context";
import type { DateRange } from "../storage/types";
import type { PluginContext } from "../types";

/** Better Auth plugin endpoints type, avoids import cycles with endpoints/index.ts */
export type FlagEndpoints = NonNullable<BetterAuthPlugin["endpoints"]>;

/**
 * Builds evaluation context from session, request, and client attributes.
 *
 * @param ctx - Better Auth request context with session data
 * @param pluginContext - Plugin config and utilities
 * @param additionalContext - Client-provided attributes to merge
 * @returns Combined context for flag evaluation
 * @see src/middleware/context.ts
 */
export async function buildCtx(
  ctx: any,
  pluginContext: PluginContext,
  additionalContext: Record<string, any> | undefined,
) {
  const session = ctx.context?.session ?? null;
  const baseContext = await buildEvaluationContext(ctx, session, pluginContext);
  const extra = additionalContext || {};
  return {
    ...baseContext,
    attributes: {
      ...baseContext.attributes,
      ...(extra as any).attributes,
    },
    ...extra,
  };
}

/**
 * Creates standardized JSON error responses.
 *
 * @param ctx - Better Auth request context
 * @param code - Error code for client categorization
 * @param message - Human-readable error description
 * @param status - HTTP status code, defaults to 400
 * @param details - Optional additional error context
 * @returns Consistent JSON error response structure
 */
export function jsonError(
  ctx: any,
  code: string,
  message: string,
  status = 400,
  details?: unknown,
) {
  return ctx.json(
    {
      error: code,
      message,
      ...(details ? { details } : {}),
    },
    { status },
  );
}

/**
 * Resolves effective organization ID with multi-tenant access control.
 *
 * SECURITY: Users can only access their own organization's data.
 * Returns undefined when multi-tenancy disabled.
 *
 * @param ctx - Better Auth request context with session
 * @param pluginContext - Plugin config with multi-tenant settings
 * @param organizationId - Optional org ID to validate against user's org
 * @returns Success with resolved org ID or error response
 */
export function resolveEffectiveOrgId(
  ctx: any,
  pluginContext: PluginContext,
  organizationId?: string,
): { ok: true; organizationId?: string } | { ok: false; response: any } {
  if (!pluginContext.config.multiTenant.enabled) {
    return { ok: true, organizationId: undefined };
  }

  const session = ctx.context?.session;
  const userOrgId = session?.user?.organizationId;
  if (!userOrgId) {
    return {
      ok: false,
      response: jsonError(
        ctx,
        "UNAUTHORIZED_ACCESS",
        "Organization ID required for multi-tenant access",
        403,
      ),
    };
  }

  if (organizationId && organizationId !== userOrgId) {
    return {
      ok: false,
      response: jsonError(
        ctx,
        "UNAUTHORIZED_ACCESS",
        "Access denied to requested organization",
        403,
      ),
    };
  }

  return { ok: true, organizationId: userOrgId };
}

/**
 * Parses ISO date strings into Date objects for analytics queries.
 *
 * @param input - Object with optional startDate and endDate strings
 * @returns DateRange object or undefined if incomplete
 */
export function parseDateRange(input: {
  startDate?: string;
  endDate?: string;
}): DateRange | undefined {
  if (!input.startDate || !input.endDate) return undefined;
  return {
    start: new Date(input.startDate),
    end: new Date(input.endDate),
  };
}

/**
 * Validates analytics date range with business rules and safety constraints.
 *
 * SECURITY: Prevents expensive runaway analytics queries.
 * PERFORMANCE: Enforces maximum window length to protect systems.
 *
 * @param input - Object with optional startDate and endDate strings
 * @param options - Validation options with maxDays limit
 * @returns Validated DateRange or validation error details
 */
export function validateAnalyticsDateRange(
  input: {
    startDate?: string;
    endDate?: string;
  },
  options: {
    maxDays?: number;
  } = {},
):
  | { ok: true; dateRange: DateRange | undefined }
  | { ok: false; error: string; code: string } {
  const { maxDays = 90 } = options;

  // Allow undefined ranges (no filtering)
  if (!input.startDate || !input.endDate) {
    return { ok: true, dateRange: undefined };
  }

  // Parse dates with error handling
  let start: Date, end: Date;
  try {
    start = new Date(input.startDate);
    end = new Date(input.endDate);
  } catch {
    return {
      ok: false,
      error:
        "Invalid date format. Use ISO 8601 format (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss.sssZ)",
      code: "INVALID_DATE_FORMAT",
    };
  }

  // Validate date objects
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return {
      ok: false,
      error: "Invalid date values. Use valid ISO 8601 dates",
      code: "INVALID_DATE_VALUES",
    };
  }

  // Enforce start <= end
  if (start > end) {
    return {
      ok: false,
      error: "Start date must be less than or equal to end date",
      code: "INVALID_DATE_RANGE",
    };
  }

  // Enforce maximum window length
  const diffMs = end.getTime() - start.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  if (diffDays > maxDays) {
    return {
      ok: false,
      error: `Date range too large. Maximum allowed range is ${maxDays} days`,
      code: "DATE_RANGE_TOO_LARGE",
    };
  }

  return {
    ok: true,
    dateRange: { start, end },
  };
}

/**
 * Ensures current user's organization owns the specified flag.
 *
 * SECURITY: Multi-tenant resource ownership validation.
 *
 * @param ctx - Better Auth request context with session
 * @param pluginContext - Plugin config with multi-tenant settings
 * @param flagId - Flag ID to validate ownership for
 * @returns Success result or error response
 */
export async function ensureFlagOwnership(
  ctx: any,
  pluginContext: PluginContext,
  flagId: string,
): Promise<{ ok: true } | { ok: false; response: any }> {
  if (!pluginContext.config.multiTenant.enabled) return { ok: true };

  const session = ctx.context?.session;
  const userOrgId = session?.user?.organizationId;
  if (!userOrgId) {
    return {
      ok: false,
      response: jsonError(
        ctx,
        "UNAUTHORIZED_ACCESS",
        "Organization ID required for multi-tenant access",
        403,
      ),
    };
  }

  const flag = await pluginContext.storage.getFlagById(flagId);
  if (!flag || flag.organizationId !== userOrgId) {
    return {
      ok: false,
      response: jsonError(
        ctx,
        "FLAG_NOT_FOUND",
        "Flag not found in your organization",
        404,
      ),
    };
  }

  return { ok: true };
}

/**
 * Resolves environment parameter with header precedence (x-deployment-ring > body).
 *
 * PRECEDENCE: x-deployment-ring header takes priority over body.environment.
 * This enables server-to-server communication to override client environment.
 *
 * @param ctx - Better Auth request context with headers
 * @param bodyEnvironment - Environment parameter from request body
 * @returns Resolved environment value or undefined
 */
export function resolveEnvironment(
  ctx: any,
  bodyEnvironment?: string,
): string | undefined {
  // Check for x-deployment-ring header first
  const headerEnvironment = ctx.headers?.["x-deployment-ring"];
  if (typeof headerEnvironment === "string" && headerEnvironment.trim()) {
    return headerEnvironment.trim();
  }

  // Fall back to body environment parameter
  return bodyEnvironment;
}
