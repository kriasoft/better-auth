// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import type { BetterAuthClientPlugin } from "better-auth/client";

export interface WebhooksClient {
  webhooks: {
    list: () => Promise<any[]>;
    create: (webhook: any) => Promise<any>;
    update: (id: string, webhook: any) => Promise<any>;
    delete: (id: string) => Promise<void>;
    test: (id: string) => Promise<any>;
    getDeliveries: (webhookId: string) => Promise<any[]>;
  };
}

export function webhooksClient(): BetterAuthClientPlugin {
  return {
    id: "webhooks",
    $InferServerPlugin: {} as any,
  };
}

export default webhooksClient;
