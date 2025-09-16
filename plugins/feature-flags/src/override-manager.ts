// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

/**
 * Secure flag override manager with environment detection.
 * @security Blocks production overrides unless explicitly enabled
 * @usage Debug/testing environments only by default
 */

export interface OverrideConfig {
  /** DANGEROUS: Allow overrides in production */
  allowInProduction?: boolean;
  /** Override TTL in ms (default: 1 hour) */
  ttl?: number;
  /** Persist to localStorage */
  persist?: boolean;
  /** Storage key prefix */
  keyPrefix?: string;
  /** Override environment detection for testing */
  environment?: "development" | "production";
}

interface StoredOverride {
  /** Override value */
  value: any;
  /** Unix timestamp when override expires */
  expires: number;
  /** Environment where override was set */
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
   * Multi-indicator environment detection.
   * @algorithm NODE_ENV → hostname → build flags
   * @see https://12factor.net/config
   */
  private detectEnvironment(): string {
    // Primary: NODE_ENV
    if (typeof process !== "undefined" && process.env?.NODE_ENV) {
      return process.env.NODE_ENV;
    }

    // Fallback: hostname-based detection
    if (typeof window !== "undefined") {
      const hostname = window.location.hostname;

      // Production domain patterns
      if (
        hostname !== "localhost" &&
        !hostname.startsWith("127.") &&
        !hostname.startsWith("192.168.") &&
        !hostname.includes(".local") &&
        !hostname.includes("staging")
      ) {
        return "production";
      }

      // Build-time environment (Vite/webpack)
      // @ts-ignore - Injected at build time
      if (typeof import.meta?.env?.MODE !== "undefined") {
        // @ts-ignore
        return import.meta.env.MODE;
      }
    }

    return "development";
  }

  /** Guards production override access */
  private isOverrideAllowed(): boolean {
    if (this.environment === "production" && !this.allowInProduction) {
      return false;
    }
    return true;
  }

  /**
   * Sets flag override with environment protection.
   * @security Blocks production unless allowInProduction=true
   * @returns true if set, false if blocked
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

    // Debug logging in development only
    if (this.environment === "development") {
      console.debug(
        `[feature-flags] Override set: ${flag} = ${JSON.stringify(value)}, expires in ${this.ttl}ms`,
      );
    }

    return true;
  }

  /** Gets override value, auto-expires stale entries */
  get(flag: string): any | undefined {
    if (!this.isOverrideAllowed()) {
      return undefined;
    }

    const override = this.overrides.get(flag);
    if (!override) {
      return undefined;
    }

    // Auto-expire stale overrides
    if (Date.now() > override.expires) {
      this.overrides.delete(flag);
      if (this.persist) {
        this.saveToStorage();
      }
      return undefined;
    }

    // Environment mismatch warning
    if (override.environment !== this.environment) {
      console.warn(
        `[feature-flags] Override "${flag}" was set in ${override.environment} but current is ${this.environment}`,
      );
    }

    return override.value;
  }

  /** Checks override existence without returning value */
  has(flag: string): boolean {
    return this.get(flag) !== undefined;
  }

  /** Clears specific override and syncs storage */
  delete(flag: string): void {
    this.overrides.delete(flag);
    if (this.persist) {
      this.saveToStorage();
    }
  }

  /** Clears all overrides and storage */
  clear(): void {
    this.overrides.clear();
    if (this.persist) {
      this.clearStorage();
    }
  }

  /** Returns all non-expired overrides for debugging */
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

  /** Loads persisted overrides, skips expired entries */
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
        // Only load non-expired overrides
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

  /** Persists current overrides to localStorage */
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

  /** Removes persisted overrides from storage */
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

  /** Starts 1-minute cleanup timer for expired overrides */
  private startCleanupTimer(): void {
    // 1-minute cleanup cycle
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpired();
    }, 60000);

    // Node.js: don't block process exit
    if (typeof process !== "undefined" && this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  /** Removes expired overrides and syncs storage */
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

  /** Cleanup timer and resources */
  dispose(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
  }
}
