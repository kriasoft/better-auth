// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

/**
 * Better Auth instance for CLI usage only
 *
 * This file is used by the Better Auth CLI to generate schemas.
 * For runtime usage, auth is initialized in the context middleware.
 */

import { fileURLToPath } from "node:url";
import { envSchema } from "./env";
import { createAuth } from "./auth-factory";
import { loadEnv } from "vite";

// Load environment variables for CLI usage
const rootPath = fileURLToPath(new URL("../../..", import.meta.url));
const envName = process.env.APP_ENV ?? process.env.NODE_ENV ?? "development";
const rawEnv = loadEnv(envName, rootPath, "");

// Parse and validate environment variables
const env = envSchema.parse(rawEnv);

// Create auth instance for CLI using the factory
// Includes plugins to generate their schemas
export default createAuth(env, { isCliMode: true });
