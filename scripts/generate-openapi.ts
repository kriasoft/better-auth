// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

/*
Generate an OpenAPI schema for a specific Better Auth plugin.

Usage:
  bun run scripts/generate-openapi.ts --plugin feature-flags [--format yaml|json] [--output path]

Defaults:
  --plugin  feature-flags
  --format  yaml
  --output  openapi/<plugin>.<ext>

This script creates an in-memory Better Auth instance with only the selected
plugin and the built-in `openAPI()` plugin enabled. No DB or network access
is required. It then calls `auth.api.generateOpenAPISchema()` and writes the
result as YAML or JSON.
*/

import { constants as fsConstants } from "node:fs";
import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

async function fileExists(p: string) {
  try {
    await access(p, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

type Args = {
  plugin: string;
  format: "yaml" | "json";
  output?: string;
  baseURL?: string;
};

function parseArgs(argv: string[]): Args {
  const args: Args = {
    plugin: "feature-flags",
    format: "yaml",
    baseURL: "http://localhost:3000",
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--plugin" && argv[i + 1]) {
      args.plugin = argv[++i];
    } else if ((a === "--format" || a === "-f") && argv[i + 1]) {
      const f = argv[++i] as Args["format"];
      if (f !== "yaml" && f !== "json") {
        throw new Error(`Invalid --format: ${f}`);
      }
      args.format = f;
    } else if ((a === "--output" || a === "-o") && argv[i + 1]) {
      args.output = argv[++i];
    } else if (a === "--base-url" && argv[i + 1]) {
      args.baseURL = argv[++i];
    }
  }
  if (!args.output) {
    const ext = args.format === "yaml" ? "yaml" : "json";
    args.output = path.join("openapi", `${args.plugin}.${ext}`);
  }
  return args;
}

// Minimal YAML serializer (covers OpenAPI structures: objects, arrays, scalars)
function toYAML(value: any, indent = 0): string {
  const pad = (n: number) => " ".repeat(n);
  const isPlainObject = (v: any) =>
    v && typeof v === "object" && !Array.isArray(v);

  const dumpScalar = (v: any) => {
    if (v === null || v === undefined) return "null";
    if (typeof v === "number" || typeof v === "bigint") return String(v);
    if (typeof v === "boolean") return v ? "true" : "false";
    const s = String(v);
    // Quote if contains special YAML characters or leading/trailing spaces
    if (/^[\w@.+-]+$/.test(s)) return s; // simple unquoted
    return JSON.stringify(s); // fallback to JSON string quoting
  };

  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    return value
      .map(
        (item) =>
          `${pad(indent)}- ${
            isPlainObject(item) || Array.isArray(item)
              ? `\n${toYAML(item, indent + 2)}`
              : dumpScalar(item)
          }`,
      )
      .join("\n");
  }
  if (isPlainObject(value)) {
    const entries = Object.entries(value);
    if (entries.length === 0) return "{}";
    return entries
      .map(([k, v]) => {
        const key = String(k);
        if (isPlainObject(v) || Array.isArray(v)) {
          const nested = toYAML(v, indent + 2);
          return `${pad(indent)}${key}:\n${nested}`;
        }
        return `${pad(indent)}${key}: ${dumpScalar(v)}`;
      })
      .join("\n");
  }
  return `${pad(indent)}${dumpScalar(value)}`;
}

async function loadBetterAuth() {
  // Prefer installed package build to avoid local source deps and CJS interop quirks
  const mod = await import("better-auth");
  return mod as typeof import("better-auth");
}

async function loadOpenAPIPlugin() {
  // openAPI is exported from 'better-auth/plugins'
  const mod = await import("better-auth/plugins");
  return mod as typeof import("better-auth/plugins");
}

async function loadMemoryAdapter() {
  // Memory adapter export path per package.json: 'better-auth/adapters/memory'
  const mod = await import("better-auth/adapters/memory");
  return mod as typeof import("better-auth/adapters/memory");
}

async function loadLocalPlugin(pluginId: string) {
  // Try plugins/<pluginId>/src/index.ts
  const localPath = path.resolve(
    process.cwd(),
    `plugins/${pluginId}/src/index.ts`,
  );
  if (!(await fileExists(localPath))) {
    throw new Error(
      `Cannot locate local plugin source for '${pluginId}'. Expected at ${localPath}`,
    );
  }
  const mod = await import(pathToFileURL(localPath).href);
  // Prefer default export, else try a named export that matches common patterns
  const factory =
    mod.default ||
    mod[pluginId.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] || // e.g. feature-flags -> featureFlags
    mod.createFeatureFlagsPlugin ||
    null;
  if (!factory || typeof factory !== "function") {
    throw new Error(
      `Plugin factory not found in ${localPath}. Ensure it exports a default function or a named factory.`,
    );
  }
  return factory as (...args: any[]) => any;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const [{ betterAuth }, { openAPI }, { memoryAdapter }] = await Promise.all([
    loadBetterAuth(),
    loadOpenAPIPlugin(),
    loadMemoryAdapter(),
  ]);

  const pluginFactory = await loadLocalPlugin(args.plugin);

  // Build an isolated auth instance with only the target plugin enabled
  const auth = betterAuth({
    baseURL: args.baseURL,
    // Use the in-memory adapter; no DB is required for schema generation
    database: memoryAdapter({}),
    plugins: [
      // Use in-memory storage for generation to avoid DB dependencies
      pluginFactory({ storage: "memory" } as any),
      openAPI({ disableDefaultReference: true }),
    ],
    // Keep logs quiet for script usage
    logger: { disabled: true },
  });

  const schema = await auth.api.generateOpenAPISchema();

  // Ensure output dir
  const outPath = path.resolve(process.cwd(), args.output!);
  await mkdir(path.dirname(outPath), { recursive: true });

  if (args.format === "json") {
    await writeFile(outPath, JSON.stringify(schema, null, 2), "utf8");
    console.log(
      `✔ Wrote OpenAPI JSON → ${path.relative(process.cwd(), outPath)}`,
    );
  } else {
    const yaml = toYAML(schema) + "\n";
    await writeFile(outPath, yaml, "utf8");
    console.log(
      `✔ Wrote OpenAPI YAML → ${path.relative(process.cwd(), outPath)}`,
    );
  }
}

main().catch((err) => {
  console.error("Failed to generate OpenAPI schema:", err);
  process.exit(1);
});
