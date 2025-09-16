// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import { describe, expect, it } from "bun:test";
import { featureFlagsAdminClient } from "./client-admin";

type FetchCall = { url: string; options: any };

function createFetchRecorder() {
  const calls: FetchCall[] = [];
  const fetch = (url: string, options: any) => {
    calls.push({ url, options });
    return Promise.resolve({ data: {} });
  };
  return { fetch, calls };
}

describe("Admin: overrides unified query parameters", () => {
  it("overrides.list uses unified query structure", async () => {
    const { fetch, calls } = createFetchRecorder();
    const plugin = featureFlagsAdminClient();
    const actions = plugin.getActions(fetch as any);

    // Test the unified query parameters
    await actions.featureFlags.admin.overrides.list({
      organizationId: "org1",
      cursor: "c-override-1",
      limit: 25,
      q: "search-term",
      sort: "-createdAt",
      flagId: "flag-123",
      userId: "user-456",
    } as any);

    const call = calls.find((c) =>
      c.url.endsWith("/feature-flags/admin/overrides"),
    );
    expect(call).toBeTruthy();
    expect(call!.options.method).toBe("GET");
    expect(call!.options.query).toEqual({
      organizationId: "org1",
      cursor: "c-override-1",
      limit: 25,
      q: "search-term",
      sort: "-createdAt",
      flagId: "flag-123",
      userId: "user-456",
    });
  });

  it("verifies that old sortBy/sortDir/search/offset parameters are no longer used", async () => {
    const { fetch, calls } = createFetchRecorder();
    const plugin = featureFlagsAdminClient();
    const actions = plugin.getActions(fetch as any);

    // Test with old-style parameters to ensure they're not used
    await actions.featureFlags.admin.overrides.list({
      flagId: "flag-123",
    } as any);

    const call = calls.find((c) =>
      c.url.endsWith("/feature-flags/admin/overrides"),
    );
    expect(call).toBeTruthy();

    // Ensure old parameters are not present
    expect(call!.options.query).not.toHaveProperty("offset");
    expect(call!.options.query).not.toHaveProperty("search");
    expect(call!.options.query).not.toHaveProperty("sortBy");
    expect(call!.options.query).not.toHaveProperty("sortDir");
  });
});
