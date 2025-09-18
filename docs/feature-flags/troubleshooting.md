# Troubleshooting Guide

Common issues and solutions for Better Auth Feature Flags.

## Common Issues

### Flag Not Evaluating Correctly

#### Problem

Flag returns unexpected value or default value when it shouldn't.

#### Diagnosis

```typescript
// Check flag status
const { flags } = await auth.api.listFeatureFlags({ query: {} });
const flag = flags.find((f) => f.key === "flag-key");
console.log("Flag enabled:", flag.enabled);
console.log("Rollout %:", flag.rolloutPercentage);

// Check evaluation with context
const result = await auth.api.evaluateFeatureFlag({
  body: {
    flagKey: "flag-key",
    context: { userId: "user-123", attributes: { role: "admin" } },
  },
});
console.log("Result:", result.value);
console.log("Reason:", result.reason);
```

#### Solutions

1. **Flag is disabled**

   ```typescript
   // Enable the flag
   await auth.api.updateFeatureFlag({
     body: { id: "flag-id", enabled: true },
   });
   ```

2. **User not in rollout percentage**

   ```typescript
   // Increase rollout or add override
   await auth.api.createFeatureFlagOverride({
     body: { flagId: "flag-id", userId: "user-123", value: true },
   });
   ```

3. **Rule conditions not matching**
   ```typescript
   // Debug rule evaluation
   const { rules } = await auth.api.listFeatureFlagRules({
     params: { flagId: "flag-id" },
   });
   rules.forEach((rule) => {
     console.log("Rule:", rule.name);
     console.log("Conditions:", JSON.stringify(rule.conditions));
     console.log("Priority:", rule.priority);
   });
   ```

### Database Connection Errors

#### Problem

`Error: Cannot connect to database` or `ECONNREFUSED`

#### Solutions

1. **Check database URL**

   ```bash
   # Verify environment variable
   echo $DATABASE_URL
   ```

2. **Test connection**

   ```typescript
   import { db } from "./db";

   try {
     await db.selectFrom("featureFlag").select("id").limit(1).execute();
     console.log("Database connected");
   } catch (error) {
     console.error("Database error:", error);
   }
   ```

3. **Run migrations**
   ```bash
   npx better-auth migrate
   ```

### Performance Issues

#### Problem

Slow flag evaluation or high latency.

#### Diagnosis

```typescript
// Measure evaluation time
const start = Date.now();
const result = await auth.api.evaluateFeatureFlag({
  body: { flagKey: "flag-key" },
});
const duration = Date.now() - start;
console.log(`Evaluation took ${duration}ms`);

// Check cache status
// Enable analytics to monitor evaluation performance and error rates.
```

#### Solutions

1. **Enable caching**

   ```typescript
   featureFlags({
     caching: {
       enabled: true,
       ttl: 300, // 5 minutes
       maxSize: 10000,
       strategy: "lru",
     },
   });
   ```

2. **Use batch evaluation**

   ```typescript
   // Use batch evaluation
   const { flags } = await auth.api.evaluateFeatureFlags({
     body: { flagKeys: ["flag1", "flag2"] },
   });
   ```

3. **Add database indexes**
   ```sql
   -- Add indexes for common queries
   CREATE INDEX idx_flags_key_org ON featureFlag(key, organizationId);
   CREATE INDEX idx_rules_flag_priority ON flagRule(flagId, priority);
   CREATE INDEX idx_overrides_flag_user ON flagOverride(flagId, userId);
   ```

### Type Errors

#### Problem

TypeScript errors when using flags.

#### Solutions

1. **Define flag types**

   ```typescript
   interface MyFlags {
     "dark-mode": boolean;
     "api-version": number;
   }

   const value =
     await client.featureFlags.getValue<MyFlags["dark-mode"]>("dark-mode");
   ```

2. **Use type assertions**

   ```typescript
   const config = (await client.featureFlags.getValue("config")) as ConfigType;
   ```

3. **Update type definitions**
   ```typescript
   declare module "better-auth-feature-flags" {
     interface FeatureFlags {
       "my-flag": boolean;
     }
   }
   ```

### Client-Server Mismatch

#### Problem

Different flag values on client and server.

#### Diagnosis

```typescript
// Server-side
const serverValue = await auth.api.evaluateFeatureFlag({
  body: { flagKey: "flag", context: { userId: "user-123" } },
});

// Client-side
const clientValue = await client.featureFlags.isEnabled("flag");

console.log("Server:", serverValue.value);
console.log("Client:", clientValue);
```

#### Solutions

1. **Clear client cache**

   ```typescript
   await client.featureFlags.clearCache();
   ```

2. **Ensure consistent context**

   ```typescript
   // Pass same context
   const context = {
     userId: session.user.id,
     organizationId: session.org.id,
   };
   ```

3. **Check authentication**
   ```typescript
   // Verify session exists
   const session = await auth.api.getSession();
   if (!session) {
     console.error("No session found");
   }
   ```

### Multi-tenant Issues

#### Problem

Flags bleeding across organizations.

#### Solutions

1. **Enable isolation**

   ```typescript
   featureFlags({
     multiTenant: {
       enabled: true,
       isolateByDefault: true,
     },
   });
   ```

2. **Include organization context**

   ```typescript
   const result = await evaluate({
     key: "flag",
     organizationId: "org-123", // Always include
   });
   ```

3. **Verify flag ownership**
   ```typescript
   const result = await authClient.featureFlags.evaluate("flag-key", {
     context: { organizationId: "org-123" }
   });
   // For admin operations, use the admin client
   const flag = await adminClient.featureFlags.admin.flags.get("flag-id");
   if (flag.organizationId !== "org-123") {
     throw new Error("Flag belongs to different org");
   }
   ```

## Error Messages

### `FLAG_NOT_FOUND`

**Meaning**: The requested flag doesn't exist.

**Solutions**:

- Verify flag key is correct
- Check if flag was deleted
- Create the flag if missing
- Use default value as fallback

### `EVALUATION_ERROR`

**Meaning**: Error during flag evaluation.

**Common Causes**:

- Invalid rule conditions
- Circular rule dependencies
- Database connection issues
- Timeout during evaluation

**Solutions**:

```typescript
try {
  const result = await evaluate({ key: "flag" });
} catch (error) {
  if (error.code === "EVALUATION_ERROR") {
    // Use default value
    return defaultValue;
  }
}
```

### `PERMISSION_DENIED`

**Meaning**: User lacks permission for admin operations.

**Solutions**:

- Check user roles
- Verify admin configuration
- Add required permissions

```typescript
// Configure admin access
featureFlags({
  adminAccess: {
    roles: ["admin", "feature-manager"],
  },
});
```

### `RATE_LIMIT_EXCEEDED`

**Meaning**: Too many requests.

**Solutions**:

- Implement caching
- Batch requests
- Increase rate limits
- Add retry logic

```typescript
// Retry with exponential backoff
async function evaluateWithRetry(key: string, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await evaluate({ key });
    } catch (error) {
      if (error.code === "RATE_LIMIT_EXCEEDED" && i < retries - 1) {
        await new Promise((r) => setTimeout(r, Math.pow(2, i) * 1000));
      } else {
        throw error;
      }
    }
  }
}
```

### `STORAGE_ERROR`

**Meaning**: Database or storage operation failed.

**Solutions**:

- Check database connection
- Verify table structure
- Run migrations
- Check disk space

## Debug Tools

### Enable Debug Logging

```typescript
// Server-side
featureFlags({
  development: {
    debug: true,
  },
});

// Client-side
featureFlagsClient({
  debug: true,
  onEvaluation: (flag, result) => {
    console.log(`Flag ${flag}:`, result);
  },
});
```

### Browser DevTools

```javascript
// In browser console (development only)
window.__FEATURE_FLAGS__ = {
  list: () => client.featureFlags.evaluateAllFlags(),
  enable: (key) => client.featureFlags.setOverride(key, true),
  disable: (key) => client.featureFlags.setOverride(key, false),
  clear: () => client.featureFlags.clearOverrides(),
};

// Usage (blocked in production)
__FEATURE_FLAGS__.list();
__FEATURE_FLAGS__.enable("new-feature"); // No-op in production
```

::: warning Production Safety
Overrides are automatically disabled in production. The `enable/disable` methods will have no effect in production environments.
:::

## Testing Issues

### Mocking Not Working

```typescript
// Correct mock setup
import { createMockClient } from "better-auth-feature-flags/testing";

const mockClient = createMockClient({
  flags: {
    "test-flag": true
  }
});

// Use in test
render(
  <FeatureFlagsProvider client={mockClient}>
    <Component />
  </FeatureFlagsProvider>
);
```

### Flaky Tests

**Solutions**:

1. **Use deterministic user IDs**

   ```typescript
   // Use consistent test user
   const TEST_USER = "test-user-deterministic";
   ```

2. **Mock time for rollout**

   ```typescript
   // Mock consistent hash
   jest.spyOn(Math, "random").mockReturnValue(0.5);
   ```

3. **Clear state between tests**
   ```typescript
   beforeEach(() => {
     clearAllMocks();
     resetDatabase();
   });
   ```

## Migration Issues

### Data Migration Failures

```typescript
// Rollback and retry
try {
  await auth.migrate();
} catch (error) {
  console.error("Migration failed:", error);
  await auth.rollback();
  // Fix issue and retry
}
```

### Schema Conflicts

```sql
-- Check existing tables
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public';

-- Drop and recreate if needed
DROP TABLE IF EXISTS featureFlag CASCADE;
```

## Performance Optimization

### Slow Evaluation Checklist

::: tip Performance Checklist

- [ ] Caching enabled
- [ ] Database indexes created
- [ ] Connection pooling configured
- [ ] Batch evaluation used
- [ ] Complex rules optimized
- [ ] Cache TTL appropriate
- [ ] Memory limits set
      :::

### Database Query Optimization

```sql
-- Analyze slow queries
EXPLAIN ANALYZE
SELECT * FROM featureFlag
WHERE key = 'flag-key' AND organizationId = 'org-123';

-- Add missing indexes
CREATE INDEX CONCURRENTLY idx_flags_lookup
ON featureFlag(key, organizationId)
WHERE enabled = true;
```

### Memory Usage

```typescript
// Monitor memory usage
const memUsage = process.memoryUsage();
console.log("Memory:", {
  rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
  heap: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
});

// Limit cache size
featureFlags({
  caching: {
    maxSize: 1000, // Limit entries
    maxMemory: 50 * 1024 * 1024, // 50MB limit
  },
});
```

## Security Issues

### Unauthorized Access

```typescript
// Verify authentication
app.use(async (req, res, next) => {
  const session = await auth.api.getSession(req);
  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  req.user = session.user;
  next();
});
```

### Data Leakage

```typescript
// Sanitize responses
featureFlags({
  security: {
    sanitizeOutput: true,
    excludeFields: ["internalNotes", "createdBy"],
  },
});
```

## Environment-Specific Issues

### Development vs Production

```typescript
// Environment-specific config
const config = {
  development: {
    storage: "memory",
    debug: true,
    mockEvaluations: true,
  },
  production: {
    storage: "database",
    caching: { enabled: true },
    audit: { enabled: true },
  },
};

featureFlags(config[process.env.NODE_ENV]);
```

### Docker/Container Issues

```dockerfile
# Ensure database is ready
HEALTHCHECK --interval=5s --timeout=3s --retries=5 \
  CMD node -e "require('./db').ping()" || exit 1
```

### Serverless/Edge Runtime

```typescript
// Optimize for cold starts
featureFlags({
  storage: "memory", // Faster init
  caching: {
    warmup: ["critical-flag"], // Preload
  },
});
```

## Getting Help

### Diagnostic Information

When reporting issues, include:

```typescript
// System info
console.log({
  version: packageJson.version,
  node: process.version,
  os: process.platform,
  env: process.env.NODE_ENV,
});

// Configuration
console.log("Config:", {
  storage: config.storage,
  caching: config.caching?.enabled,
  multiTenant: config.multiTenant?.enabled,
});

// Error details
console.error("Error:", {
  message: error.message,
  code: error.code,
  stack: error.stack,
});
```

### Support Channels

::: info Getting Support

- **GitHub Issues**: [Bug reports](https://github.com/better-auth/plugins/issues)
- **Discord**: [Community help](https://discord.gg/better-auth)
- **Documentation**: [Full docs](https://better-auth.com/plugins/feature-flags)
- **Stack Overflow**: Tag with `better-auth`
  :::

### Common Fixes Checklist

Before seeking help, try:

- [ ] Clear all caches
- [ ] Restart the application
- [ ] Check environment variables
- [ ] Run database migrations
- [ ] Update to latest version
- [ ] Check error logs
- [ ] Test in isolation
- [ ] Review recent changes

## FAQ

### Q: Why are my flags not updating in real-time?

**A**: Real-time updates require WebSocket connection (coming soon) or polling:

```typescript
featureFlagsClient({
  polling: {
    enabled: true,
    interval: 30000, // 30 seconds
  },
});
```

### Q: Can I use feature flags without authentication?

**A**: Yes, evaluate without user context:

```typescript
const result = await auth.api.evaluateFeatureFlag({
  body: {
    flagKey: "public-flag",
    context: { attributes: { anonymous: true } },
  },
});
```

### Q: How do I test different flag values?

**A**: Use local overrides or test utilities:

```typescript
// Development only - automatically blocked in production
if (process.env.NODE_ENV === "development") {
  client.featureFlags.setOverride("flag", true);
}

// Testing
mockFeatureFlag("flag", true);
```

::: tip Production Safety
Overrides are automatically disabled in production to prevent debug features from being exposed. They also expire after 1 hour by default.
:::

### Q: Why is my A/B test not distributing evenly?

**A**: Check variant weights and sample size:

```typescript
// Verify weights sum to 100
const totalWeight = variants.reduce((sum, v) => sum + v.weight, 0);
console.assert(totalWeight === 100);

// Need sufficient sample size
const evaluations = await getStats("test-flag");
console.log("Sample size:", evaluations.totalEvaluations);
```

### Q: How do I rollback a bad flag change?

**A**: Quick rollback options:

```typescript
// 1. Disable the flag
await updateFlag("flag-id", { enabled: false });

// 2. Reset to default
await updateFlag("flag-id", {
  rolloutPercentage: 0,
  rules: [],
});

// 3. Use audit log to restore
const lastGoodState = await getAuditEntry("last-known-good");
await updateFlag("flag-id", lastGoodState.previousValue);
```
