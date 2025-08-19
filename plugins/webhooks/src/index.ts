// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import type { BetterAuthPlugin } from "better-auth";
import { z } from "zod";

export interface WebhooksOptions {
  events?: {
    [key: string]: boolean;
  };
  signing?: {
    secret: string;
    algorithm?: "sha256" | "sha512";
  };
  retry?: {
    attempts?: number;
    backoff?: "linear" | "exponential";
    initialDelay?: number;
  };
  timeout?: number;
  headers?: Record<string, string>;
}

export function webhooks(options: WebhooksOptions = {}): BetterAuthPlugin {
  return {
    id: "webhooks",
    schema: {
      webhook: {
        modelName: "webhook",
        fields: {
          id: { type: "string" },
          url: { type: "string" },
          events: { type: "string" }, // JSON array of event names
          secret: { type: "string" },
          active: { type: "boolean", defaultValue: true },
          headers: { type: "string" }, // JSON object
          createdAt: { type: "date", defaultValue: new Date() },
          updatedAt: { type: "date", defaultValue: new Date() },
        },
      },
      webhookDelivery: {
        modelName: "webhookDelivery",
        fields: {
          id: { type: "string" },
          webhookId: {
            type: "string",
            references: { model: "webhook", field: "id", onDelete: "cascade" },
          },
          event: { type: "string" },
          payload: { type: "string" }, // JSON payload
          status: { type: "string" }, // pending, success, failed
          statusCode: { type: "number" },
          response: { type: "string" },
          attempts: { type: "number", defaultValue: 0 },
          lastAttemptAt: { type: "date" },
          nextRetryAt: { type: "date" },
          createdAt: { type: "date", defaultValue: new Date() },
        },
      },
    },
    // Endpoint and hook implementations would go here
  };
}

export default webhooks;
