// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import type { Context, Next } from "hono";
import { createAuth, type AuthInstance } from "./auth-factory";
import type { Env } from "./env";

// Single global instance - initialized once on first request
let instance: AuthInstance | null = null;

/**
 * Creates context middleware that provides both database and auth instances
 * via Hono's context, using c.env for configuration
 */
export function context() {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    // Environment variables are already validated in vite.config.ts
    const env = c.env;

    // Initialize once on first request
    if (!instance) {
      instance = createAuth(env);
    }

    // Make both db and auth available to the request context
    c.set("db", instance.db);
    c.set("auth", instance.auth);

    // Handle Better Auth routes
    if (c.req.path.startsWith("/api/auth")) {
      return instance.auth.handler(c.req.raw);
    }

    await next();
  };
}

// Type augmentation for Hono context
declare module "hono" {
  interface ContextVariableMap {
    auth: AuthInstance["auth"];
    db: AuthInstance["db"];
  }
}
