// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import { Hono } from "hono";
import { logger } from "hono/logger";
import { context } from "./context";
import type { Env } from "./env";

// Create Hono app with strongly typed environment variables
const app = new Hono<{ Bindings: Env }>();

// Middleware
app.use("*", logger());

// Add context middleware that provides db and auth via c.env
app.use("*", context());

// Health check
app.get("/api/health", (c) => {
  const env = c.env;
  return c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    env: {
      hasGoogleDrive: !!(
        env.GOOGLE_DRIVE_CLIENT_ID && env.GOOGLE_DRIVE_CLIENT_SECRET
      ),
      hasOneDrive: !!(env.ONEDRIVE_CLIENT_ID && env.ONEDRIVE_CLIENT_SECRET),
    },
  });
});

// Better Auth routes are handled by the middleware at /api/auth/*

// Test endpoints for debugging
app.get("/api/session", async (c) => {
  const auth = c.get("auth");
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!session) {
    return c.json({ error: "Not authenticated" }, 401);
  }

  return c.json(session);
});

// Storage plugin test endpoints
app.get("/api/storage/accounts", async (c) => {
  const auth = c.get("auth");
  const db = c.get("db");

  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!session) {
    return c.json({ error: "Not authenticated" }, 401);
  }

  // Now we can directly query the database using the db from context
  // Example: const accounts = await db.select().from(schema.connectedAccount).where(eq(schema.connectedAccount.userId, session.user.id));

  return c.json({
    accounts: [],
    userId: session.user.id,
  });
});

// 404 handler
app.notFound((c) => {
  return c.json({ error: "Not found" }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error(`${err}`);
  return c.json({ error: "Internal server error" }, 500);
});

export { app };
