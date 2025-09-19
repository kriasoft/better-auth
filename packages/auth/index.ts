// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import { betterAuth, type BetterAuthOptions, type Auth } from "better-auth";
import { featureFlags } from "better-auth-feature-flags";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

/**
 * Creates Better Auth configuration with Drizzle adapter and organization support.
 * @param db - PostgresJS database instance
 * @returns Auth options with plugins and database adapter
 */
export function createAuthOptions(
  db: PostgresJsDatabase<any>,
): BetterAuthOptions {
  return {
    database: drizzleAdapter(db, { provider: "pg" }),
    plugins: [organization(), featureFlags()],
  };
}

/**
 * Creates authenticated Better Auth instance with pre-configured options.
 * @param db - PostgresJS database instance
 * @returns Configured betterAuth instance ready for middleware
 */
export function createAuth(
  db: PostgresJsDatabase<any>,
): ReturnType<typeof betterAuth<BetterAuthOptions>> {
  const options = createAuthOptions(db);
  return betterAuth(options);
}
