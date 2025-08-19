# Smart Polling Example

This example demonstrates the improved polling strategy with exponential backoff and jitter.

## Before: Naive Polling

```typescript
// Old implementation - Fixed interval, no error handling
setInterval(() => {
  refresh().catch(handleError);
}, 5000); // Always polls every 5 seconds
```

**Problems:**

- All clients poll at exact 5-second intervals → server spikes
- Continues hammering server during outages
- No recovery strategy

## After: Smart Polling

```typescript
// New implementation with SmartPoller
const poller = new SmartPoller(
  5000, // Base interval: 5 seconds
  async () => refresh(), // Task to execute
  (error) => console.error(error),
);

poller.start();
```

**Benefits:**

1. **Jitter**: Each poll is offset by 0-25% to spread load
2. **Exponential backoff**: On error, intervals increase: 5s → 10s → 20s → 40s...
3. **Recovery**: Returns to normal interval after successful poll
4. **Capped backoff**: Maximum interval is 50 seconds (10x base)

## Behavior During Server Issues

```
Time    | Status  | Next Poll Interval
--------|---------|-------------------
0:00    | ✅ OK   | 5s + jitter
0:05    | ❌ Fail | 10s + jitter (2x)
0:15    | ❌ Fail | 20s + jitter (4x)
0:35    | ❌ Fail | 40s + jitter (8x)
1:15    | ❌ Fail | 50s + jitter (capped)
2:05    | ✅ OK   | 5s + jitter (reset)
```

## Configuration

```typescript
const client = createAuthClient({
  plugins: [
    featureFlagsClient({
      polling: {
        enabled: true,
        interval: 30000, // 30 seconds base interval
      },
    }),
  ],
});
```

## Force Refresh

You can also trigger an immediate refresh when needed:

```typescript
// On network recovery or user action
await client.featureFlags.refresh();
```
