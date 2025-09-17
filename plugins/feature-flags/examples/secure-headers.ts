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
          rolloutPercentage: 20, // 20% rollout
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

  // Use the auth API with secure context (flat server API)
  const response = await auth.api.getFlag({
    body: {
      key: "new-dashboard",
      context: {
        // Additional context beyond what's automatically collected
        userAgent: request.headers.get("user-agent"),
        // Headers are automatically validated and sanitized by middleware
      },
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
 * Example: Complete server-side API usage demonstration
 * Note: Server-side auth.api uses flat methods (not nested)
 */
export async function demonstrateServerApiUsage() {
  // Get a single flag
  const singleFlag = await auth.api.getFlag({
    body: {
      key: "new-dashboard",
      context: { userId: "123", plan: "pro" },
      default: false,
    },
  });

  // Get multiple flags in batch
  const batchFlags = await auth.api.getFlags({
    body: {
      keys: ["new-dashboard", "ai-features", "dark-mode"],
      context: { userId: "123", plan: "pro" },
      defaults: {
        "new-dashboard": false,
        "ai-features": false,
        "dark-mode": true,
      },
    },
  });

  // Get all available flags for a user
  const allFlags = await auth.api.getAllFlags({
    body: {
      context: { userId: "123", plan: "pro" },
    },
  });

  // Track flag usage event
  await auth.api.trackEvent({
    body: {
      flagKey: "new-dashboard",
      event: "feature_used",
      data: { action: "clicked_button", timestamp: Date.now() },
    },
  });

  // Admin operations (require admin role)
  const adminUser = { roles: ["admin"] };

  // List all flags
  const flagsList = await auth.api.listFlags({
    body: {
      organizationId: "org-123",
      includeStats: true,
      limit: 50,
      offset: 0,
    },
  });

  // Create a new flag
  const newFlag = await auth.api.createFlag({
    body: {
      key: "beta-feature",
      name: "Beta Feature",
      description: "New experimental feature",
      enabled: true,
      type: "boolean",
      defaultValue: false,
      rolloutPercentage: 10,
    },
  });

  return {
    singleFlag,
    batchFlags,
    allFlags,
    flagsList,
    newFlag,
    adminUser, // Just to silence unused variable warning
  };
}

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
 * 11. **Type safety**: Full TypeScript support with auto-completion
 * 12. **Consistent API**: Server API is flat (auth.api.*) while client API is namespaced (authClient.featureFlags.*)
 */
