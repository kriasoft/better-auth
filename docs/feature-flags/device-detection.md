# Device Detection in Feature Flags

The Better Auth Feature Flags plugin includes built-in device detection for targeting rules. This allows you to show or hide features based on device type, browser, OS, and platform.

## Overview

Device detection is **disabled by default** for privacy and performance. When enabled, it uses an optimized built-in parser with LRU caching for fast performance.

## Basic Usage

```typescript
import { featureFlags } from "better-auth-feature-flags";

const auth = betterAuth({
  plugins: [
    featureFlags({
      // Enable device detection
      contextCollection: {
        collectDevice: true,
      },
    }),
  ],
});
```

## Detected Attributes

When device detection is enabled, the following attributes are available for targeting:

- **device**: `mobile`, `tablet`, `desktop`, `tv`, `bot`
- **browser**: `chrome`, `safari`, `firefox`, `edge`, `opera`, `ie`, `other`
- **os**: `ios`, `android`, `windows`, `macos`, `linux`, `chromeos`, `other`
- **platform**: `flutter`, `react-native`, `electron`, `capacitor`, `cordova`, `nextjs`, `nuxt`, `remix`

## Performance Optimization

The built-in detection is optimized for performance:

- **LRU Cache**: Caches up to 1000 parsed user agents
- **Early Returns**: Checks most specific patterns first
- **Pattern Arrays**: Efficient string matching
- **Single Parse**: All attributes extracted in one pass

### Benchmarks

| Operation   | Time    | Notes                      |
| ----------- | ------- | -------------------------- |
| First parse | ~0.1ms  | Initial user agent parsing |
| Cache hit   | ~0.01ms | Subsequent requests        |
| Bundle size | +2KB    | Minimal overhead           |

## Enhanced Detection (Optional)

For more accurate device detection, you can use `ua-parser-js`:

### Installation

```bash
bun add ua-parser-js
```

### Configuration

```typescript
import { featureFlags } from "better-auth-feature-flags";

const auth = betterAuth({
  plugins: [
    featureFlags({
      contextCollection: {
        collectDevice: true,
        // Enhanced UA parsing can be enabled when ua-parser-js is installed
        useEnhancedUA: true, // Requires ua-parser-js package
      },
    }),
  ],
});
```

### Enhanced Attributes

With `ua-parser-js`, you also get:

- **browserVersion**: Specific browser version
- **osVersion**: Operating system version
- **deviceVendor**: Device manufacturer
- **deviceModel**: Specific device model

## Targeting Examples

### Mobile-Only Feature

```typescript
const mobileFeature = await auth.api.featureFlags.create({
  key: "mobile-app-banner",
  enabled: true,
  rules: [
    {
      conditions: [
        {
          attribute: "device",
          operator: "equals",
          value: "mobile",
        },
      ],
      value: true,
    },
  ],
  defaultValue: false,
});
```

### Browser-Specific CSS

```typescript
const cssFeature = await auth.api.featureFlags.create({
  key: "safari-workaround",
  enabled: true,
  rules: [
    {
      conditions: [
        {
          attribute: "browser",
          operator: "equals",
          value: "safari",
        },
      ],
      value: true,
    },
  ],
  defaultValue: false,
});
```

### Platform Detection

```typescript
const nativeFeature = await auth.api.featureFlags.create({
  key: "native-features",
  enabled: true,
  rules: [
    {
      conditions: [
        {
          attribute: "platform",
          operator: "in",
          value: ["flutter", "react-native", "electron"],
        },
      ],
      value: true,
    },
  ],
  defaultValue: false,
});
```

## Privacy Considerations

Device detection is **opt-in** to respect user privacy:

```typescript
featureFlags({
  contextCollection: {
    collectDevice: false, // Default - no device data collected
    collectClientInfo: false, // Don't collect IP, referrer
    collectGeo: false, // Don't collect geographic data
  },
});
```

## Architecture Decision

We chose built-in detection over always using `ua-parser-js` because:

1. **Bundle Size**: 2KB vs 60KB impact
2. **Serverless**: Faster cold starts
3. **Coverage**: 95% accuracy for common cases
4. **Optional**: Device detection often not needed

See [Architecture Decision Record](./adrs/01-device-detection.md) for detailed rationale.

## Custom Headers

You can override detection with custom headers:

```typescript
// Client sends custom platform header
fetch("/api/feature-flags", {
  headers: {
    "x-platform": "custom-app",
  },
});
```

## Caching Strategy

The detection system uses a two-tier cache:

1. **Built-in**: LRU cache (1000 entries, no TTL)
2. **Enhanced**: TTL cache (1000 entries, 60-minute TTL)

This prevents re-parsing the same user agents repeatedly.

## Troubleshooting

### Detection Not Working

1. Ensure `collectDevice: true` is set
2. Check user agent is being sent by client
3. Verify cache isn't serving stale data

### Wrong Detection

1. Consider using enhanced detection
2. Check for custom headers overriding
3. Submit issue with user agent string

### Performance Issues

1. Check cache size isn't too large
2. Consider disabling unused collection
3. Use server-side evaluation only

## See Also

- [Configuration Guide](./configuration.md#privacy--context-collection) - Context collection settings
- [API Reference](./api-reference.md) - Complete API documentation
- [Troubleshooting Guide](./troubleshooting.md) - Common issues and solutions
