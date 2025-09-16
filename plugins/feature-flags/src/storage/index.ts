// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import { DatabaseStorage } from "./database";
import { MemoryStorage } from "./memory";
import { RedisStorage } from "./redis";
import type { StorageAdapter, StorageConfig } from "./types";

/**
 * Factory for creating storage adapters.
 * @param type - Storage backend: memory (dev), database (prod), redis (cache)
 * @param config - Adapter configuration with connection settings
 * @throws {Error} Missing required config (db instance, redis config) or invalid type
 * @see src/storage/types.ts for configuration options
 */
export function createStorageAdapter(
  type: "memory" | "database" | "redis",
  config: StorageConfig,
): StorageAdapter {
  switch (type) {
    case "memory":
      return new MemoryStorage(config);

    case "database":
      if (!config.db) {
        throw new Error("Database instance is required for database storage");
      }
      return new DatabaseStorage(config);

    case "redis":
      if (!config.redis) {
        throw new Error("Redis configuration is required for Redis storage");
      }
      return new RedisStorage(config);

    default:
      throw new Error(`Unknown storage type: ${type}`);
  }
}

export type { StorageAdapter, StorageConfig } from "./types";
