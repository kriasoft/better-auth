// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import type { StorageAdapter, StorageConfig } from "./types";
import { MemoryStorage } from "./memory";
import { DatabaseStorage } from "./database";

/**
 * Factory function to create the appropriate storage adapter
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
      // Redis adapter will be implemented in phase 2
      throw new Error("Redis storage is not yet implemented");

    default:
      throw new Error(`Unknown storage type: ${type}`);
  }
}

export type { StorageAdapter, StorageConfig } from "./types";
