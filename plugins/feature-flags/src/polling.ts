// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

/**
 * Smart polling implementation with exponential backoff and jitter
 */
export class SmartPoller {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private currentInterval: number;
  private consecutiveErrors = 0;
  private readonly maxInterval: number;
  private readonly maxRetries = 5;

  constructor(
    private readonly baseInterval: number,
    private readonly task: () => Promise<void>,
    private readonly onError?: (error: Error) => void,
  ) {
    this.currentInterval = baseInterval;
    this.maxInterval = Math.min(baseInterval * 10, 300000); // Max 5 minutes
  }

  start(): void {
    this.stop(); // Ensure no duplicate timers
    this.scheduleNext();
  }

  stop(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private scheduleNext(): void {
    // Add jitter: 0-25% of current interval
    const jitter = Math.random() * this.currentInterval * 0.25;
    const delay = this.currentInterval + jitter;

    this.timer = setTimeout(() => {
      this.execute();
    }, delay);
  }

  private async execute(): Promise<void> {
    try {
      await this.task();
      // Success - reset error count and interval
      this.consecutiveErrors = 0;
      this.currentInterval = this.baseInterval;
    } catch (error) {
      this.consecutiveErrors++;

      // Exponential backoff with cap
      if (this.consecutiveErrors <= this.maxRetries) {
        this.currentInterval = Math.min(
          this.baseInterval * Math.pow(2, this.consecutiveErrors),
          this.maxInterval,
        );
      }

      this.onError?.(error as Error);
    }

    // Schedule next execution
    this.scheduleNext();
  }

  /**
   * Force an immediate refresh (e.g., on reconnection)
   */
  async refreshNow(): Promise<void> {
    this.stop();
    await this.execute();
  }
}
