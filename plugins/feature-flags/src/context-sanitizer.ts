// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import type { EvaluationContext } from "./client";

// Context sanitization: prevents PII leakage, enforces size limits (REF: GDPR/CCPA compliance)

// Safe-by-default allowlist - balances functionality with privacy
const DEFAULT_ALLOWED_FIELDS = new Set([
  // User attributes
  "userId",
  "organizationId",
  "teamId",
  "role",
  "plan",
  "subscription",

  // Device/environment
  "device",
  "browser",
  "os",
  "platform",
  "version",
  "locale",
  "timezone",

  // Application state
  "page",
  "route",
  "feature",
  "experiment",

  // Safe business attributes
  "country",
  "region",
  "environment",
  "buildVersion",
]);

// Hard-blocked PII fields - cannot be overridden for security
const FORBIDDEN_FIELDS = new Set([
  "password",
  "token",
  "apiKey",
  "secret",
  "creditCard",
  "ssn",
  "socialSecurityNumber",
  "driverLicense",
  "passport",
  "bankAccount",
  "privateKey",
  "sessionToken",
  "refreshToken",
  "accessToken",
  "authToken",
]);

// Regex patterns for dynamic PII detection
const SENSITIVE_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /key/i,
  /credit/i,
  /ssn/i,
  /bank/i,
  /private/i,
  /auth/i,
];

export interface SanitizationOptions {
  /** Custom allowlist of field names (extends defaults) */
  allowedFields?: Set<string>;
  /** Max serialized size for URL params - default: 2KB */
  maxSizeForUrl?: number;
  /** Max serialized size for POST body - default: 10KB */
  maxSizeForBody?: number;
  /** If true, only allowlisted fields pass through - default: true */
  strict?: boolean;
  /** Log warnings when fields are dropped - default: development mode */
  warnOnDrop?: boolean;
}

/**
 * Context sanitizer with PII protection and size enforcement.
 * Prevents credential leakage while maintaining feature flag functionality.
 */
export class ContextSanitizer {
  private allowedFields: Set<string>;
  private maxSizeForUrl: number;
  private maxSizeForBody: number;
  private strict: boolean;
  private warnOnDrop: boolean;

  constructor(options: SanitizationOptions = {}) {
    this.allowedFields = options.allowedFields || DEFAULT_ALLOWED_FIELDS;
    this.maxSizeForUrl = options.maxSizeForUrl || 2048; // 2KB for URL params
    this.maxSizeForBody = options.maxSizeForBody || 10240; // 10KB for POST body
    this.strict = options.strict ?? true; // Default strict mode
    this.warnOnDrop =
      options.warnOnDrop ?? process.env.NODE_ENV === "development";
  }

  /**
   * Sanitizes context for URL params with strict size limits.
   * @returns JSON string under 2KB or undefined if too large
   */
  sanitizeForUrl(context: EvaluationContext): string | undefined {
    const sanitized = this.sanitize(context);
    if (Object.keys(sanitized).length === 0) {
      return undefined;
    }

    const serialized = JSON.stringify(sanitized);

    if (serialized.length > this.maxSizeForUrl) {
      // Fallback: strip to essential fields only (userId, orgId, etc.)
      const essential = this.extractEssentialFields(sanitized);
      const essentialSerialized = JSON.stringify(essential);

      if (essentialSerialized.length > this.maxSizeForUrl) {
        if (this.warnOnDrop) {
          console.warn(
            `[feature-flags] Context too large for URL (${serialized.length} bytes). ` +
              `Maximum allowed: ${this.maxSizeForUrl} bytes. Consider using fewer fields.`,
          );
        }
        return undefined; // Even essentials exceed URL limit
      }

      return essentialSerialized;
    }

    return serialized;
  }

  /**
   * Sanitizes context for POST body with larger size allowance.
   * @returns Sanitized object under 10KB or progressively reduced object
   */
  sanitizeForBody(context: EvaluationContext): object | undefined {
    const sanitized = this.sanitize(context);
    if (Object.keys(sanitized).length === 0) {
      return undefined;
    }

    const serialized = JSON.stringify(sanitized);

    if (serialized.length > this.maxSizeForBody) {
      if (this.warnOnDrop) {
        console.warn(
          `[feature-flags] Context too large for request (${serialized.length} bytes). ` +
            `Maximum allowed: ${this.maxSizeForBody} bytes. Some fields will be dropped.`,
        );
      }

      // Progressive field removal by priority (shorter keys kept first)
      return this.reduceToSize(sanitized, this.maxSizeForBody);
    }

    return sanitized;
  }

  // Core sanitization: PII filtering + type normalization
  private sanitize(context: EvaluationContext): Record<string, any> {
    const result: Record<string, any> = {};
    const droppedFields: string[] = [];

    for (const [key, value] of Object.entries(context)) {
      // Skip forbidden fields
      if (FORBIDDEN_FIELDS.has(key)) {
        droppedFields.push(`${key} (forbidden)`);
        continue;
      }

      // Skip sensitive field patterns
      if (SENSITIVE_PATTERNS.some((pattern) => pattern.test(key))) {
        droppedFields.push(`${key} (sensitive pattern)`);
        continue;
      }

      // Strict mode: only allowlisted fields
      if (this.strict && !this.allowedFields.has(key)) {
        droppedFields.push(`${key} (not in allowlist)`);
        continue;
      }

      // Handle different value types
      if (value === null || value === undefined) {
        // Preserve null/undefined
        result[key] = value;
      } else if (typeof value === "object" && !Array.isArray(value)) {
        // Recursive nested sanitization
        const sanitizedNested = this.sanitize(value);
        if (Object.keys(sanitizedNested).length > 0) {
          result[key] = sanitizedNested;
        }
      } else if (Array.isArray(value)) {
        // Limit array length to prevent payload bloat
        result[key] = value.slice(0, 10);
      } else if (typeof value === "string") {
        // Truncate long strings
        result[key] =
          value.length > 200 ? value.substring(0, 200) + "..." : value;
      } else if (typeof value !== "function" && typeof value !== "symbol") {
        // Allow other primitives
        result[key] = value;
      }
    }

    if (this.warnOnDrop && droppedFields.length > 0) {
      console.warn(
        `[feature-flags] Dropped context fields for security: ${droppedFields.join(", ")}`,
      );
    }

    return result;
  }

  // Extracts essential fields for minimal context
  private extractEssentialFields(
    context: Record<string, any>,
  ): Record<string, any> {
    const essentialKeys = [
      "userId",
      "organizationId",
      "role",
      "plan",
      "device",
      "environment",
    ];
    const result: Record<string, any> = {};

    for (const key of essentialKeys) {
      if (key in context) {
        result[key] = context[key];
      }
    }

    return result;
  }

  // Progressively removes fields until size acceptable
  private reduceToSize(
    context: Record<string, any>,
    maxSize: number,
  ): Record<string, any> {
    const entries = Object.entries(context);
    let result = { ...context };

    // Sort by importance (shorter keys often more important)
    entries.sort((a, b) => a[0].length - b[0].length);

    // Remove from end until size OK
    for (let i = entries.length - 1; i >= 0; i--) {
      const serialized = JSON.stringify(result);
      if (serialized.length <= maxSize) {
        break;
      }
      const tuple = entries[i];
      if (!tuple) continue;
      const key = tuple[0];
      delete result[key];
    }

    return result;
  }

  /**
   * Pre-flight validation to detect potential PII before sanitization.
   * @returns Array of warning messages for sensitive fields
   */
  static validate(context: EvaluationContext): string[] {
    const warnings: string[] = [];

    const checkObject = (obj: any, path = ""): void => {
      for (const [key, value] of Object.entries(obj)) {
        const fullPath = path ? `${path}.${key}` : key;

        if (FORBIDDEN_FIELDS.has(key)) {
          warnings.push(
            `Forbidden field "${fullPath}" detected - will be removed`,
          );
        }

        if (SENSITIVE_PATTERNS.some((pattern) => pattern.test(key))) {
          warnings.push(
            `Potentially sensitive field "${fullPath}" detected - will be removed`,
          );
        }

        if (value && typeof value === "object") {
          checkObject(value, fullPath);
        }
      }
    };

    checkObject(context);
    return warnings;
  }
}

// Pre-configured instance with production-safe defaults
export const defaultSanitizer = new ContextSanitizer();
