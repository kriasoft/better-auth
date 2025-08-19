// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import type { BetterAuthClientPlugin } from "better-auth/client";

export interface SubscriptionClient {
  subscription: {
    getPlans: () => Promise<any[]>;
    getCurrentSubscription: () => Promise<any>;
    subscribe: (planId: string, paymentMethodId?: string) => Promise<any>;
    updateSubscription: (planId: string) => Promise<any>;
    cancelSubscription: (immediately?: boolean) => Promise<void>;
    resumeSubscription: () => Promise<any>;
    getInvoices: () => Promise<any[]>;
    getPaymentMethods: () => Promise<any[]>;
    addPaymentMethod: (paymentMethodId: string) => Promise<void>;
  };
}

export function subscriptionClient(): BetterAuthClientPlugin {
  return {
    id: "subscription",
    $InferServerPlugin: {} as any,
  };
}

export default subscriptionClient;
