# Configuration Guide

Comprehensive configuration options for the Better Auth Feature Flags plugin.

## Basic Configuration

The minimal configuration to get started:

```typescript
import { featureFlags } from "better-auth-feature-flags";

featureFlags({
  // Minimal config - uses database storage by default
});
```

## Full Configuration

All available configuration options:

```typescript
featureFlags({
  // Storage configuration
  storage: "database" | "memory" | "redis",
  storageOptions: {
    // Database-specific options
    tablePrefix: "ff_",

    // Redis-specific options (future)
    redis: {
      host: "localhost",
      port: 6379,
      keyPrefix: "feature_flags:"
    }
  },

  // Static flag definitions
  flags: {
    "feature-key": {
      enabled: boolean,
      defaultValue: any,
      type: "boolean" | "string" | "number" | "json",
      rolloutPercentage: number, // 0-100
      description: string,
      metadata: Record<string, any>,

      // Targeting configuration
      targeting: {
        userIds: string[],
        roles: string[],
        organizations: string[],
        attributes: Record<string, any>
      },

      // Variants for A/B testing
      variants: [
        {
          key: string,
          weight: number, // Must sum to 100
          value: any,
          metadata: Record<string, any>
        }
      ],

      // Rules
      rules: [
        {
          name: string,
          priority: number,
          conditions: RuleConditions,
          value: any,
          percentage: number
        }
      ]
    }
  },

  // Analytics configuration
  analytics: {
    enabled: boolean,        // Default: false
    trackUsage: boolean,     // Track flag evaluations
    trackPerformance: boolean, // Track evaluation timing
    trackErrors: boolean,    // Track evaluation errors
    sampleRate: number,      // 0-1, percentage of events to track
    retentionDays: number    // How long to keep analytics data
  },

  // Admin API configuration
  adminAccess: {
    enabled: boolean,        // Default: true
    roles: string[],         // Required roles for admin access
    customCheck: (ctx) => boolean, // Custom authorization
    rateLimit: {
      requests: number,      // Max requests per window
      window: number         // Time window in seconds
    }
  },

  // Multi-tenancy configuration
  multiTenant: {
    enabled: boolean,        // Default: false
    useOrganizations: boolean, // Use Better Auth organizations
    isolateByDefault: boolean, // Isolate flags by default
    sharedFlags: string[]    // Flag keys that are shared
  },

  // Caching configuration
  caching: {
    enabled: boolean,        // Default: true
    ttl: number,            // Cache TTL in seconds
    maxSize: number,        // Max cache entries
    strategy: "lru" | "lfu", // Cache eviction strategy
    warmup: string[],       // Flag keys to preload
    invalidateOn: string[]  // Events that trigger invalidation
  },

  // Audit logging configuration
  audit: {
    enabled: boolean,        // Default: false
    logLevel: "all" | "changes" | "admin", // What to log
    retentionDays: number,   // How long to keep logs
    includeContext: boolean, // Include evaluation context
    customLogger: (entry) => void // Custom log handler
  },

  // Context collection configuration
  contextCollection: {
    collectDevice: boolean,  // Collect device/browser info
    collectGeo: boolean,     // Collect geographic info
    collectCustomHeaders: boolean, // Process x-feature-flag-* headers
    collectClientInfo: boolean, // Collect IP, referrer
    allowedAttributes: string[], // Whitelist of attributes
    maxAttributeDepth: number, // Max nesting depth
    sanitize: boolean        // Sanitize input values
  },

  // Custom headers configuration
  customHeaders: {
    enabled: boolean,        // Process custom headers
    whitelist: HeaderConfig[], // Allowed headers
    strict: boolean,         // Reject non-whitelisted
    logInvalid: boolean,     // Log rejected headers
    transform: (headers) => headers // Transform function
  },

  // Validation configuration
  contextValidation: {
    maxStringLength: number, // Max string attribute length
    maxObjectDepth: number,  // Max object nesting
    maxArrayLength: number,  // Max array items
    maxTotalSize: number,    // Max total context size
    rejectOnInvalid: boolean // Reject or sanitize
  },

  // Performance configuration
  performance: {
    evaluationTimeout: number, // Max evaluation time (ms)
    batchSize: number,       // Max flags per batch
    parallelEvaluations: boolean, // Parallel rule evaluation
    circuitBreaker: {
      enabled: boolean,
      threshold: number,     // Error threshold
      timeout: number        // Reset timeout
    }
  },

  // Middleware configuration
  middleware: {
    mode: "minimal" | "session" | "full", // Context detail level
    autoContext: boolean,    // Auto-add context to evaluations
    enhanceResponse: boolean, // Add flag data to responses
    injectClient: boolean    // Inject flags into client
  },

  // Security configuration
  security: {
    encryption: {
      enabled: boolean,      // Encrypt sensitive data
      algorithm: string,     // Encryption algorithm
      key: string           // Encryption key
    },
    rateLimit: {
      evaluation: number,    // Max evaluations/second
      admin: number         // Max admin ops/second
    },
    allowedOrigins: string[], // CORS origins
    csrfProtection: boolean  // Enable CSRF protection
  },

  // Webhooks configuration
  webhooks: {
    enabled: boolean,
    endpoints: {
      flagChanged: string,   // Flag update webhook
      evaluationFailed: string, // Error webhook
      usageThreshold: string // Usage alert webhook
    },
    secret: string,         // Webhook signature secret
    retries: number,        // Retry attempts
    timeout: number         // Request timeout
  },

  // Development configuration
  development: {
    debug: boolean,         // Enable debug logging
    mockEvaluations: boolean, // Use mock responses
    seedData: FlagSeed[],   // Initial flag data
    resetOnStart: boolean   // Clear all flags on start
  }
})
```

## Storage Options

### Database Storage

Default production storage using Better Auth's database:

```typescript
featureFlags({
  storage: "database",
  storageOptions: {
    tablePrefix: "ff_", // Optional table prefix

    // Connection reuse Better Auth's database
    // No additional configuration needed
  },
});
```

Supported databases:

- PostgreSQL
- MySQL
- SQLite
- MariaDB
- Any Kysely-supported database

### Memory Storage

For development and testing:

```typescript
featureFlags({
  storage: "memory",
  storageOptions: {
    maxEntries: 10000, // Maximum flags in memory
    persistToDisk: false, // Save to file (dev only)
  },
});
```

> [!WARNING]
> Memory storage is not suitable for production as data is lost on restart.

### Redis Storage (Planned)

For high-scale distributed applications:

```typescript
featureFlags({
  storage: "redis",
  storageOptions: {
    redis: {
      host: process.env.REDIS_HOST,
      port: 6379,
      password: process.env.REDIS_PASSWORD,
      db: 0,
      keyPrefix: "ff:",
      ttl: 3600, // Default TTL in seconds
    },
  },
});
```

## Static Flag Definitions

Define flags in configuration for version control:

```typescript
featureFlags({
  flags: {
    // Simple boolean flag
    "maintenance-mode": {
      enabled: false,
      defaultValue: false,
      description: "Site maintenance mode",
    },

    // Percentage rollout
    "new-checkout": {
      enabled: true,
      defaultValue: false,
      rolloutPercentage: 25,
      description: "New checkout flow",
    },

    // Targeted flag
    "beta-features": {
      enabled: true,
      defaultValue: false,
      targeting: {
        roles: ["beta-tester", "employee"],
        userIds: ["user-123", "user-456"],
      },
    },

    // A/B test with variants
    "homepage-test": {
      enabled: true,
      type: "json",
      variants: [
        {
          key: "control",
          weight: 50,
          value: { layout: "classic" },
        },
        {
          key: "variant",
          weight: 50,
          value: { layout: "modern" },
        },
      ],
    },
  },
});
```

## Analytics Configuration

Track feature flag usage and performance:

```typescript
featureFlags({
  analytics: {
    enabled: true,
    trackUsage: true, // Track evaluations
    trackPerformance: true, // Track timing
    trackErrors: true, // Track failures
    sampleRate: 0.1, // Sample 10% of events
    retentionDays: 30, // Keep for 30 days
  },
});
```

### Analytics Data Collected

When enabled, tracks:

- Flag evaluation counts
- User/session evaluation patterns
- Value distribution
- Variant assignment
- Evaluation performance (P50, P95, P99)
- Error rates and types
- Conversion events (with tracking)

## Admin Access Control

Configure who can manage flags:

```typescript
featureFlags({
  adminAccess: {
    enabled: true,
    roles: ["admin", "feature-manager"],

    // Custom authorization logic
    customCheck: async (ctx) => {
      const user = ctx.get("user");
      return user?.permissions?.includes("manage:features");
    },

    // Rate limiting
    rateLimit: {
      requests: 100,
      window: 60, // 100 requests per minute
    },
  },
});
```

## Multi-Tenant Configuration

For SaaS applications with multiple organizations:

```typescript
featureFlags({
  multiTenant: {
    enabled: true,
    useOrganizations: true, // Use Better Auth orgs
    isolateByDefault: true, // Flags are org-specific

    // These flags are available to all orgs
    sharedFlags: ["maintenance-mode", "global-announcement"],
  },
});
```

### Usage with Organizations

```typescript
// Create org-specific flag
await createFlag({
  key: "custom-feature",
  organizationId: "org-123",
});

// Evaluate with org context
await evaluate({
  key: "custom-feature",
  userId: "user-123",
  organizationId: "org-123",
});
```

## Caching Strategy

Optimize performance with caching:

```typescript
featureFlags({
  caching: {
    enabled: true,
    ttl: 60, // Cache for 60 seconds
    maxSize: 1000, // Max 1000 entries
    strategy: "lru", // Least recently used

    // Preload frequently used flags
    warmup: ["critical-flag", "homepage-config"],

    // Invalidate cache on these events
    invalidateOn: ["flag:update", "rule:change"],
  },
});
```

### Cache Invalidation

```typescript
// Manual cache invalidation
await auth.api.featureFlags.invalidateCache("flag-key");

// Clear all cache
await auth.api.featureFlags.clearCache();
```

## Privacy & Context Collection

Control what data is collected:

```typescript
featureFlags({
  contextCollection: {
    // All disabled by default
    collectDevice: false, // Browser, OS, device type
    collectGeo: false, // Country, region, city
    collectCustomHeaders: false, // x-feature-flag-* headers
    collectClientInfo: false, // IP address, referrer

    // Only collect specific attributes
    allowedAttributes: ["role", "plan", "company"],

    // Security limits
    maxAttributeDepth: 3,
    sanitize: true,
  },
});
```

## Custom Headers

Process custom headers for targeting:

```typescript
featureFlags({
  customHeaders: {
    enabled: true,

    // Define allowed headers
    whitelist: [
      {
        name: "x-feature-flag-segment",
        type: "string",
        maxLength: 50,
        pattern: /^[a-z0-9-]+$/i,
        required: false,
      },
      {
        name: "x-feature-flag-version",
        type: "number",
        min: 1,
        max: 999,
      },
    ],

    strict: true, // Reject unknown headers
    logInvalid: true, // Log rejected headers
  },
});
```

## Security Configuration

Enhanced security options:

```typescript
featureFlags({
  security: {
    // Encrypt sensitive flag values
    encryption: {
      enabled: true,
      algorithm: "aes-256-gcm",
      key: process.env.ENCRYPTION_KEY,
    },

    // Rate limiting
    rateLimit: {
      evaluation: 1000, // 1000 evals/second
      admin: 10, // 10 admin ops/second
    },

    // CORS configuration
    allowedOrigins: ["https://app.example.com"],

    // CSRF protection (inherited from Better Auth)
    csrfProtection: true,
  },
});
```

## Webhook Configuration

Get notified of flag changes:

```typescript
featureFlags({
  webhooks: {
    enabled: true,

    endpoints: {
      flagChanged: "https://api.example.com/webhooks/flag-changed",
      evaluationFailed: "https://api.example.com/webhooks/error",
      usageThreshold: "https://api.example.com/webhooks/usage-alert",
    },

    // Webhook signature for verification
    secret: process.env.WEBHOOK_SECRET,

    // Reliability
    retries: 3,
    timeout: 5000, // 5 seconds
  },
});
```

### Webhook Payload

```typescript
interface WebhookPayload {
  event: "flag.changed" | "evaluation.failed" | "usage.threshold";
  timestamp: string;
  data: {
    flagId: string;
    flagKey: string;
    changes?: Record<string, any>;
    error?: string;
    usage?: number;
  };
  signature: string; // HMAC-SHA256
}
```

## Development Mode

Development-specific configuration:

```typescript
featureFlags({
  development: {
    debug: true, // Verbose logging
    mockEvaluations: false, // Use real evaluations

    // Seed initial data
    seedData: [
      {
        key: "test-flag",
        enabled: true,
        defaultValue: true,
      },
    ],

    // Reset on start (careful!)
    resetOnStart: process.env.NODE_ENV === "test",
  },
});
```

## Environment Variables

Recommended environment variables:

```bash
# Storage
DATABASE_URL=postgresql://user:pass@localhost:5432/db
REDIS_URL=redis://localhost:6379

# Security
FEATURE_FLAGS_ENCRYPTION_KEY=your-256-bit-key
FEATURE_FLAGS_WEBHOOK_SECRET=your-webhook-secret

# Analytics
FEATURE_FLAGS_ANALYTICS_ENABLED=true
FEATURE_FLAGS_ANALYTICS_SAMPLE_RATE=0.1

# Admin
FEATURE_FLAGS_ADMIN_ROLES=admin,feature-manager

# Development
FEATURE_FLAGS_DEBUG=true
```

Load environment configuration:

```typescript
featureFlags({
  storage: process.env.REDIS_URL ? "redis" : "database",

  analytics: {
    enabled: process.env.FEATURE_FLAGS_ANALYTICS_ENABLED === "true",
    sampleRate: parseFloat(
      process.env.FEATURE_FLAGS_ANALYTICS_SAMPLE_RATE || "1"
    ),
  },

  adminAccess: {
    roles: process.env.FEATURE_FLAGS_ADMIN_ROLES?.split(",") || ["admin"],
  },

  development: {
    debug: process.env.FEATURE_FLAGS_DEBUG === "true",
  },
});
```

## TypeScript Configuration

Enable full type safety:

```typescript
// types.ts
import type { FeatureFlagsOptions } from "better-auth-feature-flags";

// Define your flag types
interface MyFlags {
  "dark-mode": boolean;
  "api-version": number;
  "feature-config": {
    enabled: boolean;
    settings: Record<string, any>;
  };
}

// Type-safe configuration
const config: FeatureFlagsOptions<MyFlags> = {
  flags: {
    "dark-mode": {
      enabled: true,
      defaultValue: false,
    },
    "api-version": {
      enabled: true,
      defaultValue: 1,
      type: "number",
    },
  },
};
```

## Performance Tuning

Optimize for your use case:

### High Traffic

```typescript
featureFlags({
  caching: {
    enabled: true,
    ttl: 300, // 5 minute cache
    maxSize: 10000, // Large cache
  },

  performance: {
    batchSize: 100, // Large batches
    parallelEvaluations: true,
  },
});
```

### Low Latency

```typescript
featureFlags({
  storage: "memory", // Fastest storage

  caching: {
    enabled: true,
    ttl: 60,
    strategy: "lfu", // Frequently used
  },

  middleware: {
    mode: "minimal", // Less processing
  },
});
```

### High Reliability

```typescript
featureFlags({
  performance: {
    evaluationTimeout: 100, // Fast timeout
    circuitBreaker: {
      enabled: true,
      threshold: 5, // 5 errors
      timeout: 30000, // 30 second reset
    },
  },

  audit: {
    enabled: true,
    logLevel: "all",
  },
});
```

## Migration from Other Providers

### From LaunchDarkly

```typescript
// Map LaunchDarkly configuration
featureFlags({
  flags: {
    // Convert LD flags to Better Auth format
    "ld-flag-key": {
      enabled: true,
      defaultValue: ldFlag.defaultValue,
      rolloutPercentage: ldFlag.rollout?.percentage,
      rules: ldFlag.rules?.map((rule) => ({
        conditions: convertLDConditions(rule.clauses),
        value: rule.variation,
      })),
    },
  },
});
```

### From Unleash

```typescript
// Map Unleash configuration
featureFlags({
  flags: {
    "unleash-toggle": {
      enabled: unleashToggle.enabled,
      defaultValue: false,
      targeting: {
        userIds: unleashToggle.strategies?.find((s) => s.name === "userWithId")
          ?.parameters?.userIds,
      },
    },
  },
});
```

## Best Practices

::: tip Configuration Tips

1. **Start Simple** - Begin with basic configuration and add complexity as needed
2. **Use Environment Variables** - Keep sensitive configuration out of code
3. **Enable Caching** - Always use caching in production
4. **Set Appropriate TTLs** - Balance freshness with performance
5. **Monitor Performance** - Enable analytics to track usage
6. **Implement Audit Logging** - Track changes for compliance
7. **Use TypeScript** - Leverage type safety for configuration
8. **Test Configuration** - Validate configuration in development
   :::

## Validation

The plugin validates configuration at startup:

```typescript
// Configuration is validated automatically
const auth = betterAuth({
  plugins: [
    featureFlags({
      // Invalid configuration will throw an error
      rolloutPercentage: 150, // Error: Must be 0-100
    }),
  ],
});
```

Manual validation:

```typescript
import { validateConfig } from "better-auth-feature-flags";

const config = {
  /* ... */
};
const errors = validateConfig(config);

if (errors.length > 0) {
  console.error("Invalid configuration:", errors);
}
```
