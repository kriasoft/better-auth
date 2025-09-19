// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import { createAuthOptions } from "@repo/auth";
import { db } from "@repo/db";
import { getSchema } from "better-auth/db";
import { join, relative } from "node:path";
import { format } from "prettier";

async function generateSchema() {
  const options = createAuthOptions(db);
  const schema = JSON.stringify(getSchema(options), null, 2);
  let schemaFile = join(__dirname, "../packages/auth/schema.json");
  schemaFile = relative(process.cwd(), schemaFile);

  const formattedSchema = await format(schema, { parser: "json" });
  await Bun.write(schemaFile, formattedSchema);
  console.log(`✅ Schema generated: ${schemaFile}`);
}

generateSchema().catch((err) => {
  console.error(`❌ Failed to generate schema: ${err}`);
  process.exit(1);
});
