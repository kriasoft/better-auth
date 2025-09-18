// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

export interface ConnectedAccount {
  id: string;
  userId: string;
  provider: string;
  providerAccountId: string;
  providerAccountEmail?: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date | null;
  scope?: string;
  lastSyncedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SyncedFile {
  id: string;
  connectedAccountId: string;
  providerFileId: string;
  name: string;
  mimeType: string;
  size: number;
  parentId?: string | null;
  webUrl?: string | null;
  downloadUrl?: string | null;
  thumbnailUrl?: string | null;
  modifiedTime: Date;
  syncedAt: Date;
  provider: string;
  metadata?: Record<string, any>;
}

export interface VerificationToken {
  identifier: string;
  token: string;
  expiresAt: Date;
}

export interface SyncStatus {
  id: string;
  connectedAccountId: string;
  status: "in_progress" | "completed" | "failed";
  startedAt: Date;
  completedAt?: Date | null;
  filesProcessed?: number;
  filesTotal?: number;
  error?: string;
}
