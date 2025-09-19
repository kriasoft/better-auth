// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import { createAuthOptions } from "@repo/auth";
import { db } from "@repo/db";
import { getSchema } from "better-auth/db";
import { join, relative } from "node:path";

async function generateSchema() {
  const options = createAuthOptions(db);
  const schema = JSON.stringify(getSchema(options), null, 2);
  let schemaFile = join(__dirname, "../packages/auth/schema.json");
  schemaFile = relative(process.cwd(), schemaFile);

  await Bun.write(schemaFile, schema);
  console.log(`✅ Schema generated: ${schemaFile}`);
}

generateSchema().catch((err) => {
  console.error(`❌ Failed to generate schema: ${err}`);
  process.exit(1);
});
