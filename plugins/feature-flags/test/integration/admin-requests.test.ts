// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import { describe, expect, it } from "bun:test";
import { featureFlagsClient } from "../../src/client";
import { featureFlagsAdminClient } from "../../src/client-admin";

type FetchCall = { url: string; options: any };

function createFetchRecorder() {
  const calls: FetchCall[] = [];
  const fetch = (url: string, options: any) => {
    calls.push({ url, options });
    return Promise.resolve({ data: {} });
  };
  return { fetch, calls };
}

describe("Admin: flags list + analytics request mapping", () => {
  it("admin client: flags.list sends new query fields", async () => {
    const { fetch, calls } = createFetchRecorder();
    const plugin = featureFlagsAdminClient();
    const actions = plugin.getActions(fetch as any);

    await actions.featureFlags.admin.flags.list({
      organizationId: "org1",
      cursor: "c-1",
      limit: 25,
      q: "beta",
      sort: "-updatedAt",
      include: "stats",
    } as any);

    const call = calls.find((c) =>
      c.url.endsWith("/feature-flags/admin/flags"),
    );
    expect(call).toBeTruthy();
    expect(call!.options.method).toBe("GET");
    expect(call!.options.query).toEqual({
      organizationId: "org1",
      cursor: "c-1",
      limit: 25,
      q: "beta",
      sort: "-updatedAt",
      include: "stats",
    });
  });

  it("admin client: analytics.stats.get sends harmonized query", async () => {
    const { fetch, calls } = createFetchRecorder();
    const plugin = featureFlagsAdminClient();
    const actions = plugin.getActions(fetch as any);

    await actions.featureFlags.admin.analytics.stats.get("flag-1", {
      granularity: "day",
      start: "2025-01-01",
      end: "2025-01-31",
      timezone: "UTC",
    });

    const call = calls.find((c) =>
      c.url.includes("/feature-flags/admin/flags/flag-1/stats"),
    );
    expect(call).toBeTruthy();
    expect(call!.options.method).toBe("GET");
    expect(call!.options.query).toEqual({
      granularity: "day",
      start: "2025-01-01",
      end: "2025-01-31",
      timezone: "UTC",
    });
  });

  it("admin client: analytics.usage.get sends harmonized query", async () => {
    const { fetch, calls } = createFetchRecorder();
    const plugin = featureFlagsAdminClient();
    const actions = plugin.getActions(fetch as any);

    await actions.featureFlags.admin.analytics.usage.get({
      start: "2025-01-01",
      end: "2025-01-31",
      timezone: "UTC",
      organizationId: "org1",
    } as any);

    const call = calls.find((c) =>
      c.url.endsWith("/feature-flags/admin/metrics/usage"),
    );
    expect(call).toBeTruthy();
    expect(call!.options.method).toBe("GET");
    expect(call!.options.query).toEqual({
      start: "2025-01-01",
      end: "2025-01-31",
      timezone: "UTC",
      organizationId: "org1",
    });
  });

  it("main client: flags.list and analytics mapping", async () => {
    const { fetch, calls } = createFetchRecorder();
    const plugin = featureFlagsClient();
    const actions = plugin.getActions(fetch as any, {}, {} as any);

    await actions.featureFlags.admin.flags.list({
      cursor: "c-2",
      limit: 10,
      q: "rollout",
      sort: "key",
      include: "stats",
    } as any);

    await actions.featureFlags.admin.analytics.stats.get("flag-2", {
      granularity: "week",
      start: "2025-02-01",
      end: "2025-02-28",
      timezone: "America/Los_Angeles",
    });

    await actions.featureFlags.admin.analytics.usage.get({
      start: "2025-02-01",
      end: "2025-02-28",
      timezone: "America/Los_Angeles",
    } as any);

    const listCall = calls.find((c) =>
      c.url.endsWith("/feature-flags/admin/flags"),
    );
    expect(listCall).toBeTruthy();
    expect(listCall!.options.query).toEqual({
      cursor: "c-2",
      limit: 10,
      q: "rollout",
      sort: "key",
      include: "stats",
    });

    const statsCall = calls.find((c) =>
      c.url.includes("/feature-flags/admin/flags/flag-2/stats"),
    );
    expect(statsCall).toBeTruthy();
    expect(statsCall!.options.query).toEqual({
      granularity: "week",
      start: "2025-02-01",
      end: "2025-02-28",
      timezone: "America/Los_Angeles",
    });

    const usageCall = calls.find((c) =>
      c.url.endsWith("/feature-flags/admin/metrics/usage"),
    );
    expect(usageCall).toBeTruthy();
    expect(usageCall!.options.query).toEqual({
      start: "2025-02-01",
      end: "2025-02-28",
      timezone: "America/Los_Angeles",
    });
  });
});
