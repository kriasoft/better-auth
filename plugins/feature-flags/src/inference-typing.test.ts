// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import { createAuthClient } from "better-auth/client";
import { expectTypeOf, test } from "bun:test";
import { featureFlagsClient } from "./client";

test("client inference: featureFlags actions and API routes", () => {
  const client = createAuthClient({ plugins: [featureFlagsClient()] });

  // Actions exposed by the client plugin
  expectTypeOf(client.featureFlags.isEnabled).toBeFunction();
  expectTypeOf(client.featureFlags.getValue).toBeFunction();
  expectTypeOf(client.featureFlags.getVariant).toBeFunction();
  expectTypeOf(client.featureFlags.getAllFlags).toBeFunction();
  expectTypeOf(client.featureFlags.getFlags).toBeFunction();
  expectTypeOf(client.featureFlags.trackEvent).toBeFunction();
  expectTypeOf(client.featureFlags.setContext).toBeFunction();
  expectTypeOf(client.featureFlags.getContext).toBeFunction();
  expectTypeOf(client.featureFlags.prefetch).toBeFunction();
  expectTypeOf(client.featureFlags.clearCache).toBeFunction();
  expectTypeOf(client.featureFlags.setOverride).toBeFunction();
  expectTypeOf(client.featureFlags.clearOverrides).toBeFunction();
  expectTypeOf(client.featureFlags.refresh).toBeFunction();
  expectTypeOf(client.featureFlags.subscribe).toBeFunction();

  // Route functions are available via the dynamic proxy as well, but
  // we only verify action methods here. Server route inference is asserted
  // separately in inference-server-typing.test.ts.
});
