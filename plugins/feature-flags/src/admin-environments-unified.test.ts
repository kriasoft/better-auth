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

describe("Admin: environments unified features", () => {
  it("environments.list uses unified query structure with cursor pagination", async () => {
    const { fetch, calls } = createFetchRecorder();
    const plugin = featureFlagsAdminClient();
    const actions = plugin.getActions(fetch as any);

    await actions.featureFlags.admin.environments.list({
      organizationId: "org1",
      cursor: "c-env-1",
      limit: 25,
    } as any);

    const call = calls.find((c) =>
      c.url.endsWith("/feature-flags/admin/environments"),
    );
    expect(call).toBeTruthy();
    expect(call!.options.method).toBe("GET");
    expect(call!.options.query).toEqual({
      organizationId: "org1",
      cursor: "c-env-1",
      limit: 25,
    });
  });

  it("environments.create accepts optional key alongside name", async () => {
    const { fetch, calls } = createFetchRecorder();
    const plugin = featureFlagsAdminClient();
    const actions = plugin.getActions(fetch as any);

    await actions.featureFlags.admin.environments.create({
      name: "Development Environment",
      key: "dev",
      description: "Development environment for testing",
      organizationId: "org1",
    } as any);

    const call = calls.find((c) =>
      c.url.endsWith("/feature-flags/admin/environments"),
    );
    expect(call).toBeTruthy();
    expect(call!.options.method).toBe("POST");
    expect(call!.options.body).toEqual({
      name: "Development Environment",
      key: "dev",
      description: "Development environment for testing",
      organizationId: "org1",
    });
  });

  it("verifies that old offset parameter is no longer used", async () => {
    const { fetch, calls } = createFetchRecorder();
    const plugin = featureFlagsAdminClient();
    const actions = plugin.getActions(fetch as any);

    await actions.featureFlags.admin.environments.list({
      organizationId: "org1",
    } as any);

    const call = calls.find((c) =>
      c.url.endsWith("/feature-flags/admin/environments"),
    );
    expect(call).toBeTruthy();

    // Ensure old parameters are not present
    expect(call!.options.query).not.toHaveProperty("offset");
  });
});
