// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

/**
 * Secure override management for feature flags.
 *
 * @security Critical: Prevents debug features from leaking to production.
 * - Disabled in production environments
 * - Automatic expiration to prevent persistent overrides
 * - Optional localStorage with encryption consideration
 */

export interface OverrideConfig {
  /** Allow overrides in production (dangerous!) */
  allowInProduction?: boolean;
  /** Override expiration time in ms (default: 1 hour) */
  ttl?: number;
  /** Persist overrides to localStorage */
  persist?: boolean;
  /** Storage key prefix */
  keyPrefix?: string;
  /** Environment detection override for testing */
  environment?: "development" | "production";
}

interface StoredOverride {
  value: any;
  expires: number;
  environment: string;
}

export class SecureOverrideManager {
  private overrides = new Map<string, StoredOverride>();
  private readonly ttl: number;
  private readonly allowInProduction: boolean;
  private readonly persist: boolean;
  private readonly storageKey: string;
  private readonly environment: string;
  private cleanupTimer?: ReturnType<typeof setInterval>;

  constructor(config: OverrideConfig = {}) {
    this.ttl = config.ttl ?? 3600000; // 1 hour default
    this.allowInProduction = config.allowInProduction ?? false;
    this.persist = config.persist ?? false;
    this.storageKey = `${config.keyPrefix ?? "feature-flags"}-overrides`;
    this.environment = config.environment ?? this.detectEnvironment();

    // Load persisted overrides if enabled
    if (this.persist && this.isOverrideAllowed()) {
      this.loadFromStorage();
    }

    // Start cleanup timer for expired overrides
    this.startCleanupTimer();
  }

  /**
   * Detect if we're in a production environment.
   *
   * @returns true if production, false otherwise
   * @decision Check multiple indicators for robustness:
   * - NODE_ENV (most common)
   * - window.location.hostname (production domains)
   * - Build-time flags (VITE_ENV, etc.)
   */
  private detectEnvironment(): string {
    // Node.js/bundler environment variable
    if (typeof process !== "undefined" && process.env?.NODE_ENV) {
      return process.env.NODE_ENV;
    }

    // Browser environment checks
    if (typeof window !== "undefined") {
      const hostname = window.location.hostname;

      // Common production indicators
      if (
        hostname !== "localhost" &&
        !hostname.startsWith("127.") &&
        !hostname.startsWith("192.168.") &&
        !hostname.includes(".local") &&
        !hostname.includes("staging")
      ) {
        return "production";
      }

      // Check for Vite/webpack environment variables
      // @ts-ignore - These are injected at build time
      if (typeof import.meta?.env?.MODE !== "undefined") {
        // @ts-ignore
        return import.meta.env.MODE;
      }
    }

    return "development";
  }

  /**
   * Check if overrides are allowed in current environment.
   */
  private isOverrideAllowed(): boolean {
    if (this.environment === "production" && !this.allowInProduction) {
      return false;
    }
    return true;
  }

  /**
   * Set a feature flag override.
   *
   * @security Blocked in production unless explicitly allowed.
   * @param flag - Flag key
   * @param value - Override value
   * @returns true if override was set, false if blocked
   */
  set(flag: string, value: any): boolean {
    if (!this.isOverrideAllowed()) {
      console.warn(
        "[feature-flags] Overrides are disabled in production. " +
          "Set allowInProduction: true to enable (not recommended).",
      );
      return false;
    }

    const override: StoredOverride = {
      value,
      expires: Date.now() + this.ttl,
      environment: this.environment,
    };

    this.overrides.set(flag, override);

    // Persist if enabled
    if (this.persist) {
      this.saveToStorage();
    }

    // Log for debugging
    if (this.environment === "development") {
      console.debug(
        `[feature-flags] Override set: ${flag} = ${JSON.stringify(value)}, expires in ${this.ttl}ms`,
      );
    }

    return true;
  }

  /**
   * Get an override value if it exists and hasn't expired.
   */
  get(flag: string): any | undefined {
    if (!this.isOverrideAllowed()) {
      return undefined;
    }

    const override = this.overrides.get(flag);
    if (!override) {
      return undefined;
    }

    // Check expiration
    if (Date.now() > override.expires) {
      this.overrides.delete(flag);
      if (this.persist) {
        this.saveToStorage();
      }
      return undefined;
    }

    // Warn if override from different environment
    if (override.environment !== this.environment) {
      console.warn(
        `[feature-flags] Override "${flag}" was set in ${override.environment} but current is ${this.environment}`,
      );
    }

    return override.value;
  }

  /**
   * Check if an override exists (without returning value).
   */
  has(flag: string): boolean {
    return this.get(flag) !== undefined;
  }

  /**
   * Clear a specific override.
   */
  delete(flag: string): void {
    this.overrides.delete(flag);
    if (this.persist) {
      this.saveToStorage();
    }
  }

  /**
   * Clear all overrides.
   */
  clear(): void {
    this.overrides.clear();
    if (this.persist) {
      this.clearStorage();
    }
  }

  /**
   * Get all active overrides (for debugging).
   */
  getAll(): Record<string, any> {
    if (!this.isOverrideAllowed()) {
      return {};
    }

    const result: Record<string, any> = {};
    for (const [key, override] of this.overrides) {
      if (Date.now() <= override.expires) {
        result[key] = override.value;
      }
    }
    return result;
  }

  /**
   * Load overrides from localStorage.
   */
  private loadFromStorage(): void {
    if (typeof globalThis.localStorage === "undefined") {
      return;
    }

    try {
      const stored = localStorage.getItem(this.storageKey);
      if (!stored) {
        return;
      }

      const data = JSON.parse(stored) as Record<string, StoredOverride>;
      const now = Date.now();

      for (const [key, override] of Object.entries(data)) {
        // Skip expired overrides
        if (override.expires > now) {
          this.overrides.set(key, override);
        }
      }
    } catch (error) {
      console.warn(
        "[feature-flags] Failed to load overrides from storage:",
        error,
      );
    }
  }

  /**
   * Save overrides to localStorage.
   */
  private saveToStorage(): void {
    if (typeof globalThis.localStorage === "undefined") {
      return;
    }

    try {
      const data: Record<string, StoredOverride> = {};
      for (const [key, override] of this.overrides) {
        data[key] = override;
      }
      localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (error) {
      console.warn(
        "[feature-flags] Failed to save overrides to storage:",
        error,
      );
    }
  }

  /**
   * Clear overrides from localStorage.
   */
  private clearStorage(): void {
    if (typeof globalThis.localStorage === "undefined") {
      return;
    }

    try {
      localStorage.removeItem(this.storageKey);
    } catch (error) {
      console.warn(
        "[feature-flags] Failed to clear overrides from storage:",
        error,
      );
    }
  }

  /**
   * Start periodic cleanup of expired overrides.
   */
  private startCleanupTimer(): void {
    // Run cleanup every minute
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpired();
    }, 60000);

    // Allow cleanup in Node.js environments
    if (typeof process !== "undefined" && this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  /**
   * Remove expired overrides.
   */
  private cleanupExpired(): void {
    const now = Date.now();
    let hasChanges = false;

    for (const [key, override] of this.overrides) {
      if (override.expires <= now) {
        this.overrides.delete(key);
        hasChanges = true;
      }
    }

    if (hasChanges && this.persist) {
      this.saveToStorage();
    }
  }

  /**
   * Clean up resources.
   */
  dispose(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
  }
}
