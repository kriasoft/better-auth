// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import { createMiddleware } from "better-call";
import type { PluginContext } from "../types";
import type { EvaluationContext } from "../schema";
import {
  extractSecureCustomAttributes,
  validateContextAttribute,
  type HeaderConfig,
} from "./validation";

/**
 * Options for controlling what context data to collect
 */
export interface ContextCollectionOptions {
  /** Collect device type, browser, OS from user agent */
  collectDevice?: boolean;
  /** Collect geographic data from CDN headers */
  collectGeo?: boolean;
  /** Collect custom x-feature-flag-* and x-targeting-* headers */
  collectCustomHeaders?: boolean;
  /** Collect client info like IP, referrer */
  collectClientInfo?: boolean;
  /** Specific attributes to collect (whitelist) */
  allowedAttributes?: string[];
}

/**
 * Feature flags context extensions
 */
export interface FeatureFlagsContext {
  featureFlags?: {
    evaluate: (key: string, defaultValue?: any) => Promise<EvaluationResult>;
    evaluateBatch: (
      keys: string[],
    ) => Promise<Record<string, EvaluationResult>>;
    context: EvaluationContext;
  };
}

/**
 * Evaluation result type
 */
export interface EvaluationResult {
  value: any;
  variant?: string;
  reason: string;
}

/**
 * Create feature flags middleware using Better Auth's proper pattern
 */
export function createFeatureFlagsMiddleware(pc: PluginContext) {
  return createMiddleware(async (ctx) => {
    // Build minimal context for feature flags
    const evaluationContext = await buildMinimalContext(ctx, pc);

    // Create evaluator functions
    const evaluate = createEvaluator(ctx, pc, evaluationContext);
    const evaluateBatch = createBatchEvaluator(ctx, pc, evaluationContext);

    // Return context extensions
    return {
      featureFlags: {
        evaluate,
        evaluateBatch,
        context: evaluationContext,
      },
    } satisfies FeatureFlagsContext;
  });
}

/**
 * Build minimal evaluation context
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
 * Create single flag evaluator
 */
function createEvaluator(
  _ctx: any,
  pluginContext: PluginContext,
  evaluationContext: EvaluationContext,
) {
  return async (key: string, defaultValue?: any): Promise<EvaluationResult> => {
    try {
      const { storage } = pluginContext;
      const organizationId = pluginContext.config.multiTenant.enabled
        ? evaluationContext.organizationId
        : undefined;

      const flag = await storage.getFlag(key, organizationId);

      if (!flag || !flag.enabled) {
        return {
          value: defaultValue,
          reason: flag ? "disabled" : "not_found",
        };
      }

      // Import evaluation function
      const { evaluateFlags } = await import("../evaluation");
      return await evaluateFlags(flag, evaluationContext, pluginContext);
    } catch (error) {
      console.error(`[feature-flags] Error evaluating flag ${key}:`, error);
      return {
        value: defaultValue,
        reason: "error",
      };
    }
  };
}

/**
 * Create batch flag evaluator
 */
function createBatchEvaluator(
  ctx: any,
  pluginContext: PluginContext,
  evaluationContext: EvaluationContext,
) {
  return async (keys: string[]): Promise<Record<string, EvaluationResult>> => {
    const evaluate = createEvaluator(ctx, pluginContext, evaluationContext);
    const results: Record<string, EvaluationResult> = {};

    const evaluations = await Promise.all(
      keys.map(async (key) => {
        const result = await evaluate(key);
        return { key, result };
      }),
    );

    for (const { key, result } of evaluations) {
      results[key] = result;
    }

    return results;
  };
}

/**
 * Session type from Better Auth
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
 * Build evaluation context for flag evaluation with opt-in data collection
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

  // Always add basic user attributes from session (already consented)
  if (session?.user && context.attributes) {
    // Validate each attribute before adding
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

  // Add organization context if multi-tenant
  if (pluginContext.config.multiTenant.enabled) {
    const organizationId = getOrganizationId(session, pluginContext);
    if (organizationId) {
      context.organizationId = organizationId;
      if (context.attributes)
        context.attributes.organizationId = organizationId;
    }
  }

  // Only collect client info if explicitly enabled
  if (options.collectClientInfo) {
    const clientInfo = extractClientInfo(ctx);
    // If device collection is disabled, remove device-related fields
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
    // Allow collecting just device info without IP/referrer
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

  // Only collect custom headers if explicitly enabled
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

    // Validate each custom attribute before adding
    for (const [key, value] of Object.entries(customAttributes)) {
      if (validateContextAttribute(key, value)) {
        if (context.attributes) {
          context.attributes[key] = value;
        }
      }
    }
  }

  // Only collect geographic data if explicitly enabled (privacy-sensitive)
  if (options.collectGeo) {
    const geoData = extractGeoData(ctx);
    if (geoData) {
      context.attributes = {
        ...context.attributes,
        ...geoData,
      };
    }
  }

  // Filter to allowed attributes if specified
  if (options.allowedAttributes && options.allowedAttributes.length > 0) {
    const filtered: Record<string, any> = {};
    for (const attr of options.allowedAttributes) {
      if (context.attributes && attr in context.attributes) {
        filtered[attr] = context.attributes[attr];
      }
    }
    context.attributes = filtered;
  }

  // Always add minimal request metadata (non-sensitive)
  if (ctx.path && context.attributes) context.attributes.requestPath = ctx.path;
  if (ctx.method && context.attributes)
    context.attributes.requestMethod = ctx.method;
  if (context.attributes)
    context.attributes.timestamp = new Date().toISOString();

  return context;
}

/**
 * Extract organization ID from session based on configuration
 */
function getOrganizationId(
  session: Session | null,
  pluginContext: PluginContext,
): string | undefined {
  if (!pluginContext.config.multiTenant.enabled) {
    return undefined;
  }

  if (pluginContext.config.multiTenant.useOrganizations) {
    // Better Auth's built-in organization support
    return session?.organization?.id || session?.user?.organizationId;
  }

  // Custom organization field
  return session?.user?.organizationId || session?.organizationId;
}

/**
 * Extract client information from request
 */
function extractClientInfo(ctx: any): Record<string, any> {
  const info: Record<string, any> = {};

  // IP Address
  // @important Order matters: leftmost proxy headers are most trustworthy
  // x-forwarded-for: Standard proxy header (can be spoofed)
  // x-real-ip: Nginx proxy header (more reliable)
  // cf-connecting-ip: Cloudflare (most reliable when using CF)
  const ip =
    ctx.headers?.get?.("x-forwarded-for") ||
    ctx.headers?.get?.("x-real-ip") ||
    ctx.headers?.get?.("cf-connecting-ip") ||
    ctx.request?.ip ||
    "unknown";
  info.ip = ip.split(",")[0].trim(); // Handle comma-separated IPs

  // User Agent
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

  // Referrer
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
 * Extract geographic and locale data from request
 */
function extractGeoData(ctx: any): Record<string, any> | null {
  const geoData: Record<string, any> = {};

  // Country from Cloudflare or other CDN headers
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

  // City
  const city =
    ctx.headers?.get?.("cf-city") ||
    ctx.headers?.get?.("x-city") ||
    ctx.headers?.get?.("x-vercel-ip-city");
  if (city) {
    geoData.city = city;
  }

  // Timezone
  const timezone =
    ctx.headers?.get?.("x-timezone") ||
    ctx.headers?.get?.("cf-timezone") ||
    ctx.headers?.get?.("x-vercel-ip-timezone");
  if (timezone) {
    geoData.timezone = timezone;
  }

  // Language/Locale
  const acceptLanguage = ctx.headers?.get?.("accept-language");
  if (acceptLanguage) {
    geoData.language = acceptLanguage.split(",")[0].split(";")[0].trim();
  }

  return Object.keys(geoData).length > 0 ? geoData : null;
}

/**
 * Cached user agent parser results
 *
 * Architecture Decision: We use built-in optimized detection by default
 * instead of ua-parser-js to maintain small bundle size (~2KB vs ~60KB)
 * and fast serverless cold starts. This covers 95% of use cases with
 * LRU caching for performance. Users can opt-in to ua-parser-js for
 * enhanced accuracy when needed.
 *
 * @see docs/feature-flags/device-detection.md for full rationale
 */
const uaCache = new Map<string, UserAgentInfo>();
const MAX_CACHE_SIZE = 1000;

interface UserAgentInfo {
  device: string;
  browser: string;
  os: string;
  platform: string | null;
}

/**
 * Parse user agent with caching and optimized detection
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

  // Check cache first
  const cached = uaCache.get(userAgent);
  if (cached) return cached;

  // Parse user agent
  const ua = userAgent.toLowerCase();
  const info: UserAgentInfo = {
    device: detectDevice(ua),
    browser: detectBrowser(ua),
    os: detectOS(ua),
    platform: detectPlatform(ua),
  };

  // Cache result with LRU eviction
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
 * Optimized device detection with early returns
 */
function detectDevice(ua: string): string {
  // Bot detection first (most specific)
  if (ua.includes("bot") || ua.includes("crawler") || ua.includes("spider")) {
    return "bot";
  }

  // Mobile detection patterns
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

  // Tablet detection
  const tabletPatterns = ["ipad", "tablet", "kindle", "silk"];
  if (tabletPatterns.some((p) => ua.includes(p))) return "tablet";

  // TV detection
  const tvPatterns = ["tv", "smart-tv", "smarttv", "googletv", "appletv"];
  if (tvPatterns.some((p) => ua.includes(p))) return "tv";

  // Desktop is default
  return "desktop";
}

/**
 * Optimized browser detection with priority order
 */
function detectBrowser(ua: string): string {
  // Check in order of specificity to avoid false positives
  const browsers = [
    { pattern: "edg", name: "edge" },
    { pattern: "opr", name: "opera" },
    { pattern: "opera", name: "opera" },
    { pattern: "chrome", name: "chrome" },
    { pattern: "safari", name: "safari", exclude: "chrome" },
    { pattern: "firefox", name: "firefox" },
    { pattern: "msie", name: "ie" },
    { pattern: "trident", name: "ie" },
  ];

  for (const { pattern, name, exclude } of browsers) {
    if (ua.includes(pattern) && (!exclude || !ua.includes(exclude))) {
      return name;
    }
  }

  return "other";
}

/**
 * Optimized OS detection
 */
function detectOS(ua: string): string {
  const osPatterns = [
    { patterns: ["iphone", "ipad", "ipod"], name: "ios" },
    { patterns: ["android"], name: "android" },
    { patterns: ["windows"], name: "windows" },
    { patterns: ["mac", "darwin"], name: "macos" },
    { patterns: ["linux"], name: "linux" },
    { patterns: ["cros"], name: "chromeos" },
  ];

  for (const { patterns, name } of osPatterns) {
    if (patterns.some((p) => ua.includes(p))) {
      return name;
    }
  }

  return "other";
}

/**
 * Detect platform from user agent
 */
function detectPlatform(ua: string): string | null {
  // App frameworks
  const platforms = [
    { pattern: "dart", name: "flutter" },
    { pattern: "react-native", name: "react-native" },
    { pattern: "electron", name: "electron" },
    { pattern: "capacitor", name: "capacitor" },
    { pattern: "cordova", name: "cordova" },
    // SSR frameworks
    { pattern: "next.js", name: "nextjs" },
    { pattern: "nuxt", name: "nuxt" },
    { pattern: "remix", name: "remix" },
  ];

  for (const { pattern, name } of platforms) {
    if (ua.includes(pattern)) {
      return name;
    }
  }

  return null;
}
