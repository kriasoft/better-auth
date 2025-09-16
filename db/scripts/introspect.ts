// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import "../drizzle.config";
import { getSchema } from "better-auth/db";
import { featureFlags } from "better-auth-feature-flags";
import postgres from "postgres";

const db = postgres(process.env.DATABASE_URL!);

const schema = getSchema({
  database: db as any,
  plugins: [featureFlags()],
});

console.log(JSON.stringify(schema, null, 2));
