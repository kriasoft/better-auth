// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    client: "src/client.ts",
    "client-admin": "src/client-admin.ts",
    react: "src/react.tsx",
  },
  format: ["esm"],
  dts: true,
  clean: true,
  // Ensure peer deps stay external and not bundled
  external: [
    "better-auth",
    "better-call",
    "zod",
    "react",
    // Optional peers for Redis adapters
    "redis",
    "ioredis",
  ],
  target: "esnext", // Changed from es2020 to avoid problematic transpilation
  esbuildOptions(options) {
    options.jsx = "automatic";
    options.keepNames = true; // Preserve function names for better debugging
  },
});
