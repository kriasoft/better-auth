// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

/**
 * Enhanced user agent parsing module
 *
 * This module provides an optional integration with ua-parser-js
 * for more accurate device detection. Users can opt-in by installing
 * ua-parser-js as a peer dependency.
 *
 * @example
 * ```ts
 * // Install ua-parser-js for enhanced detection
 * bun add ua-parser-js
 *
 * // Configure the plugin to use enhanced parsing
 * featureFlags({
 *   parsing: {
 *     useEnhancedUA: true
 *   }
 * })
 * ```
 */

let UAParser: any;

// Try to load ua-parser-js if available
try {
  UAParser = require("ua-parser-js");
} catch {
  // ua-parser-js not installed, will use built-in detection
}

export interface ParsedUserAgent {
  device: string;
  browser: string;
  os: string;
  platform: string | null;
  browserVersion?: string;
  osVersion?: string;
  deviceVendor?: string;
  deviceModel?: string;
}

/**
 * Enhanced cache with TTL support
 */
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
      // Remove oldest entry
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
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
 * Parse user agent with optional ua-parser-js support
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

  // Check cache first
  const cached = enhancedCache.get(userAgent);
  if (cached) return cached;

  let result: ParsedUserAgent;

  if (useEnhanced && UAParser) {
    // Use ua-parser-js for enhanced detection
    const parser = new UAParser(userAgent);
    const parsed = parser.getResult();

    result = {
      device: mapDeviceType(parsed.device.type, parsed.device.model),
      browser: parsed.browser.name?.toLowerCase() || "unknown",
      os: mapOSName(parsed.os.name),
      platform: detectPlatformEnhanced(userAgent, parsed),
      browserVersion: parsed.browser.version,
      osVersion: parsed.os.version,
      deviceVendor: parsed.device.vendor,
      deviceModel: parsed.device.model,
    };
  } else {
    // Fallback to built-in detection (imported from context.ts)
    result = parseUserAgentBuiltin(userAgent);
  }

  // Cache the result
  enhancedCache.set(userAgent, result);
  return result;
}

/**
 * Map ua-parser-js device types to our simplified types
 */
function mapDeviceType(type?: string, model?: string): string {
  if (!type) {
    // Try to infer from model
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

/**
 * Map OS names to simplified versions
 */
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

/**
 * Enhanced platform detection
 */
function detectPlatformEnhanced(userAgent: string, parsed: any): string | null {
  const ua = userAgent.toLowerCase();

  // Check for app frameworks first
  if (ua.includes("dart")) return "flutter";
  if (ua.includes("react-native")) return "react-native";
  if (ua.includes("electron")) return "electron";
  if (ua.includes("capacitor")) return "capacitor";
  if (ua.includes("cordova")) return "cordova";

  // Check engine for better detection
  const engine = parsed.engine?.name?.toLowerCase();
  if (engine === "webkit" && parsed.os?.name === "iOS") {
    if (ua.includes("standalone")) return "pwa-ios";
  }

  // SSR frameworks
  if (ua.includes("next.js")) return "nextjs";
  if (ua.includes("nuxt")) return "nuxt";
  if (ua.includes("remix")) return "remix";

  return null;
}

/**
 * Built-in parser fallback (copy of the optimized version from context.ts)
 * This ensures the module works even without ua-parser-js
 */
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
 * Export a function to check if enhanced parsing is available
 */
export function isEnhancedParsingAvailable(): boolean {
  return !!UAParser;
}
