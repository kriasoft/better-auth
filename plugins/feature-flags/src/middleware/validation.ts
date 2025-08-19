// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

/**
 * Security validation utilities for feature flags context data
 */

/**
 * Configuration for header validation
 */
export interface HeaderConfig {
  name: string;
  type: "string" | "number" | "boolean" | "json" | "enum";
  maxLength?: number;
  enumValues?: string[];
  pattern?: RegExp;
  required?: boolean;
  sanitize?: (value: string) => string;
}

/**
 * Configuration for context data validation
 */
export interface ValidationConfig {
  maxStringLength?: number; // Default: 10KB
  maxObjectDepth?: number; // Default: 5
  maxArrayLength?: number; // Default: 100
  maxTotalSize?: number; // Default: 50KB
  allowedKeyPattern?: RegExp; // Default: /^[a-zA-Z0-9_.-]+$/
}

/**
 * Default header configuration with secure validation rules
 */
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

/**
 * Blacklisted keys that could lead to prototype pollution
 */
const BLACKLISTED_KEYS = [
  "__proto__",
  "constructor",
  "prototype",
  "hasOwnProperty",
  "toString",
  "valueOf",
];

/**
 * Validate context attribute key and value
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

  // 1. Prevent prototype pollution and reserved keys
  if (BLACKLISTED_KEYS.includes(key)) {
    return false;
  }

  // 2. Validate key format (alphanumeric, underscore, dash, dot)
  if (!allowedKeyPattern.test(key)) {
    return false;
  }

  // 3. Check total serialized size
  try {
    const serialized = JSON.stringify(value);
    if (serialized.length > maxTotalSize) {
      return false;
    }
  } catch {
    return false; // Non-serializable values rejected
  }

  // 4. Type-specific validation
  function validateValue(val: any, depth = 0): boolean {
    // Prevent deep nesting
    if (depth > maxObjectDepth) {
      return false;
    }

    // Handle different types
    if (val === null || val === undefined) {
      return true;
    }

    if (typeof val === "string") {
      return val.length <= maxStringLength;
    }

    if (typeof val === "number") {
      return isFinite(val); // No Infinity or NaN
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
        // Max 100 properties per object
        return false;
      }

      // Check for blacklisted keys in the object
      for (const k of keys) {
        if (BLACKLISTED_KEYS.includes(k)) {
          return false;
        }
      }

      // Check if object has own properties that are blacklisted
      // (using hasOwnProperty to avoid checking inherited properties)
      if (
        Object.prototype.hasOwnProperty.call(val, "__proto__") ||
        Object.prototype.hasOwnProperty.call(val, "prototype")
      ) {
        return false;
      }

      // Validate all values recursively
      return keys.every((k) => validateValue(val[k], depth + 1));
    }

    // Reject functions, symbols, and other types
    return false;
  }

  return validateValue(value);
}

/**
 * Validate header value based on configuration
 */
export function isValidHeaderValue(
  value: string,
  config: HeaderConfig,
): boolean {
  if (!value || value.length === 0) {
    return !config.required;
  }

  // Check max length
  if (config.maxLength && value.length > config.maxLength) {
    return false;
  }

  // Type-specific validation
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
 * Sanitize header value based on type
 */
export function sanitizeHeaderValue(value: string, config: HeaderConfig): any {
  if (!value) return null;

  // Apply custom sanitization if provided
  if (config.sanitize) {
    value = config.sanitize(value);
  }

  // Type conversion
  switch (config.type) {
    case "string":
      // Remove control characters and trim
      return value.replace(/[\x00-\x1F\x7F]/g, "").trim();

    case "number":
      return Number(value);

    case "boolean":
      return value === "true";

    case "enum":
      return value; // Already validated

    case "json":
      try {
        const parsed = JSON.parse(value);
        // Additional validation for parsed JSON
        if (
          typeof parsed === "object" &&
          parsed !== null &&
          !Array.isArray(parsed)
        ) {
          // Create a clean object without prototype chain
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
 * XSS sanitization for display contexts
 */
export function sanitizeForDisplay(value: any): any {
  if (typeof value === "string") {
    // Basic HTML entity encoding
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
 * Extract and validate custom headers
 */
export function extractSecureCustomAttributes(
  ctx: any,
  headerConfig: HeaderConfig[] = DEFAULT_HEADER_CONFIG,
  options: { logInvalid?: boolean; strict?: boolean } = {},
): Record<string, any> {
  const attributes: Record<string, any> = {};

  if (!ctx.headers) return attributes;

  // Process each configured header
  for (const config of headerConfig) {
    const value = ctx.headers.get?.(config.name);

    if (value !== undefined && value !== null) {
      // Validate the header value
      if (!isValidHeaderValue(value, config)) {
        if (options.logInvalid) {
          console.warn(
            `[feature-flags] Invalid value for header ${config.name}: ${value}`,
          );
        }
        continue;
      }

      // Sanitize and add to attributes
      const sanitized = sanitizeHeaderValue(value, config);
      if (sanitized !== null) {
        // Convert header name to camelCase attribute name
        const attrName = config.name
          .substring(2) // Remove 'x-' prefix
          .replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());

        attributes[attrName] = sanitized;
      }
    }
  }

  // Check for unexpected headers if strict mode
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

  // Add security metadata
  attributes._headerSource = true;
  attributes._validated = true;
  attributes._timestamp = Date.now();

  return attributes;
}

/**
 * Create a header extractor with custom configuration
 */
export function createHeaderExtractor(customConfig?: HeaderConfig[]) {
  const config = customConfig || DEFAULT_HEADER_CONFIG;

  return (ctx: any, options?: { logInvalid?: boolean; strict?: boolean }) =>
    extractSecureCustomAttributes(ctx, config, options);
}
