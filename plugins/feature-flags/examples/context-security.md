# Context Security Example

This example demonstrates how the SDK automatically protects against PII leakage.

## The Problem

Without sanitization, sensitive data could be accidentally sent to servers:

```typescript
// ❌ DANGEROUS: Without sanitization
authClient.featureFlags.setContext({
  userId: "user-123",
  password: userPassword, // Accidentally included!
  apiKey: process.env.API_KEY, // Oops!
  creditCard: paymentInfo.cardNumber, // Security breach!
  customData: {
    token: authToken, // Nested sensitive data
    ssn: userSSN,
  },
});
```

## The Solution

The SDK automatically sanitizes context data:

```typescript
// ✅ SAFE: Automatic sanitization
authClient.featureFlags.setContext({
  userId: "user-123",
  password: userPassword, // REMOVED automatically
  apiKey: process.env.API_KEY, // REMOVED automatically
  creditCard: paymentInfo.cardNumber, // REMOVED automatically
  customData: {
    token: authToken, // REMOVED automatically
    ssn: userSSN, // REMOVED automatically
  },
});

// What actually gets sent:
// { userId: "user-123" }
```

## How It Works

### 1. Forbidden Field Detection

The sanitizer removes fields with sensitive names:

- `password`, `token`, `apiKey`, `secret`
- `creditCard`, `ssn`, `bankAccount`
- `privateKey`, `refreshToken`, `accessToken`

### 2. Pattern Matching

Fields matching sensitive patterns are removed:

- `/password/i` - Any field containing "password"
- `/secret/i` - Any field containing "secret"
- `/token/i` - Any field containing "token"
- `/key/i` - Any field containing "key"

### 3. Strict Mode (Default)

Only whitelisted fields are allowed:

```typescript
// Default allowed fields
const allowedFields = [
  "userId",
  "organizationId",
  "teamId",
  "role",
  "plan",
  "device",
  "browser",
  "os",
  "platform",
  "version",
  "page",
  "route",
  "feature",
  "experiment",
  "country",
  "region",
  "environment",
];
```

### 4. Size Limits

Prevents oversized requests:

- URL parameters (GET): 2KB max
- Request body (POST): 10KB max

## Configuration Examples

### Allow Custom Fields

```typescript
featureFlagsClient({
  contextSanitization: {
    allowedFields: ["departmentId", "projectId", "customerId"],
  },
});

// Now these fields are allowed
authClient.featureFlags.setContext({
  userId: "user-123",
  departmentId: "dept-456", // Allowed
  projectId: "proj-789", // Allowed
  randomField: "value", // Still removed (not in allowlist)
});
```

### Disable Strict Mode

```typescript
featureFlagsClient({
  contextSanitization: {
    strict: false, // Allow any non-sensitive fields
  },
});

// Now custom fields are allowed (but sensitive ones still removed)
authClient.featureFlags.setContext({
  userId: "user-123",
  customField: "allowed", // Allowed
  anotherField: 42, // Allowed
  password: "secret", // Still removed (forbidden)
});
```

### Development Warnings

```typescript
featureFlagsClient({
  contextSanitization: {
    warnOnDrop: true, // Enable warnings in development
  },
});

// Console output:
// [feature-flags] Dropped context fields for security: password (forbidden), apiKey (sensitive pattern)
```

## Security Benefits

1. **PII Protection**: Prevents accidental exposure of personal data
2. **Credential Safety**: Blocks API keys and tokens from being sent
3. **Compliance**: Helps meet data protection regulations (GDPR, CCPA)
4. **Performance**: Prevents oversized requests that could fail
5. **Developer Safety**: Protects against common mistakes

## Testing

```typescript
// Validate context before sending
const warnings = ContextSanitizer.validate({
  userId: "user-123",
  password: "secret",
  apiKey: "key-123",
});

console.log(warnings);
// [
//   'Forbidden field "password" detected - will be removed',
//   'Potentially sensitive field "apiKey" detected - will be removed'
// ]
```

## Best Practices

1. **Never rely on client-side sanitization alone** - Always validate on the server
2. **Use environment-specific configuration** - Stricter in production
3. **Monitor dropped fields** - Review warnings to improve your context design
4. **Keep context minimal** - Only include necessary evaluation data
5. **Use type safety** - Define interfaces for your context structure
