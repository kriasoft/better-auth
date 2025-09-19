// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import { configDotenv } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import { join } from "node:path";
import postgres, { type Sql } from "postgres";
import * as schema from "./schema";

// Load environment variables
configDotenv({
  path: [join(__dirname, "../.env.local"), join(__dirname, "../.env")],
  quiet: true,
});

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

const sql = postgres(process.env.DATABASE_URL);

// Export the single, shared db instance for the entire monorepo
export const db = drizzle(sql, { schema });

export { schema };
