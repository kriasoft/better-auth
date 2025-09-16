// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

/** Smart poller with exponential backoff and jitter to prevent thundering herd */
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
    this.maxInterval = Math.min(baseInterval * 10, 300000); // Cap at 5 minutes
  }

  start(): void {
    this.stop(); // Prevent duplicate timers
    this.scheduleNext();
  }

  stop(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private scheduleNext(): void {
    // Jitter: ±25% to prevent synchronized requests
    const jitter = Math.random() * this.currentInterval * 0.25;
    const delay = this.currentInterval + jitter;

    this.timer = setTimeout(() => {
      this.execute();
    }, delay);
  }

  private async execute(): Promise<void> {
    try {
      await this.task();
      // Success: reset backoff
      this.consecutiveErrors = 0;
      this.currentInterval = this.baseInterval;
    } catch (error) {
      this.consecutiveErrors++;

      // Exponential backoff: 2^attempt with cap
      if (this.consecutiveErrors <= this.maxRetries) {
        this.currentInterval = Math.min(
          this.baseInterval * Math.pow(2, this.consecutiveErrors),
          this.maxInterval,
        );
      }

      this.onError?.(error as Error);
    }

    // Continue polling cycle
    this.scheduleNext();
  }

  /** Forces immediate execution, useful for reconnection scenarios */
  async refreshNow(): Promise<void> {
    this.stop(); // Cancel current timer
    await this.execute(); // Execute immediately
  }
}
