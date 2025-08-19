// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import { SmartPoller } from "./polling";

describe("SmartPoller", () => {
  let poller: SmartPoller | null = null;

  afterEach(() => {
    poller?.stop();
    poller = null;
  });

  it("should add jitter to prevent thundering herd", async () => {
    const executions: number[] = [];
    const task = mock(async () => {
      executions.push(Date.now());
    });

    // Create multiple pollers with same interval
    const pollers: SmartPoller[] = [];
    for (let i = 0; i < 5; i++) {
      const p = new SmartPoller(100, task);
      p.start();
      pollers.push(p);
    }

    // Wait for first execution
    await new Promise((resolve) => setTimeout(resolve, 150));

    // Stop all pollers
    pollers.forEach((p) => p.stop());

    // Check that execution times are spread out (jittered)
    expect(task).toHaveBeenCalledTimes(5);
    const times = executions.sort((a, b) => a - b);
    const spread = times[times.length - 1] - times[0];
    expect(spread).toBeGreaterThan(0); // Should have some spread due to jitter
  });

  it("should implement exponential backoff on errors", async () => {
    let attempts = 0;
    const executionTimes: number[] = [];

    const task = mock(async () => {
      executionTimes.push(Date.now());
      attempts++;
      if (attempts <= 3) {
        throw new Error("Test error");
      }
    });

    const onError = mock(() => {});

    poller = new SmartPoller(50, task, onError);
    poller.start();

    // Wait for multiple attempts
    await new Promise((resolve) => setTimeout(resolve, 500));
    poller.stop();

    expect(attempts).toBeGreaterThanOrEqual(3);
    expect(onError).toHaveBeenCalled();

    // Check that intervals are increasing (backoff)
    if (executionTimes.length >= 3) {
      const interval1 = executionTimes[1] - executionTimes[0];
      const interval2 = executionTimes[2] - executionTimes[1];
      expect(interval2).toBeGreaterThan(interval1);
    }
  });

  it("should reset interval after successful execution", async () => {
    let attempts = 0;
    const task = mock(async () => {
      attempts++;
      if (attempts === 1) {
        throw new Error("First attempt fails");
      }
      // Subsequent attempts succeed
    });

    poller = new SmartPoller(50, task);
    poller.start();

    await new Promise((resolve) => setTimeout(resolve, 300));
    poller.stop();

    expect(attempts).toBeGreaterThanOrEqual(2);
  });

  it("should support immediate refresh", async () => {
    let executed = false;
    const task = mock(async () => {
      executed = true;
    });

    poller = new SmartPoller(10000, task); // Long interval
    poller.start();

    // Should not execute immediately with start()
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(executed).toBe(false);

    // Force immediate refresh
    await poller.refreshNow();
    expect(executed).toBe(true);
    expect(task).toHaveBeenCalledTimes(1);
  });

  it("should cap maximum interval", async () => {
    let attempts = 0;
    const executionTimes: number[] = [];

    const task = mock(async () => {
      executionTimes.push(Date.now());
      attempts++;
      throw new Error("Always fails");
    });

    poller = new SmartPoller(100, task);
    poller.start();

    // Let it run for a while
    await new Promise((resolve) => setTimeout(resolve, 2000));
    poller.stop();

    // After many failures, interval should be capped
    // The max interval should be 1000ms (100 * 10)
    const lastIntervals = [];
    for (
      let i = executionTimes.length - 2;
      i >= Math.max(0, executionTimes.length - 4);
      i--
    ) {
      lastIntervals.push(executionTimes[i + 1] - executionTimes[i]);
    }

    if (lastIntervals.length > 0) {
      const avgLastInterval =
        lastIntervals.reduce((a, b) => a + b, 0) / lastIntervals.length;
      expect(avgLastInterval).toBeLessThanOrEqual(1500); // Should be around 1000ms + jitter
    }
  });
});
