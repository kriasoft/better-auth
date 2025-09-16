// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import { describe, expect, it } from "bun:test";
import { featureFlagsClient } from "./client";

type FetchCall = { url: string; options: any };

function createFetchRecorder() {
  const calls: FetchCall[] = [];
  const fetch = (url: string, options: any) => {
    calls.push({ url, options });
    // Minimal successful response shape per endpoint
    if (url.endsWith("/feature-flags/evaluate")) {
      return Promise.resolve({ data: { value: true, reason: "default" } });
    }
    if (url.endsWith("/feature-flags/evaluate-batch")) {
      return Promise.resolve({
        data: { flags: {}, context: {}, evaluatedAt: new Date().toISOString() },
      });
    }
    if (url.endsWith("/feature-flags/bootstrap")) {
      return Promise.resolve({ data: { flags: {} } });
    }
    if (url.endsWith("/feature-flags/events")) {
      return Promise.resolve({ data: { success: true, eventId: "e1" } });
    }
    if (url.endsWith("/feature-flags/events/batch")) {
      return Promise.resolve({
        data: { success: 1, failed: 0, batchId: "b1" },
      });
    }
    return Promise.resolve({ data: {} });
  };
  return { fetch, calls };
}

describe("Feature Flags client request payloads (new API)", () => {
  it("sends { flagKey, default? } for evaluate", async () => {
    const { fetch, calls } = createFetchRecorder();
    const plugin = featureFlagsClient({ defaults: { a: false } });
    const actions = plugin.getActions(fetch, {}, {});

    await actions.featureFlags.evaluate("a" as any);

    const call = calls.find((c) => c.url.endsWith("/feature-flags/evaluate"));
    expect(call).toBeTruthy();
    expect(call!.options.method).toBe("POST");
    expect(call!.options.body.flagKey).toBe("a");
    expect(call!.options.body).not.toHaveProperty("flag");
    expect(call!.options.body.default).toBe(false);
    expect(call!.options.body).not.toHaveProperty("fallback");
    expect(call!.options.body).not.toHaveProperty("shape");
  });

  it("sends { flagKeys, defaults? } for evaluate-batch and forwards select option", async () => {
    const { fetch, calls } = createFetchRecorder();
    const plugin = featureFlagsClient();
    const actions = plugin.getActions(fetch, {}, {});

    await actions.featureFlags.evaluateMany(["x", "y"] as any, {
      defaults: { x: 1 } as any,
      // Ensure select is forwarded by client
      select: "value" as any,
    });

    const call = calls.find((c) =>
      c.url.endsWith("/feature-flags/evaluate-batch"),
    );
    expect(call).toBeTruthy();
    expect(call!.options.method).toBe("POST");
    expect(call!.options.body.flagKeys).toEqual(["x", "y"]);
    expect(call!.options.body).not.toHaveProperty("flags");
    expect(call!.options.body.defaults).toEqual({ x: 1 });
    expect(call!.options.body).not.toHaveProperty("fallbacks");
    expect(call!.options.body.select).toBe("value");
  });

  it("sends include/prefix/environment for bootstrap and forwards select", async () => {
    const { fetch, calls } = createFetchRecorder();
    const plugin = featureFlagsClient();
    const actions = plugin.getActions(fetch, {}, {});

    await actions.featureFlags.bootstrap({
      include: ["a"],
      prefix: "p:",
      environment: "prod",
      select: "value" as any,
    });

    const call = calls.find((c) => c.url.endsWith("/feature-flags/bootstrap"));
    expect(call).toBeTruthy();
    expect(call!.options.body.include).toEqual(["a"]);
    expect(call!.options.body.prefix).toBe("p:");
    expect(call!.options.body.environment).toBe("prod");
    expect(call!.options.body.select).toBe("value");
  });

  it("includes track and select parameters when provided", async () => {
    const { fetch, calls } = createFetchRecorder();
    const plugin = featureFlagsClient();
    const actions = plugin.getActions(fetch, {}, {});

    await actions.featureFlags.evaluate("test-flag" as any, {
      track: false,
      select: ["value", "reason"],
      debug: true,
    });

    const call = calls.find((c) => c.url.endsWith("/feature-flags/evaluate"));
    expect(call).toBeTruthy();
    expect(call!.options.body.flagKey).toBe("test-flag");
    expect(call!.options.body.track).toBe(false);
    expect(call!.options.body.select).toEqual(["value", "reason"]);
    expect(call!.options.body.debug).toBe(true);
  });

  it("includes track and select in batch evaluation", async () => {
    const { fetch, calls } = createFetchRecorder();
    const plugin = featureFlagsClient();
    const actions = plugin.getActions(fetch, {}, {});

    await actions.featureFlags.evaluateMany(["flag1", "flag2"] as any, {
      track: false,
      select: ["value", "variant"],
    });

    const call = calls.find((c) =>
      c.url.endsWith("/feature-flags/evaluate-batch"),
    );
    expect(call).toBeTruthy();
    expect(call!.options.body.flagKeys).toEqual(["flag1", "flag2"]);
    expect(call!.options.body.track).toBe(false);
    expect(call!.options.body.select).toEqual(["value", "variant"]);
  });

  it("sends { flagKey, event, properties } for single event", async () => {
    const { fetch, calls } = createFetchRecorder();
    const plugin = featureFlagsClient();
    const actions = plugin.getActions(fetch, {}, {});

    await actions.featureFlags.track("f1" as any, "click", { x: 1 });

    const call = calls.find((c) => c.url.endsWith("/feature-flags/events"));
    expect(call).toBeTruthy();
    expect(call!.options.body.flagKey).toBe("f1");
    expect(call!.options.body.event).toBe("click");
    expect(call!.options.body.properties).toEqual({ x: 1 });
    expect(call!.options.body).not.toHaveProperty("flag");
    expect(call!.options.body).not.toHaveProperty("name");
    expect(call!.options.body).not.toHaveProperty("data");
  });

  it("sends { events:[{ flagKey, event, properties }], batchId } for batch events", async () => {
    const { fetch, calls } = createFetchRecorder();
    const plugin = featureFlagsClient();
    const actions = plugin.getActions(fetch, {}, {});

    await actions.featureFlags.trackBatch(
      [
        { flag: "f1" as any, event: "view", data: { a: 1 } },
        { flag: "f2" as any, event: "click", data: 2 },
      ],
      { idempotencyKey: "b-1" },
    );

    const call = calls.find((c) =>
      c.url.endsWith("/feature-flags/events/batch"),
    );
    expect(call).toBeTruthy();
    expect(call!.options.body.idempotencyKey).toBe("b-1");
    const events = call!.options.body.events;
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      flagKey: "f1",
      event: "view",
      properties: { a: 1 },
    });
    expect(events[1]).toMatchObject({
      flagKey: "f2",
      event: "click",
      properties: 2,
    });
    expect(events[0]).not.toHaveProperty("flag");
    expect(events[0]).not.toHaveProperty("name");
    expect(events[0]).not.toHaveProperty("data");
  });
});
