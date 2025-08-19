// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import type { Config } from "drizzle-kit";
import { fileURLToPath } from "node:url";
import { envSchema } from "./server/env";
import { loadEnv } from "vite";

const rootDir = fileURLToPath(new URL("../../", import.meta.url));

// Load environment variables for migrations
const env = envSchema.parse(loadEnv("development", rootDir, ""));

/**
 * Drizzle ORM configuration.
 *
 * @see https://orm.drizzle.team/docs/drizzle-config-file
 */
export default {
  schema: "./server/schema-generated.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: env.DATABASE_URL!,
  },
} satisfies Config;
