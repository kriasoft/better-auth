// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

/*
 * Generate a lean API map for a Better Auth plugin by introspecting endpoints.
 *
 * Usage:
 *   bun run scripts/generate-api-map.ts --plugin feature-flags [--format json|yaml] [--output path] [--prune]
 *
 * Defaults:
 *   --plugin  feature-flags
 *   --format  json
 *   --output  plugins/<plugin>/specs/api-map.json
 *
 * Merging behavior:
 *   - If an existing file is found, merge by HTTP method+path key.
 *   - Preserve existing `server`, `client`, and `visibility` fields.
 *   - Update/insert missing entries from discovered endpoints.
 *   - With --prune, remove entries not present in discovery.
 */

import { constants as fsConstants } from "node:fs";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type Args = {
  plugin: string;
  format: "json" | "yaml";
  output?: string;
  baseURL?: string;
  prune?: boolean;
};

function parseArgs(argv: string[]): Args {
  const args: Args = {
    plugin: "feature-flags",
    format: "json",
    baseURL: "http://localhost:3000",
    prune: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--plugin" && argv[i + 1]) args.plugin = argv[++i];
    else if ((a === "--format" || a === "-f") && argv[i + 1]) {
      const f = argv[++i];
      if (f !== "json" && f !== "yaml")
        throw new Error(`Invalid --format: ${f}`);
      args.format = f;
    } else if ((a === "--output" || a === "-o") && argv[i + 1])
      args.output = argv[++i];
    else if (a === "--base-url" && argv[i + 1]) args.baseURL = argv[++i];
    else if (a === "--prune") args.prune = true;
  }
  if (!args.output) {
    const ext = args.format === "yaml" ? "yaml" : "json";
    args.output = path.join("plugins", args.plugin, "specs", `api-map.${ext}`);
  }
  return args;
}

async function exists(file: string) {
  try {
    await access(file, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

// Minimal YAML serializer (same as in generate-openapi)
function toYAML(value: any, indent = 0): string {
  const pad = (n: number) => " ".repeat(n);
  const isPlainObject = (v: any) =>
    v && typeof v === "object" && !Array.isArray(v);
  const dumpScalar = (v: any) => {
    if (v === null || v === undefined) return "null";
    if (typeof v === "number" || typeof v === "bigint") return String(v);
    if (typeof v === "boolean") return v ? "true" : "false";
    const s = String(v);
    if (/^[\w@.+-]+$/.test(s)) return s;
    return JSON.stringify(s);
  };
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    return value
      .map(
        (item) =>
          `${pad(indent)}- ${isPlainObject(item) || Array.isArray(item) ? `\n${toYAML(item, indent + 2)}` : dumpScalar(item)}`,
      )
      .join("\n");
  }
  if (isPlainObject(value)) {
    const entries = Object.entries(value);
    if (entries.length === 0) return "{}";
    return entries
      .map(([k, v]) =>
        isPlainObject(v) || Array.isArray(v)
          ? `${pad(indent)}${k}:\n${toYAML(v, indent + 2)}`
          : `${pad(indent)}${k}: ${dumpScalar(v)}`,
      )
      .join("\n");
  }
  return `${pad(indent)}${dumpScalar(value)}`;
}

// Utilities
const toCamel = (s: string) =>
  s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
const lowerFirst = (s: string) => (s ? s[0].toLowerCase() + s.slice(1) : s);

function deriveClientName(
  plugin: string,
  opId?: string,
  method?: string,
  p?: string,
) {
  const base = `authClient.${toCamel(plugin)}`;
  if (opId && opId.startsWith("auth.api.")) {
    return `${base}.${lowerFirst(opId.slice("auth.api.".length))}`;
  }
  // Fallback: use method + path suffix
  const nameFromPath =
    (p || "").split("/").filter(Boolean).slice(-1)[0] || "call";
  return `${base}.${lowerFirst(nameFromPath)}`;
}

function inferVisibility(p: string): "public" | "admin" | "none" {
  if (p.includes("/admin/")) return "admin";
  if (p.endsWith("/health")) return "none";
  return "public";
}

async function generateOpenAPI(plugin: string, baseURL?: string) {
  const [{ betterAuth }, { openAPI }, { memoryAdapter }] = await Promise.all([
    import("better-auth"),
    import("better-auth/plugins"),
    import("better-auth/adapters/memory"),
  ]);

  // Load plugin factory from local source
  const mod = await import(
    path.resolve(process.cwd(), `plugins/${plugin}/src/index.ts`)
  );
  const factory = (mod.default ||
    mod[toCamel(plugin)] ||
    mod.createFeatureFlagsPlugin) as any;
  if (typeof factory !== "function") {
    throw new Error(`Plugin factory not found for '${plugin}'.`);
  }

  const auth = betterAuth({
    baseURL: baseURL || "http://localhost:3000",
    database: memoryAdapter({}),
    plugins: [
      factory({ storage: "memory" }),
      openAPI({ disableDefaultReference: true }),
    ],
    logger: { disabled: true },
  });
  return await auth.api.generateOpenAPISchema();
}

type ApiMapEntry = {
  server: string | null;
  http: { method: string; path: string };
  client: string | null;
  visibility?: "public" | "admin" | "none";
  summary?: string;
};

function mergeMaps(
  existing: ApiMapEntry[] | undefined,
  discovered: ApiMapEntry[],
  prune: boolean,
): ApiMapEntry[] {
  const byKey = (e: ApiMapEntry) =>
    `${e.http.method.toUpperCase()} ${e.http.path}`;
  const existingMap = new Map<string, ApiMapEntry>();
  (existing || []).forEach((e) => existingMap.set(byKey(e), e));
  const discoveredMap = new Map<string, ApiMapEntry>();
  discovered.forEach((e) => discoveredMap.set(byKey(e), e));

  const result: ApiMapEntry[] = [];
  for (const [key, d] of discoveredMap) {
    const prev = existingMap.get(key);
    if (prev) {
      result.push({
        http: d.http,
        server: prev.server ?? d.server,
        client: prev.client ?? d.client,
        visibility: prev.visibility ?? d.visibility,
        summary: prev.summary ?? d.summary,
      });
    } else {
      result.push(d);
    }
  }
  if (!prune) {
    for (const [key, prev] of existingMap) {
      if (!discoveredMap.has(key)) {
        result.push(prev);
      }
    }
  }
  // Stable order: by path then method
  result.sort((a, b) =>
    a.http.path === b.http.path
      ? a.http.method.localeCompare(b.http.method)
      : a.http.path.localeCompare(b.http.path),
  );
  return result;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const schema = await generateOpenAPI(args.plugin, args.baseURL);

  // Project to lean entries
  const entries: ApiMapEntry[] = [];
  const paths = schema.paths || {};
  const prefix = `/${args.plugin}`;
  for (const [p, ops] of Object.entries<any>(paths)) {
    if (!p.startsWith(prefix)) continue; // only include this plugin's endpoints
    for (const method of ["get", "post", "put", "patch", "delete" as const]) {
      const op = (ops as any)[method];
      if (!op) continue;
      const serverId =
        typeof op.operationId === "string" ? op.operationId : null;
      const clientId = deriveClientName(
        args.plugin,
        serverId || undefined,
        method,
        p,
      );
      const entry: ApiMapEntry = {
        server: serverId,
        http: { method: method.toUpperCase(), path: p },
        client: clientId,
        visibility: inferVisibility(p),
        summary: typeof op.summary === "string" ? op.summary : undefined,
      };
      entries.push(entry);
    }
  }

  const outPath = path.resolve(process.cwd(), args.output!);
  await mkdir(path.dirname(outPath), { recursive: true });

  let existing: ApiMapEntry[] | undefined;
  if (await exists(outPath)) {
    try {
      const raw = await readFile(outPath, "utf8");
      if (args.format === "yaml") {
        // Simple YAML parse: rely on JSON if present; YAML not supported for merge read to keep script lightweight
        // If YAML exists, skip merge read and overwrite preserving manual edits is not possible.
        // Recommend JSON for mergeable format.
        existing = undefined;
      } else {
        existing = JSON.parse(raw);
      }
    } catch {
      existing = undefined;
    }
  }

  const merged = mergeMaps(existing, entries, !!args.prune);

  if (args.format === "yaml") {
    const yaml = toYAML(merged) + "\n";
    await writeFile(outPath, yaml, "utf8");
  } else {
    await writeFile(outPath, JSON.stringify(merged, null, 2) + "\n", "utf8");
  }

  console.log(
    `✔ Wrote API map → ${path.relative(process.cwd(), outPath)} (${merged.length} endpoints)`,
  );
}

main().catch((err) => {
  console.error("Failed to generate API map:", err);
  process.exit(1);
});
