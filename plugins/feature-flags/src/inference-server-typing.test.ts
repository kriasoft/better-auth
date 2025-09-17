// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import { betterAuth } from "better-auth";
import { expectTypeOf, test } from "bun:test";
import { featureFlags } from "./index";

const auth = betterAuth({
  plugins: [featureFlags()],
});

test("server inference: flat endpoints on auth.api", () => {
  // Better Auth exposes plugin endpoints flat on auth.api by key
  expectTypeOf(auth.api.getFlag).toBeFunction();
  expectTypeOf(auth.api.getFlags).toBeFunction();
  expectTypeOf(auth.api.getAllFlags).toBeFunction();
  expectTypeOf(auth.api.trackEvent).toBeFunction();

  // Admin endpoints are also flat (client groups by path)
  expectTypeOf(auth.api.listFlags).toBeFunction();
  expectTypeOf(auth.api.createFlag).toBeFunction();
  expectTypeOf(auth.api.updateFlag).toBeFunction();
  expectTypeOf(auth.api.deleteFlag).toBeFunction();
  expectTypeOf(auth.api.listFlagRules).toBeFunction();
  expectTypeOf(auth.api.createFlagRule).toBeFunction();
  expectTypeOf(auth.api.listFlagOverrides).toBeFunction();
  expectTypeOf(auth.api.createFlagOverride).toBeFunction();
  expectTypeOf(auth.api.listAuditLog).toBeFunction();
  expectTypeOf(auth.api.getStats).toBeFunction();
});
