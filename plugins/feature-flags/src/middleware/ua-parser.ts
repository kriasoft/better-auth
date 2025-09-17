// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

/**
 * Optional ua-parser-js integration for enhanced device detection.
 * Falls back to built-in parsing when peer dependency not installed.
 *
 * @example featureFlags({ parsing: { useEnhancedUA: true } })
 * @see https://www.npmjs.com/package/ua-parser-js
 */

let UAParser: any;

// Dynamic import: graceful fallback when peer dependency missing
try {
  UAParser = require("ua-parser-js");
} catch {
  // Falls back to parseUserAgentBuiltin
}

/** Parsed user agent data for feature flag targeting and analytics. */
export interface ParsedUserAgent {
  /** Device type: 'mobile', 'tablet', 'desktop', 'tv', 'bot', etc. */
  device: string;
  /** Browser name: 'chrome', 'safari', 'firefox', 'edge', etc. */
  browser: string;
  /** Operating system: 'ios', 'android', 'windows', 'macos', etc. */
  os: string;
  /** App platform: 'react-native', 'flutter', 'electron', etc. */
  platform: string | null;
  /** Browser version string if available */
  browserVersion?: string;
  /** OS version string if available */
  osVersion?: string;
  /** Device vendor: 'Apple', 'Samsung', etc. */
  deviceVendor?: string;
  /** Device model: 'iPhone', 'Galaxy S21', etc. */
  deviceModel?: string;
}

// LRU cache with TTL: prevents memory leaks and stale data
class UACache {
  private cache = new Map<string, { data: ParsedUserAgent; expires: number }>();
  private maxSize: number;
  private ttl: number;

  constructor(maxSize = 1000, ttlMinutes = 60) {
    this.maxSize = maxSize;
    this.ttl = ttlMinutes * 60 * 1000;
  }

  get(key: string): ParsedUserAgent | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.data;
  }

  set(key: string, value: ParsedUserAgent): void {
    if (this.cache.size >= this.maxSize) {
      // LRU eviction: remove oldest entry when at capacity
      const iter = this.cache.keys().next();
      if (!iter.done) {
        this.cache.delete(iter.value);
      }
    }

    this.cache.set(key, {
      data: value,
      expires: Date.now() + this.ttl,
    });
  }

  clear(): void {
    this.cache.clear();
  }
}

const enhancedCache = new UACache();

/**
 * Parses user agent strings with caching and optional enhanced detection.
 * @param userAgent - Raw user agent string from request headers
 * @param useEnhanced - Enable ua-parser-js when available
 * @returns Normalized device/browser/OS data
 */
export function parseUserAgentEnhanced(
  userAgent?: string,
  useEnhanced = false,
): ParsedUserAgent {
  if (!userAgent) {
    return {
      device: "unknown",
      browser: "unknown",
      os: "unknown",
      platform: null,
    };
  }

  // Cache hit: return immediately to avoid re-parsing
  const uaStr = userAgent!;
  const cached = enhancedCache.get(uaStr);
  if (cached) return cached;

  let result: ParsedUserAgent;

  if (useEnhanced && UAParser) {
    // Enhanced detection: more accurate device/vendor/version data
    const parser = new UAParser(uaStr);
    const parsed = parser.getResult();

    result = {
      device: mapDeviceType(parsed.device.type, parsed.device.model),
      browser: parsed.browser.name?.toLowerCase() || "unknown",
      os: mapOSName(parsed.os.name),
      platform: detectPlatformEnhanced(userAgent!, parsed),
      browserVersion: parsed.browser.version,
      osVersion: parsed.os.version,
      deviceVendor: parsed.device.vendor,
      deviceModel: parsed.device.model,
    };
  } else {
    // Fallback: built-in parsing when ua-parser-js unavailable
    result = parseUserAgentBuiltin(userAgent!);
  }

  // Cache the result
  enhancedCache.set(uaStr, result);
  return result;
}

// Maps ua-parser-js device types to feature flag context values
function mapDeviceType(type?: string, model?: string): string {
  if (!type) {
    // Fallback inference from device model string
    if (model?.toLowerCase().includes("bot")) return "bot";
    return "desktop";
  }

  const typeMap: Record<string, string> = {
    mobile: "mobile",
    tablet: "tablet",
    smarttv: "tv",
    console: "console",
    wearable: "wearable",
    embedded: "embedded",
    desktop: "desktop",
  };

  return typeMap[type.toLowerCase()] || "desktop";
}

// Normalizes OS names for consistent feature flag targeting
function mapOSName(osName?: string): string {
  if (!osName) return "unknown";

  const name = osName.toLowerCase();
  if (name.includes("windows")) return "windows";
  if (name.includes("mac")) return "macos";
  if (name.includes("ios")) return "ios";
  if (name.includes("android")) return "android";
  if (name.includes("linux")) return "linux";
  if (name.includes("chrome os")) return "chromeos";

  return name;
}

// Detects app frameworks and platforms beyond basic browser detection
function detectPlatformEnhanced(userAgent: string, parsed: any): string | null {
  const ua = userAgent.toLowerCase();

  // Priority order: mobile frameworks > web frameworks > SSR
  if (ua.includes("dart")) return "flutter";
  if (ua.includes("react-native")) return "react-native";
  if (ua.includes("electron")) return "electron";
  if (ua.includes("capacitor")) return "capacitor";
  if (ua.includes("cordova")) return "cordova";

  // PWA detection using engine data
  const engine = parsed.engine?.name?.toLowerCase();
  if (engine === "webkit" && parsed.os?.name === "iOS") {
    if (ua.includes("standalone")) return "pwa-ios";
  }

  // SSR framework detection
  if (ua.includes("next.js")) return "nextjs";
  if (ua.includes("nuxt")) return "nuxt";
  if (ua.includes("remix")) return "remix";

  return null;
}

// Built-in parser: regex-based fallback when ua-parser-js unavailable
function parseUserAgentBuiltin(userAgent: string): ParsedUserAgent {
  const ua = userAgent.toLowerCase();

  return {
    device: detectDeviceBuiltin(ua),
    browser: detectBrowserBuiltin(ua),
    os: detectOSBuiltin(ua),
    platform: detectPlatformBuiltin(ua),
  };
}

function detectDeviceBuiltin(ua: string): string {
  if (ua.includes("bot") || ua.includes("crawler") || ua.includes("spider")) {
    return "bot";
  }

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

  const tabletPatterns = ["ipad", "tablet", "kindle", "silk"];
  if (tabletPatterns.some((p) => ua.includes(p))) return "tablet";

  const tvPatterns = ["tv", "smart-tv", "smarttv", "googletv", "appletv"];
  if (tvPatterns.some((p) => ua.includes(p))) return "tv";

  return "desktop";
}

function detectBrowserBuiltin(ua: string): string {
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

function detectOSBuiltin(ua: string): string {
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

function detectPlatformBuiltin(ua: string): string | null {
  const platforms = [
    { pattern: "dart", name: "flutter" },
    { pattern: "react-native", name: "react-native" },
    { pattern: "electron", name: "electron" },
    { pattern: "capacitor", name: "capacitor" },
    { pattern: "cordova", name: "cordova" },
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

/**
 * Checks if ua-parser-js is available for enhanced parsing.
 * @returns true when peer dependency is installed
 */
export function isEnhancedParsingAvailable(): boolean {
  return !!UAParser;
}
