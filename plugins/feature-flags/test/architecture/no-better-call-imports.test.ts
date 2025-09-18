// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import { describe, it } from "bun:test";
import { readdir, readFile } from "fs/promises";
import { dirname, join, relative, resolve } from "path";
import { fileURLToPath } from "url";

/**
 * Enforces no imports from 'better-call' package.
 *
 * WHY: Migrated away from better-call to fix TypeScript "excessively deep" errors
 * and reduce bundle size. All middleware functionality moved to src/middleware/
 *
 * @see plugins/feature-flags/specs/types-spec.md - Migration details
 * @see src/middleware/ - Internal implementations
 */
describe("better-call imports", () => {
  it("should not import from better-call in any source files", async () => {
    const testDir = dirname(fileURLToPath(import.meta.url));
    const srcDir = resolve(testDir, "../../src");
    const sourceFiles = await getAllSourceFiles(srcDir);
    const violatingFiles: Array<{ file: string; lines: string[] }> = [];

    for (const file of sourceFiles) {
      const content = await readFile(file, "utf-8");
      const lines = content.split("\n");
      const betterCallImports: string[] = [];

      lines.forEach((line, index) => {
        // Skip comments to avoid false positives
        const trimmedLine = line.trim();
        if (
          trimmedLine.startsWith("//") ||
          trimmedLine.startsWith("*") ||
          trimmedLine.startsWith("/*") ||
          trimmedLine === ""
        ) {
          return;
        }

        // Detect import/require patterns for better-call
        const importPatterns = [
          /from\s+["']better-call["']/,
          /import\s+.*["']better-call["']/,
          /require\s*\(\s*["']better-call["']\s*\)/,
        ];

        if (importPatterns.some((pattern) => pattern.test(line))) {
          betterCallImports.push(`Line ${index + 1}: ${line.trim()}`);
        }
      });

      if (betterCallImports.length > 0) {
        violatingFiles.push({
          file: relative(process.cwd(), file),
          lines: betterCallImports,
        });
      }
    }

    if (violatingFiles.length > 0) {
      const errorMessage = [
        "Found better-call imports in source files:",
        "",
        ...violatingFiles.flatMap(({ file, lines }) => [
          `${file}:`,
          ...lines.map((line) => `  ${line}`),
          "",
        ]),
        "The feature-flags plugin should not import from better-call.",
        "All middleware functionality has been moved to internal implementation.",
        "",
        "If you need functionality from better-call:",
        "1. Check if it's already available in src/middleware/",
        "2. Implement the needed functionality internally",
        "3. Update this test if better-call becomes a required dependency again",
      ].join("\n");

      throw new Error(errorMessage);
    }

    console.log(
      `✅ Verified ${sourceFiles.length} source files contain no better-call imports`,
    );
  });
});

/** Recursively collects all TypeScript/JavaScript files from directory tree */
async function getAllSourceFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await getAllSourceFiles(fullPath)));
    } else if (entry.isFile() && /\.(ts|tsx|js|jsx)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }

  return files;
}
