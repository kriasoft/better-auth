// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import { configDotenv } from "dotenv";
import type { Config } from "drizzle-kit";
import { resolve } from "node:path";

// Load environment variables
configDotenv({
  path: [resolve(__dirname, "../.env.local"), resolve(__dirname, "../.env")],
  quiet: true,
});

export default {
  schema: "./schema/index.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    // Use connection string from environment variable
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
} satisfies Config;
