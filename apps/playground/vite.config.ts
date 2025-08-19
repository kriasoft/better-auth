// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import devServer from "@hono/vite-dev-server";
import devServerAdapter from "@hono/vite-dev-server/bun";
import { fileURLToPath } from "node:url";
import { envSchema } from "./server/env";

const rootDir = fileURLToPath(new URL("../..", import.meta.url));

export default defineConfig(({ mode }) => {
  // Load env vars from root directory (../../)
  // This will load .env, .env.local, and .env.[mode] files
  const env = loadEnv(mode, rootDir, "");
  const parsedEnv = envSchema.parse(env);

  return {
    root: "./client",
    plugins: [
      react(),
      devServer({
        entry: "./server/app.ts",
        export: "app",
        exclude: [/^(?!\/api\/).*/], // Only handle /api/** routes
        adapter: devServerAdapter(),
        env: parsedEnv, // Pass validated env to Hono
      }),
    ],
    resolve: {
      alias: {
        "@": "/client/src",
        "@server": "/server",
        "@shared": "/shared",
      },
    },
    server: {
      port: 5173,
    },
    define: {
      // Make env vars available to the client (only VITE_ prefixed ones are exposed by default)
      "process.env": {},
    },
    envDir: rootDir, // Tell Vite where to look for .env files
  };
});
