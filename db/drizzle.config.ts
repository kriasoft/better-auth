// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import type { Config } from "drizzle-kit";
import { configDotenv } from "dotenv";
import { resolve } from "node:path";

// Load environment variables
configDotenv({ path: resolve(__dirname, "../.env.local") });
configDotenv({ path: resolve(__dirname, "../.env") });

export default {
  schema: "./auth-schema.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    // Use connection string from environment variable
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
} satisfies Config;
