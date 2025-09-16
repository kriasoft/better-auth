// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

/**
 * Security validation for feature flag context data.
 * Prevents prototype pollution, XSS, and injection attacks.
 * @see plugins/feature-flags/src/middleware/types.ts
 */

/** Header validation config with type checking and sanitization rules. */
export interface HeaderConfig {
  name: string;
  type: "string" | "number" | "boolean" | "json" | "enum";
  maxLength?: number;
  enumValues?: string[];
  pattern?: RegExp;
  required?: boolean;
  sanitize?: (value: string) => string;
}

/** Context validation limits to prevent DoS and memory exhaustion. */
export interface ValidationConfig {
  /** Max string length in characters (default: 10KB) */
  maxStringLength?: number;
  /** Max object nesting depth (default: 5) */
  maxObjectDepth?: number;
  /** Max array length (default: 100) */
  maxArrayLength?: number;
  /** Max total JSON size in bytes (default: 50KB) */
  maxTotalSize?: number;
  /** Allowed key pattern (default: /^[a-zA-Z0-9_.-]+$/) */
  allowedKeyPattern?: RegExp;
}

/** Production-ready header configs for common feature flag use cases. */
export const DEFAULT_HEADER_CONFIG: HeaderConfig[] = [
  {
    name: "x-feature-flag-segment",
    type: "string",
    maxLength: 50,
    pattern: /^[a-zA-Z0-9_-]+$/,
  },
  {
    name: "x-feature-flag-cohort",
    type: "string",
    maxLength: 50,
    pattern: /^[a-zA-Z0-9_-]+$/,
  },
  {
    name: "x-ab-test-group",
    type: "enum",
    enumValues: ["control", "variant-a", "variant-b", "variant-c"],
  },
  {
    name: "x-experiment-id",
    type: "string",
    maxLength: 100,
    pattern: /^[a-zA-Z0-9_.-]+$/,
  },
  {
    name: "x-client-version",
    type: "string",
    maxLength: 20,
    pattern: /^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9]+)?$/,
  },
  {
    name: "x-deployment-ring",
    type: "enum",
    enumValues: ["canary", "preview", "production"],
  },
  {
    name: "x-user-subscription",
    type: "enum",
    enumValues: ["free", "pro", "enterprise"],
  },
  {
    name: "x-beta-features",
    type: "boolean",
  },
];

// Prototype pollution prevention - these keys are always rejected
const BLACKLISTED_KEYS = [
  "__proto__",
  "constructor",
  "prototype",
  "hasOwnProperty",
  "toString",
  "valueOf",
];

/**
 * Validates context attributes against security rules.
 * @param key - Attribute name (alphanumeric, underscore, dash, dot only)
 * @param value - Any serializable value
 * @param config - Size and format limits
 * @returns false if validation fails (prototype pollution, size limits, etc.)
 */
export function validateContextAttribute(
  key: string,
  value: any,
  config: ValidationConfig = {},
): boolean {
  const {
    maxStringLength = 10240, // 10KB for strings
    maxObjectDepth = 5,
    maxArrayLength = 100,
    maxTotalSize = 51200, // 50KB total
    allowedKeyPattern = /^[a-zA-Z0-9_.-]+$/,
  } = config;

  // Prototype pollution prevention
  if (BLACKLISTED_KEYS.includes(key)) {
    return false;
  }

  // SECURITY: Key format validation - alphanumeric, underscore, dash, dot only
  if (!allowedKeyPattern.test(key)) {
    return false;
  }

  // Size limit check via JSON serialization
  try {
    const serialized = JSON.stringify(value);
    if (serialized.length > maxTotalSize) {
      return false;
    }
  } catch {
    return false; // SECURITY: Reject non-serializable types (functions, symbols, etc.)
  }

  // Recursive validation with depth/size limits
  function validateValue(val: any, depth = 0): boolean {
    // SECURITY: DoS prevention - limit nesting depth
    if (depth > maxObjectDepth) {
      return false;
    }

    // Type-specific validation rules
    if (val === null || val === undefined) {
      return true;
    }

    if (typeof val === "string") {
      return val.length <= maxStringLength;
    }

    if (typeof val === "number") {
      return isFinite(val); // Reject Infinity/NaN
    }

    if (typeof val === "boolean") {
      return true;
    }

    if (Array.isArray(val)) {
      if (val.length > maxArrayLength) {
        return false;
      }
      return val.every((item) => validateValue(item, depth + 1));
    }

    if (typeof val === "object") {
      const keys = Object.keys(val);
      if (keys.length > 100) {
        // DoS prevention: max 100 properties
        return false;
      }

      // Additional prototype pollution checks
      for (const k of keys) {
        if (BLACKLISTED_KEYS.includes(k)) {
          return false;
        }
      }

      // Direct property checks for prototype pollution
      if (
        Object.prototype.hasOwnProperty.call(val, "__proto__") ||
        Object.prototype.hasOwnProperty.call(val, "prototype")
      ) {
        return false;
      }

      // Recursive validation for nested objects
      return keys.every((k) => validateValue(val[k], depth + 1));
    }

    // Reject non-serializable types
    return false;
  }

  return validateValue(value);
}

/**
 * Validates header value against type and format rules.
 * @param value - Raw header string value
 * @param config - Validation rules (type, length, pattern, enum)
 * @returns true if valid, false otherwise
 */
export function isValidHeaderValue(
  value: string,
  config: HeaderConfig,
): boolean {
  if (!value || value.length === 0) {
    return !config.required;
  }

  // Length validation
  if (config.maxLength && value.length > config.maxLength) {
    return false;
  }

  // Type coercion and validation
  switch (config.type) {
    case "string":
      if (config.pattern && !config.pattern.test(value)) {
        return false;
      }
      break;

    case "number":
      const num = Number(value);
      if (isNaN(num) || !isFinite(num)) {
        return false;
      }
      break;

    case "boolean":
      if (value !== "true" && value !== "false") {
        return false;
      }
      break;

    case "enum":
      if (!config.enumValues?.includes(value)) {
        return false;
      }
      break;

    case "json":
      try {
        JSON.parse(value);
      } catch {
        return false;
      }
      break;
  }

  return true;
}

/**
 * Sanitizes and converts header values to proper types.
 * @param value - Raw header string
 * @param config - Type conversion rules
 * @returns Converted value or null if invalid
 */
export function sanitizeHeaderValue(value: string, config: HeaderConfig): any {
  if (!value) return null;

  // Custom sanitization hook
  if (config.sanitize) {
    value = config.sanitize(value);
  }

  // Type-specific sanitization and conversion
  switch (config.type) {
    case "string":
      // Strip control chars, normalize whitespace
      return value.replace(/[\x00-\x1F\x7F]/g, "").trim();

    case "number":
      return Number(value);

    case "boolean":
      return value === "true";

    case "enum":
      return value; // Pre-validated in isValidHeaderValue

    case "json":
      try {
        const parsed = JSON.parse(value);
        // Clean parsed objects from prototype pollution
        if (
          typeof parsed === "object" &&
          parsed !== null &&
          !Array.isArray(parsed)
        ) {
          // Safe object creation, filter blacklisted keys
          const clean: any = {};
          for (const [k, v] of Object.entries(parsed)) {
            if (!BLACKLISTED_KEYS.includes(k)) {
              clean[k] = v;
            }
          }
          return clean;
        }
        return parsed;
      } catch {
        return null;
      }

    default:
      return value;
  }
}

/**
 * HTML entity encoding for safe display in web contexts.
 * @param value - Any value to sanitize
 * @returns HTML-safe version with encoded entities
 */
export function sanitizeForDisplay(value: any): any {
  if (typeof value === "string") {
    // Standard HTML entity encoding for XSS prevention
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeForDisplay);
  }

  if (value && typeof value === "object") {
    const sanitized: any = {};
    for (const [k, v] of Object.entries(value)) {
      sanitized[k] = sanitizeForDisplay(v);
    }
    return sanitized;
  }

  return value;
}

/**
 * Extracts whitelisted headers into sanitized context attributes.
 * @param ctx - Request context with headers
 * @param headerConfig - Allowed headers and validation rules
 * @param options - Logging and strict mode settings
 * @returns Safe context attributes with security metadata
 */
export function extractSecureCustomAttributes(
  ctx: any,
  headerConfig: HeaderConfig[] = DEFAULT_HEADER_CONFIG,
  options: { logInvalid?: boolean; strict?: boolean } = {},
): Record<string, any> {
  const attributes: Record<string, any> = {};

  if (!ctx.headers) return attributes;

  // Extract only whitelisted headers
  for (const config of headerConfig) {
    const value = ctx.headers.get?.(config.name);

    if (value !== undefined && value !== null) {
      // Apply validation rules
      if (!isValidHeaderValue(value, config)) {
        if (options.logInvalid) {
          console.warn(
            `[feature-flags] Invalid value for header ${config.name}: ${value}`,
          );
        }
        continue;
      }

      // Convert to safe context attribute
      const sanitized = sanitizeHeaderValue(value, config);
      if (sanitized !== null) {
        // Header name to camelCase: x-feature-flag -> featureFlag
        const attrName = config.name
          .substring(2) // Strip x- prefix
          .replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());

        attributes[attrName] = sanitized;
      }
    }
  }

  // Strict mode: warn about non-whitelisted feature headers
  if (options.strict && options.logInvalid && ctx.headers) {
    for (const [key] of ctx.headers.entries()) {
      if (key.startsWith("x-feature-") || key.startsWith("x-targeting-")) {
        const isWhitelisted = headerConfig.some((h) => h.name === key);
        if (!isWhitelisted) {
          console.warn(
            `[feature-flags] Rejected non-whitelisted header: ${key}`,
          );
        }
      }
    }
  }

  // Security audit trail metadata
  attributes._headerSource = true;
  attributes._validated = true;
  attributes._timestamp = Date.now();

  return attributes;
}

/**
 * Factory for header extractors with custom validation config.
 * @param customConfig - Custom header validation rules
 * @returns Configured extractor function
 */
export function createHeaderExtractor(customConfig?: HeaderConfig[]) {
  const config = customConfig || DEFAULT_HEADER_CONFIG;

  return (ctx: any, options?: { logInvalid?: boolean; strict?: boolean }) =>
    extractSecureCustomAttributes(ctx, config, options);
}
