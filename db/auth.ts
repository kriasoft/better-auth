// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import { betterAuth } from "better-auth";
import { featureFlags } from "better-auth-feature-flags";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import "./drizzle.config";

const sql = postgres(process.env.DATABASE_URL!);
const db = drizzle(sql);

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg" }),
  plugins: [organization(), featureFlags()],
});
