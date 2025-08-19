// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import type { BetterAuthPlugin } from "better-auth";

export interface NotificationChannel {
  provider: string;
  [key: string]: any;
}

export interface NotificationTemplate {
  [channel: string]: {
    subject?: string;
    body?: string;
    html?: string;
    [key: string]: any;
  };
}

export interface NotificationsOptions {
  channels?: {
    email?: NotificationChannel;
    sms?: NotificationChannel;
    push?: NotificationChannel;
    inApp?: NotificationChannel;
  };
  templates?: Record<string, NotificationTemplate>;
  events?: Record<string, string[]>;
  rateLimit?: {
    perUser?: number;
    perHour?: number;
  };
}

export function notificationsPlugin(
  options?: NotificationsOptions,
): BetterAuthPlugin {
  return {
    id: "notifications",
    init() {
      // Initialize notification providers
    },
    hooks: {
      after: [
        {
          matcher(ctx) {
            // Match auth events that trigger notifications
            return true;
          },
          handler: async (ctx) => {
            // TODO: Send notifications based on events
            return;
          },
        },
      ],
    },
  };
}
