// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import { betterAuth, type BetterAuthOptions } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle } from "drizzle-orm/postgres-js";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema-generated";
import { getEnabledPlugins } from "./plugins";
import type { Env } from "./env";

/**
 * Creates Better Auth configuration
 * This is the single source of truth for auth configuration,
 * used by both the context middleware (runtime) and auth.ts (CLI)
 */
function createAuthConfig(
  env: Env,
  db: PostgresJsDatabase<typeof schema>
): BetterAuthOptions {
  return {
    secret: env.BETTER_AUTH_SECRET,

    database: drizzleAdapter(db, { provider: "pg" }),

    emailAndPassword: {
      enabled: true,
      autoSignIn: true,
    },

    socialProviders:
      env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
        ? {
            google: {
              clientId: env.GOOGLE_CLIENT_ID,
              clientSecret: env.GOOGLE_CLIENT_SECRET,
            },
          }
        : undefined,

    plugins: getEnabledPlugins(env),

    trustedOrigins: ["http://localhost:5173", "http://localhost:3000"],

    advanced: {
      generateId: () => crypto.randomUUID(),
      cookies: {
        sessionToken: {
          name: "playground-session",
        },
      },
    },
  };
}

/**
 * Factory function to create auth, database, and client instances
 *
 * @param env - Validated environment variables
 * @param options - Optional configuration options
 * @returns Object containing auth, db, and client instances
 */
export function createAuth(env: Env, options?: { isCliMode?: boolean }) {
  // Create database connection
  const client = postgres(env.DATABASE_URL!, {
    max: options?.isCliMode ? 1 : 10, // Single connection for CLI, pool for runtime
  });

  const db = drizzle(client, { schema });

  // Create auth instance with configuration
  const authConfig = createAuthConfig(env, db);
  const auth = betterAuth(authConfig);

  return { auth, db, client };
}

/**
 * Type for the return value of createAuth factory
 */
export type AuthInstance = ReturnType<typeof createAuth>;
