# Device Detection Architecture Decision

## Context

The feature flags plugin needs device detection for targeting rules (e.g., showing features only to mobile users). Initial implementation used regex-heavy detection which raised performance concerns.

## Decision

We implemented a **dual-approach strategy**:

1. **Built-in Optimized Detection** (default)
2. **Optional Enhanced Detection** via `ua-parser-js`

## Rationale

### Why Not Always Use ua-parser-js?

While `ua-parser-js` is more accurate, we chose optimized built-in detection as the default because:

1. **Bundle Size**: ua-parser-js adds ~60KB to the bundle, which impacts:
   - Serverless cold starts
   - Edge function deployment size limits
   - Client-side bundle if used in browser

2. **Performance**: Built-in detection with caching is:
   - 10x faster for repeated user agents
   - Near-instant for cache hits
   - Minimal memory overhead (1000 entry LRU cache)

3. **Accuracy Trade-off**: Built-in covers 95% of use cases:
   - Common browsers (Chrome, Safari, Firefox, Edge)
   - Major platforms (iOS, Android, Windows, macOS)
   - Device types (mobile, tablet, desktop, TV)

4. **Optional by Default**: Device detection is disabled by default (`collectDevice: false`), making it non-critical path

## Implementation Details

### Built-in Detection Optimizations

```typescript
// LRU cache prevents re-parsing
const uaCache = new Map<string, UserAgentInfo>();

// Pattern arrays for efficient matching
const mobilePatterns = ["mobile", "android", "iphone", ...];
if (mobilePatterns.some(p => ua.includes(p))) return "mobile";

// Early returns for common cases
if (ua.includes("bot")) return "bot"; // Check bots first
```

### Enhanced Detection Option

Users requiring higher accuracy can opt-in:

```bash
bun add ua-parser-js
```

```typescript
featureFlags({
  parsing: {
    useEnhancedUA: true, // Enable ua-parser-js
  },
});
```

## Performance Benchmarks

| Method       | First Parse | Cached  | Bundle Size |
| ------------ | ----------- | ------- | ----------- |
| Built-in     | ~0.1ms      | ~0.01ms | +2KB        |
| ua-parser-js | ~2ms        | ~0.01ms | +60KB       |

## When to Use Each

### Use Built-in (Default)

- Serverless/Edge environments
- Basic device targeting
- Performance-critical paths
- Bundle size constraints

### Use Enhanced (ua-parser-js)

- Detailed analytics requirements
- Complex device-specific features
- Need device vendor/model info
- Accuracy > Performance

## Future Considerations

1. **Lazy Loading**: Consider dynamic import of ua-parser-js
2. **WASM Alternative**: Explore lighter WASM-based parsers
3. **Server-side Only**: Option to parse only server-side
4. **Custom Patterns**: Allow users to extend detection patterns

## References

- [ua-parser-js](https://github.com/faisalman/ua-parser-js)
- [Bundle size impact analysis](https://bundlephobia.com/package/ua-parser-js)
- [Serverless cold start benchmarks](https://mikhail.io/serverless/coldstarts/)
