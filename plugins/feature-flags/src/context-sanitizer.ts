// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import type { EvaluationContext } from "./client";

/**
 * Context sanitization for security and performance.
 * Prevents PII leakage and handles size constraints.
 */

// Default allowed fields (can be extended via options)
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

// Fields that should never be sent (even if explicitly allowed)
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

// Patterns that suggest sensitive data
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
  allowedFields?: Set<string>;
  maxSizeForUrl?: number; // Default: 2KB
  maxSizeForBody?: number; // Default: 10KB
  strict?: boolean; // If true, only allowed fields pass through
  warnOnDrop?: boolean; // Log warnings when fields are dropped
}

/**
 * Sanitizes context data before sending to server.
 *
 * Security considerations:
 * - Removes potentially sensitive fields
 * - Enforces size limits for URL/body transmission
 * - Optionally restricts to whitelist of allowed fields
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
    this.strict = options.strict ?? true; // Default to strict mode
    this.warnOnDrop =
      options.warnOnDrop ?? process.env.NODE_ENV === "development";
  }

  /**
   * Sanitizes context for URL parameters (GET requests).
   * More strict size limits due to URL length constraints.
   */
  sanitizeForUrl(context: EvaluationContext): string | undefined {
    const sanitized = this.sanitize(context);
    if (Object.keys(sanitized).length === 0) {
      return undefined;
    }

    const serialized = JSON.stringify(sanitized);

    if (serialized.length > this.maxSizeForUrl) {
      // Try to reduce by keeping only most important fields
      const essential = this.extractEssentialFields(sanitized);
      const essentialSerialized = JSON.stringify(essential);

      if (essentialSerialized.length > this.maxSizeForUrl) {
        if (this.warnOnDrop) {
          console.warn(
            `[feature-flags] Context too large for URL (${serialized.length} bytes). ` +
              `Maximum allowed: ${this.maxSizeForUrl} bytes. Consider using fewer fields.`,
          );
        }
        return undefined; // Too large even after reduction
      }

      return essentialSerialized;
    }

    return serialized;
  }

  /**
   * Sanitizes context for request body (POST requests).
   * Less strict size limits than URL.
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

      // Progressively drop fields until size is acceptable
      return this.reduceToSize(sanitized, this.maxSizeForBody);
    }

    return sanitized;
  }

  /**
   * Core sanitization logic.
   */
  private sanitize(context: EvaluationContext): Record<string, any> {
    const result: Record<string, any> = {};
    const droppedFields: string[] = [];

    for (const [key, value] of Object.entries(context)) {
      // Skip if forbidden field
      if (FORBIDDEN_FIELDS.has(key)) {
        droppedFields.push(`${key} (forbidden)`);
        continue;
      }

      // Skip if field name suggests sensitive data
      if (SENSITIVE_PATTERNS.some((pattern) => pattern.test(key))) {
        droppedFields.push(`${key} (sensitive pattern)`);
        continue;
      }

      // In strict mode, only allow whitelisted fields
      if (this.strict && !this.allowedFields.has(key)) {
        droppedFields.push(`${key} (not in allowlist)`);
        continue;
      }

      // Handle different value types
      if (value === null || value === undefined) {
        // Preserve null/undefined values
        result[key] = value;
      } else if (typeof value === "object" && !Array.isArray(value)) {
        // Recursively sanitize nested objects
        const sanitizedNested = this.sanitize(value);
        if (Object.keys(sanitizedNested).length > 0) {
          result[key] = sanitizedNested;
        }
      } else if (Array.isArray(value)) {
        // Sanitize arrays (but limit length)
        result[key] = value.slice(0, 10); // Max 10 items in arrays
      } else if (typeof value === "string") {
        // Truncate long strings
        result[key] =
          value.length > 200 ? value.substring(0, 200) + "..." : value;
      } else if (typeof value !== "function" && typeof value !== "symbol") {
        // Allow other primitives (numbers, booleans)
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

  /**
   * Extracts only the most essential fields for minimal context.
   */
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

  /**
   * Progressively removes fields until size is acceptable.
   */
  private reduceToSize(
    context: Record<string, any>,
    maxSize: number,
  ): Record<string, any> {
    const entries = Object.entries(context);
    let result = { ...context };

    // Sort by assumed importance (shorter keys often more important)
    entries.sort((a, b) => a[0].length - b[0].length);

    // Remove fields from the end until size is OK
    for (let i = entries.length - 1; i >= 0; i--) {
      const serialized = JSON.stringify(result);
      if (serialized.length <= maxSize) {
        break;
      }
      delete result[entries[i][0]];
    }

    return result;
  }

  /**
   * Validates that context doesn't contain sensitive data.
   * Returns array of warnings if issues found.
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

/**
 * Default sanitizer instance for convenience.
 */
export const defaultSanitizer = new ContextSanitizer();
