// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import { betterAuth } from "better-auth";
import { featureFlags, type HeaderConfig } from "../src";

/**
 * Example: Configuring secure header processing for feature flags
 */

// Define custom header configuration with strict validation
const customHeaders: HeaderConfig[] = [
  {
    name: "x-client-version",
    type: "string",
    maxLength: 20,
    pattern: /^[0-9]+\.[0-9]+\.[0-9]+$/,
    required: false,
  },
  {
    name: "x-user-tier",
    type: "enum",
    enumValues: ["free", "starter", "pro", "enterprise"],
    required: false,
  },
  {
    name: "x-beta-opt-in",
    type: "boolean",
    required: false,
  },
  {
    name: "x-experiment-cohort",
    type: "string",
    maxLength: 30,
    pattern: /^[A-Z][A-Z0-9_-]+$/,
  },
  {
    name: "x-feature-metadata",
    type: "json",
    required: false,
  },
];

// Initialize Better Auth with secure feature flags
export const auth = betterAuth({
  database: {
    provider: "sqlite",
    url: "./dev.db",
  },
  plugins: [
    featureFlags({
      // Storage configuration
      storage: "database",

      // Enable caching for performance
      caching: {
        enabled: true,
        ttl: 60, // 60 seconds
      },

      // Configure secure header processing
      customHeaders: {
        enabled: true,
        whitelist: customHeaders,
        strict: true, // Reject non-whitelisted headers
        logInvalid: true, // Log security violations
      },

      // Configure context validation rules
      contextValidation: {
        maxStringLength: 5000, // 5KB max for strings
        maxObjectDepth: 3, // Max 3 levels of nesting
        maxArrayLength: 50, // Max 50 items in arrays
        maxTotalSize: 25600, // 25KB total size
        allowedKeyPattern: /^[a-zA-Z0-9_.-]+$/, // Alphanumeric keys only
      },

      // Configure context collection options
      contextCollection: {
        collectDevice: true, // Collect device info from user agent
        collectGeo: false, // Don't collect geographic data (privacy)
        collectCustomHeaders: true, // Enable custom header processing
        collectClientInfo: false, // Don't collect IP addresses
      },

      // Define static flags
      flags: {
        "new-dashboard": {
          enabled: true,
          default: false,
          rollout: 20, // 20% rollout
          targeting: {
            roles: ["beta-tester"],
          },
        },
        "ai-features": {
          enabled: true,
          default: false,
          targeting: {
            attributes: {
              userTier: ["pro", "enterprise"],
            },
          },
        },
      },

      // Enable audit logging
      audit: {
        enabled: true,
        retentionDays: 30,
      },

      // Track usage analytics
      analytics: {
        trackUsage: true,
        trackPerformance: false,
      },
    }),
  ],
});

/**
 * Example API endpoint that uses secure headers
 */
export async function handleRequest(request: Request) {
  // Headers are automatically validated and sanitized
  // Invalid headers are rejected or logged based on configuration

  const headers = {
    "x-client-version": request.headers.get("x-client-version"),
    "x-user-tier": request.headers.get("x-user-tier"),
    "x-beta-opt-in": request.headers.get("x-beta-opt-in"),
    "x-experiment-cohort": request.headers.get("x-experiment-cohort"),
    "x-feature-metadata": request.headers.get("x-feature-metadata"),
    // This header would be rejected:
    "x-malicious-header": request.headers.get("x-malicious-header"),
  };

  // The feature flags middleware will:
  // 1. Validate all headers against the whitelist
  // 2. Sanitize values to prevent injection attacks
  // 3. Check for prototype pollution attempts
  // 4. Enforce size and format constraints
  // 5. Log any security violations

  // Use the auth API with secure context
  const response = await auth.api.evaluateFlag({
    body: {
      key: "new-dashboard",
    },
    headers: request.headers,
  });

  return response;
}

/**
 * Example: Custom header validation for specific use cases
 */
export const strictApiHeaders: HeaderConfig[] = [
  {
    name: "x-api-version",
    type: "string",
    pattern: /^v[0-9]+$/,
    required: true, // This header is mandatory
  },
  {
    name: "x-request-id",
    type: "string",
    pattern: /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/,
    required: true, // UUID format required
  },
  {
    name: "x-feature-context",
    type: "json",
    required: false,
    sanitize: (value: string) => {
      // Custom sanitization logic
      try {
        const parsed = JSON.parse(value);
        // Remove sensitive fields
        delete parsed.password;
        delete parsed.token;
        delete parsed.apiKey;
        return JSON.stringify(parsed);
      } catch {
        return "{}";
      }
    },
  },
];

/**
 * Security benefits of this approach:
 *
 * 1. **Whitelist-based**: Only explicitly allowed headers are processed
 * 2. **Type validation**: Each header has a specific expected type
 * 3. **Format validation**: Regex patterns ensure correct format
 * 4. **Size limits**: Prevents memory exhaustion attacks
 * 5. **Prototype pollution protection**: Blacklisted keys are rejected
 * 6. **XSS prevention**: Values are sanitized before use
 * 7. **Audit trail**: Invalid attempts are logged for security monitoring
 * 8. **Custom sanitization**: Apply domain-specific cleaning logic
 * 9. **Strict mode**: Optionally reject requests with unknown headers
 * 10. **Performance**: Validation is done once and cached
 */
