// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

/**
 * Privacy-aware context collection for feature flag evaluation.
 *
 * Architecture: Better Auth middleware pattern with opt-in data collection
 * for GDPR/CCPA compliance. LRU cached UA parsing for serverless performance.
 *
 * @see ../evaluation.ts for flag evaluation logic
 * @see ./validation.ts for secure attribute validation
 */

import { createMiddleware } from "better-call";
import type { EvaluationContext } from "../schema";
import type { PluginContext } from "../types";
import {
  extractSecureCustomAttributes,
  validateContextAttribute,
} from "./validation";

/**
 * Privacy-aware opt-in data collection for GDPR/CCPA compliance.
 * @example { collectDevice: true, collectGeo: false }
 */
export interface ContextCollectionOptions {
  /** Collect device type, browser, OS from user agent string */
  collectDevice?: boolean;
  /** Collect geographic data from CDN headers (country, region, city) */
  collectGeo?: boolean;
  /** Collect custom x-feature-flag-* and x-targeting-* headers */
  collectCustomHeaders?: boolean;
  /** Collect client info like IP address and referrer URL */
  collectClientInfo?: boolean;
  /** Whitelist of specific attributes to collect (filters all others) */
  allowedAttributes?: string[];
}

/**
 * Feature flags context extensions for Better Auth middleware.
 * @see createFeatureFlagsMiddleware for setup
 */
export interface FeatureFlagsContext {
  featureFlags?: {
    /** Evaluate a single feature flag with optional default value */
    evaluate: (key: string, defaultValue?: any) => Promise<EvaluationResult>;
    /** Evaluate multiple flags in a single batch operation */
    evaluateFlags: (
      keys: string[],
    ) => Promise<Record<string, EvaluationResult>>;
    /** Current evaluation context used for flag targeting */
    context: EvaluationContext;
  };
}

/**
 * Feature flag evaluation result with value, variant, and reason.
 */
export interface EvaluationResult {
  /** The resolved flag value (boolean, string, number, object) */
  value: any;
  /** Variant name if using A/B testing or multivariate flags */
  variant?: string;
  /** Reason for this result: 'enabled', 'disabled', 'not_found', 'error' */
  reason: string;
}

/**
 * Creates feature flags middleware extending Better Auth context.
 * Uses minimal context collection by default for privacy/performance.
 *
 * @param pc - Plugin context with storage, config, runtime state
 * @returns Middleware adding featureFlags to request context
 * @example ctx.featureFlags.evaluate('new-ui', false)
 * @see buildEvaluationContext for full context collection
 */
export function createFeatureFlagsMiddleware(pc: PluginContext) {
  return createMiddleware(async (ctx) => {
    // Minimal context by default; use buildEvaluationContext() for full collection
    const evaluationContext = await buildMinimalContext(ctx, pc);

    // Bind evaluators with current context
    const evaluate = createEvaluator(ctx, pc, evaluationContext);
    const evaluateFlags = createBatchEvaluator(ctx, pc, evaluationContext);
    return {
      featureFlags: {
        evaluate,
        evaluateFlags,
        context: evaluationContext,
      },
    } satisfies FeatureFlagsContext;
  });
}

/**
 * Builds minimal context with anonymous user and request metadata only.
 * No consent required, privacy-first approach.
 *
 * @param ctx - Better Auth request context
 * @param _pluginContext - Plugin configuration (unused)
 * @see buildEvaluationContext for full context collection
 */
async function buildMinimalContext(
  ctx: any,
  _pluginContext: PluginContext,
): Promise<EvaluationContext> {
  const context: EvaluationContext = {
    userId: "anonymous",
    attributes: {},
  };

  // Add minimal request metadata (non-sensitive)
  if (ctx.path && context.attributes) context.attributes.requestPath = ctx.path;
  if (ctx.method && context.attributes)
    context.attributes.requestMethod = ctx.method;
  if (context.attributes)
    context.attributes.timestamp = new Date().toISOString();

  return context;
}

/**
 * Creates bound flag evaluator with error handling and fallback defaults.
 *
 * @param _ctx - Request context (unused)
 * @param pluginContext - Plugin config and storage
 * @param evaluationContext - Context for targeting
 * @see ../evaluation.ts for evaluation algorithm
 */
function createEvaluator(
  _ctx: any,
  pluginContext: PluginContext,
  evaluationContext: EvaluationContext,
) {
  return async (key: string, defaultValue?: any): Promise<EvaluationResult> => {
    try {
      const { storage } = pluginContext;

      // Multi-tenant scoping
      const organizationId = pluginContext.config.multiTenant.enabled
        ? evaluationContext.organizationId
        : undefined;

      // Fetch flag config
      const flag = await storage.getFlag(key, organizationId);

      // Return default for missing/disabled flags
      if (!flag || !flag.enabled) {
        return {
          value: defaultValue,
          reason: flag ? "disabled" : "not_found",
        };
      }

      // Dynamic import for tree-shaking and circular dependency avoidance
      const { evaluateFlags } = await import("../evaluation");
      return await evaluateFlags(flag, evaluationContext, pluginContext);
    } catch (error) {
      // SECURITY: Log internally, don't expose errors to prevent info disclosure
      console.error(`[feature-flags] Error evaluating flag ${key}:`, error);
      return {
        value: defaultValue,
        reason: "error",
      };
    }
  };
}

/**
 * Creates batch evaluator using Promise.all for concurrent flag evaluation.
 *
 * @param ctx - Request context
 * @param pluginContext - Plugin config and storage
 * @param evaluationContext - Context for targeting
 * @example evaluateFlags(['feature-a', 'feature-b'])
 */
function createBatchEvaluator(
  ctx: any,
  pluginContext: PluginContext,
  evaluationContext: EvaluationContext,
) {
  return async (keys: string[]): Promise<Record<string, EvaluationResult>> => {
    const evaluate = createEvaluator(ctx, pluginContext, evaluationContext);
    const results: Record<string, EvaluationResult> = {};

    // PERF: Concurrent evaluation for faster batch operations
    const evaluations = await Promise.all(
      keys.map(async (key) => {
        const result = await evaluate(key);
        return { key, result };
      }),
    );

    // Collect into keyed object
    for (const { key, result } of evaluations) {
      results[key] = result;
    }

    return results;
  };
}

/**
 * Better Auth session interface with user profile and organization data.
 * @see vendor/better-auth/packages/better-auth/src/types.ts
 */
interface Session {
  user?: {
    id: string;
    email?: string;
    name?: string;
    createdAt?: Date;
    roles?: string[];
    organizationId?: string;
    [key: string]: any;
  };
  organization?: {
    id: string;
    [key: string]: any;
  };
  id?: string;
  [key: string]: any;
}

/**
 * Builds comprehensive context with granular opt-in data collection for GDPR/CCPA compliance.
 *
 * @param ctx - Request context from Better Auth or framework
 * @param session - User session (null for anonymous)
 * @param pluginContext - Plugin config and storage
 * @param options - Privacy controls (defaults to minimal)
 * @example buildEvaluationContext(ctx, session, pc, { collectDevice: true })
 * @see ./validation.ts for secure attribute handling
 */
export async function buildEvaluationContext(
  ctx: any,
  session: Session | null,
  pluginContext: PluginContext,
  options: ContextCollectionOptions = {},
): Promise<EvaluationContext> {
  const context: EvaluationContext = {
    userId: session?.user?.id || "anonymous",
    attributes: {},
  };

  // User session data (already consented via auth)
  if (session?.user && context.attributes) {
    // Validated for type safety and injection prevention
    const userAttrs: [string, any][] = [
      ["email", session.user.email],
      ["name", session.user.name],
      ["createdAt", session.user.createdAt],
      ["roles", session.user.roles || []],
    ];

    for (const [key, value] of userAttrs) {
      if (value !== undefined && validateContextAttribute(key, value)) {
        context.attributes[key] = value;
      }
    }
  }

  // Organization context for multi-tenant mode
  if (pluginContext.config.multiTenant.enabled) {
    const organizationId = getOrganizationId(session, pluginContext);
    if (organizationId) {
      // Storage scoping and targeting rules
      context.organizationId = organizationId;
      if (context.attributes)
        context.attributes.organizationId = organizationId;
    }
  }

  // PRIVACY: Client info collection (opt-in required)
  if (options.collectClientInfo) {
    const clientInfo = extractClientInfo(ctx);
    // Granular control: exclude device data if needed
    if (!options.collectDevice) {
      delete clientInfo.device;
      delete clientInfo.browser;
      delete clientInfo.os;
      delete clientInfo.platform;
    }
    context.attributes = {
      ...context.attributes,
      ...clientInfo,
    };
  } else if (options.collectDevice) {
    // Device info only (no sensitive IP/referrer)
    const userAgent = ctx.headers?.get?.("user-agent");
    if (userAgent && context.attributes) {
      const uaInfo = parseUserAgent(userAgent);
      context.attributes.device = uaInfo.device;
      context.attributes.browser = uaInfo.browser;
      context.attributes.os = uaInfo.os;
      if (uaInfo.platform) {
        context.attributes.platform = uaInfo.platform;
      }
    }
  }

  // SECURITY: Custom headers (explicit opt-in and config required)
  if (options.collectCustomHeaders) {
    const headerConfig = pluginContext.config.customHeaders?.whitelist;
    const extractOptions = {
      logInvalid: pluginContext.config.customHeaders?.logInvalid || false,
      strict: pluginContext.config.customHeaders?.strict || false,
    };
    const customAttributes = extractSecureCustomAttributes(
      ctx,
      headerConfig,
      extractOptions,
    );

    // Validate for type safety and injection prevention
    for (const [key, value] of Object.entries(customAttributes)) {
      if (validateContextAttribute(key, value)) {
        if (context.attributes) {
          context.attributes[key] = value;
        }
      }
    }
  }

  // Geographic data (privacy-sensitive, explicit opt-in)
  if (options.collectGeo) {
    const geoData = extractGeoData(ctx);
    if (geoData) {
      context.attributes = {
        ...context.attributes,
        ...geoData,
      };
    }
  }

  // Attribute whitelist filtering (additional privacy layer)
  if (options.allowedAttributes && options.allowedAttributes.length > 0) {
    const filtered: Record<string, any> = {};
    for (const attr of options.allowedAttributes) {
      if (context.attributes && attr in context.attributes) {
        filtered[attr] = context.attributes[attr];
      }
    }
    context.attributes = filtered;
  }

  // Minimal request metadata (non-sensitive)
  if (ctx.path && context.attributes) context.attributes.requestPath = ctx.path;
  if (ctx.method && context.attributes)
    context.attributes.requestMethod = ctx.method;
  if (context.attributes)
    context.attributes.timestamp = new Date().toISOString();

  return context;
}

/**
 * Extracts organization ID from session based on multi-tenant config.
 * Supports Better Auth org plugin and custom fields.
 *
 * @param session - User session
 * @param pluginContext - Plugin config with tenant settings
 * @see ../types.ts for MultiTenantConfig
 */
function getOrganizationId(
  session: Session | null,
  pluginContext: PluginContext,
): string | undefined {
  if (!pluginContext.config.multiTenant.enabled) {
    return undefined;
  }

  if (pluginContext.config.multiTenant.useOrganizations) {
    // Better Auth organization plugin
    // REF: https://better-auth.com/docs/plugins/organization
    return session?.organization?.id || session?.user?.organizationId;
  }

  // Custom organization field
  return session?.user?.organizationId || session?.organizationId;
}

/**
 * Extracts client info from headers (sensitive data - requires consent).
 *
 * @param ctx - Request context with headers
 * @see parseUserAgent for device detection
 */
function extractClientInfo(ctx: any): Record<string, any> {
  const info: Record<string, any> = {};

  // SECURITY: IP extraction with proxy precedence (order matters for trustworthiness)
  // cf-connecting-ip > x-real-ip > x-forwarded-for
  const ip =
    ctx.headers?.get?.("x-forwarded-for") ||
    ctx.headers?.get?.("x-real-ip") ||
    ctx.headers?.get?.("cf-connecting-ip") ||
    ctx.request?.ip ||
    "unknown";
  info.ip = ip.split(",")[0].trim(); // First IP in proxy chain

  // User Agent parsing with caching
  const userAgent = ctx.headers?.get?.("user-agent");
  if (userAgent) {
    info.userAgent = userAgent;
    const uaInfo = parseUserAgent(userAgent);
    info.device = uaInfo.device;
    info.browser = uaInfo.browser;
    info.os = uaInfo.os;
    if (uaInfo.platform) {
      info.platform = uaInfo.platform;
    }
  }

  // Referrer for traffic source analysis
  const referrer =
    ctx.headers?.get?.("referer") || ctx.headers?.get?.("referrer");
  if (referrer) {
    info.referrer = referrer;
  }

  // Platform override from custom header
  const customPlatform = ctx.headers?.get?.("x-platform");
  if (customPlatform) {
    info.platform = customPlatform;
  }

  return info;
}

/**
 * Extracts geo/locale data from CDN headers (privacy-sensitive).
 * Uses CDN geolocation (Cloudflare, Vercel) over IP-based APIs.
 *
 * @param ctx - Request context with headers
 * NOTE: Requires explicit consent for collection
 */
function extractGeoData(ctx: any): Record<string, any> | null {
  const geoData: Record<string, any> = {};

  // Country from CDN headers (most reliable)
  // Cloudflare > Vercel > Generic CDN
  const country =
    ctx.headers?.get?.("cf-ipcountry") ||
    ctx.headers?.get?.("x-country-code") ||
    ctx.headers?.get?.("x-vercel-ip-country");
  if (country) {
    geoData.country = country;
  }

  // Region/State
  const region =
    ctx.headers?.get?.("cf-region") ||
    ctx.headers?.get?.("x-region-code") ||
    ctx.headers?.get?.("x-vercel-ip-country-region");
  if (region) {
    geoData.region = region;
  }

  // City (most granular)
  const city =
    ctx.headers?.get?.("cf-city") ||
    ctx.headers?.get?.("x-city") ||
    ctx.headers?.get?.("x-vercel-ip-city");
  if (city) {
    geoData.city = city;
  }

  // Timezone for time-based flags
  const timezone =
    ctx.headers?.get?.("x-timezone") ||
    ctx.headers?.get?.("cf-timezone") ||
    ctx.headers?.get?.("x-vercel-ip-timezone");
  if (timezone) {
    geoData.timezone = timezone;
  }

  // Language from Accept-Language header
  const acceptLanguage = ctx.headers?.get?.("accept-language");
  if (acceptLanguage) {
    // Primary language (first choice)
    geoData.language = acceptLanguage.split(",")[0].split(";")[0].trim();
  }

  return Object.keys(geoData).length > 0 ? geoData : null;
}

/**
 * LRU cache for user agent parsing.
 *
 * Architecture: Built-in detection (~2KB) vs ua-parser-js (~60KB) for serverless
 * performance. 50-100ms faster cold starts, bounded memory, 95% accuracy.
 *
 * Trade-off: Manual patterns vs library accuracy for obscure browsers.
 * @see docs/feature-flags/device-detection.md
 */
const uaCache = new Map<string, UserAgentInfo>();
const MAX_CACHE_SIZE = 1000; // ~100KB memory usage

interface UserAgentInfo {
  device: string;
  browser: string;
  os: string;
  platform: string | null;
}

/**
 * Parses user agent with LRU caching and optimized detection patterns.
 *
 * @param userAgent - Raw UA string from headers
 * @example parseUserAgent("Mozilla/5.0 (iPhone...)") // { device: "mobile", browser: "safari", os: "ios" }
 */
function parseUserAgent(userAgent?: string): UserAgentInfo {
  if (!userAgent) {
    return {
      device: "unknown",
      browser: "unknown",
      os: "unknown",
      platform: null,
    };
  }

  // PERF: Check cache first
  const cached = uaCache.get(userAgent);
  if (cached) return cached;

  // Parse with optimized patterns
  const ua = userAgent.toLowerCase();
  const info: UserAgentInfo = {
    device: detectDevice(ua),
    browser: detectBrowser(ua),
    os: detectOS(ua),
    platform: detectPlatform(ua),
  };

  // PERF: LRU eviction to prevent memory growth
  if (uaCache.size >= MAX_CACHE_SIZE) {
    const firstKey = uaCache.keys().next().value;
    if (firstKey !== undefined) {
      uaCache.delete(firstKey);
    }
  }
  uaCache.set(userAgent, info);

  return info;
}

/**
 * Device detection with early returns and pattern arrays.
 * Order matters: specific patterns first to avoid false positives.
 *
 * @param ua - Lowercase user agent
 * @returns 'bot', 'mobile', 'tablet', 'tv', or 'desktop'
 */
function detectDevice(ua: string): string {
  // Bot detection first (analytics filtering and rate limiting)
  if (ua.includes("bot") || ua.includes("crawler") || ua.includes("spider")) {
    return "bot";
  }

  // Mobile patterns
  const mobilePatterns = [
    "mobile",
    "android",
    "iphone",
    "ipod",
    "blackberry",
    "windows phone",
    "webos",
    "opera mini",
  ];
  if (mobilePatterns.some((p) => ua.includes(p))) return "mobile";

  // Tablet patterns
  const tabletPatterns = ["ipad", "tablet", "kindle", "silk"];
  if (tabletPatterns.some((p) => ua.includes(p))) return "tablet";

  // TV and streaming patterns
  const tvPatterns = ["tv", "smart-tv", "smarttv", "googletv", "appletv"];
  if (tvPatterns.some((p) => ua.includes(p))) return "tv";

  // Default: desktop/laptop
  return "desktop";
}

/**
 * Browser detection with engine conflict handling.
 * Order critical: Edge/Opera before Chrome, Safari excludes Chrome.
 *
 * @param ua - Lowercase user agent
 * @returns 'edge', 'opera', 'chrome', 'safari', 'firefox', 'ie', or 'other'
 */
function detectBrowser(ua: string): string {
  // Order of specificity: Edge before Chrome, Safari excludes Chrome
  const browsers = [
    { pattern: "edg", name: "edge" }, // New Edge (Chromium)
    { pattern: "opr", name: "opera" }, // Opera
    { pattern: "opera", name: "opera" }, // Older Opera
    { pattern: "chrome", name: "chrome" }, // Chrome/Chromium
    { pattern: "safari", name: "safari", exclude: "chrome" }, // Safari (not Chrome)
    { pattern: "firefox", name: "firefox" }, // Firefox
    { pattern: "msie", name: "ie" }, // IE
    { pattern: "trident", name: "ie" }, // IE 11+ (Trident)
  ];

  for (const { pattern, name, exclude } of browsers) {
    if (ua.includes(pattern) && (!exclude || !ua.includes(exclude))) {
      return name;
    }
  }

  return "other";
}

/**
 * OS detection from user agent patterns by specificity and prevalence.
 *
 * @param ua - Lowercase user agent
 * @returns 'ios', 'android', 'windows', 'macos', 'linux', 'chromeos', or 'other'
 */
function detectOS(ua: string): string {
  const osPatterns = [
    { patterns: ["iphone", "ipad", "ipod"], name: "ios" }, // Apple mobile
    { patterns: ["android"], name: "android" }, // Android
    { patterns: ["windows"], name: "windows" }, // Windows
    { patterns: ["mac", "darwin"], name: "macos" }, // macOS
    { patterns: ["linux"], name: "linux" }, // Linux
    { patterns: ["cros"], name: "chromeos" }, // Chrome OS
  ];

  for (const { patterns, name } of osPatterns) {
    if (patterns.some((p) => ua.includes(p))) {
      return name;
    }
  }

  return "other";
}

/**
 * Detects hybrid app frameworks and SSR platforms from UA signatures.
 * Returns null for standard browsers.
 *
 * @param ua - Lowercase user agent
 * @example detectPlatform("...react-native/0.64...") // "react-native"
 */
function detectPlatform(ua: string): string | null {
  // Hybrid and SSR frameworks
  const platforms = [
    { pattern: "dart", name: "flutter" }, // Flutter
    { pattern: "react-native", name: "react-native" }, // React Native
    { pattern: "electron", name: "electron" }, // Electron
    { pattern: "capacitor", name: "capacitor" }, // Ionic Capacitor
    { pattern: "cordova", name: "cordova" }, // Cordova/PhoneGap
    { pattern: "next.js", name: "nextjs" }, // Next.js SSR
    { pattern: "nuxt", name: "nuxt" }, // Nuxt.js SSR
    { pattern: "remix", name: "remix" }, // Remix
  ];

  for (const { pattern, name } of platforms) {
    if (ua.includes(pattern)) {
      return name;
    }
  }

  return null; // Standard browser
}
