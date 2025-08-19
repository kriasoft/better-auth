// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import type { BetterAuthPlugin } from "better-auth";

export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  interval: "month" | "year" | "week" | "day";
  features?: string[];
  metadata?: Record<string, any>;
}

export interface SubscriptionOptions {
  provider?: "stripe" | "paddle" | "lemonsqueezy" | "custom";
  plans?: SubscriptionPlan[];
  trial?: {
    enabled?: boolean;
    days?: number;
    requirePaymentMethod?: boolean;
  };
  webhooks?: {
    paymentFailed?: (subscription: any) => Promise<void>;
    subscriptionUpdated?: (subscription: any) => Promise<void>;
    subscriptionCanceled?: (subscription: any) => Promise<void>;
    trialEnding?: (subscription: any) => Promise<void>;
  };
  customProvider?: {
    createCustomer: (user: any) => Promise<string>;
    createSubscription: (customerId: string, planId: string) => Promise<any>;
    updateSubscription: (
      subscriptionId: string,
      planId: string,
    ) => Promise<any>;
    cancelSubscription: (subscriptionId: string) => Promise<void>;
  };
}

export function subscription(
  options: SubscriptionOptions = {},
): BetterAuthPlugin {
  return {
    id: "subscription",
    schema: {
      subscription: {
        modelName: "subscription",
        fields: {
          id: { type: "string" },
          userId: {
            type: "string",
            references: { model: "user", field: "id", onDelete: "cascade" },
          },
          planId: { type: "string" },
          status: { type: "string" }, // active, trialing, past_due, canceled
          currentPeriodStart: { type: "date" },
          currentPeriodEnd: { type: "date" },
          cancelAt: { type: "date" },
          canceledAt: { type: "date" },
          trialStart: { type: "date" },
          trialEnd: { type: "date" },
          customerId: { type: "string" },
          subscriptionId: { type: "string" }, // Provider subscription ID
          metadata: { type: "string" }, // JSON metadata
          createdAt: { type: "date", defaultValue: new Date() },
          updatedAt: { type: "date", defaultValue: new Date() },
        },
      },
      invoice: {
        modelName: "invoice",
        fields: {
          id: { type: "string" },
          subscriptionId: {
            type: "string",
            references: {
              model: "subscription",
              field: "id",
              onDelete: "cascade",
            },
          },
          amount: { type: "number" },
          currency: { type: "string", defaultValue: "usd" },
          status: { type: "string" }, // paid, pending, failed
          invoiceNumber: { type: "string" },
          invoiceUrl: { type: "string" },
          paidAt: { type: "date" },
          createdAt: { type: "date", defaultValue: new Date() },
        },
      },
    },
    // Implementation would go here
  };
}

export default subscription;
