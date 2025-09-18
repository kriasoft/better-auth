// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

export interface DataSource {
  id: string;
  name: string;
  type: "oauth" | "api_key" | "webhook";
  scopes?: string[];
  authUrl?: string;
  tokenUrl?: string;
  clientId?: string;
  clientSecret?: string;
}

export interface ConnectPluginOptions {
  sources?: DataSource[];
  syncInterval?: number;
  maxSyncSize?: number;
  webhookSecret?: string;
  onConnect?: (source: string, userId: string, metadata: any) => Promise<void>;
  onDisconnect?: (source: string, userId: string) => Promise<void>;
  onSync?: (source: string, userId: string, data: any) => Promise<void>;
}
