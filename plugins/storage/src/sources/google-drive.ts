// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import type { CloudProvider } from "../plugin";

export interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  parents?: string[];
  webViewLink?: string;
  webContentLink?: string;
  thumbnailLink?: string;
  modifiedTime: string;
  createdTime: string;
  trashed: boolean;
}

export class GoogleDriveSource {
  private accessToken: string;
  private refreshToken?: string;

  constructor(accessToken: string, refreshToken?: string) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
  }

  /**
   * List files from Google Drive
   */
  async listFiles(
    options: {
      pageToken?: string;
      pageSize?: number;
      query?: string;
      fields?: string;
    } = {},
  ) {
    const params = new URLSearchParams({
      pageSize: (options.pageSize || 100).toString(),
      fields:
        options.fields ||
        "nextPageToken,files(id,name,mimeType,size,parents,webViewLink,webContentLink,thumbnailLink,modifiedTime,createdTime,trashed)",
      q: options.query || "trashed=false",
    });

    if (options.pageToken) {
      params.set("pageToken", options.pageToken);
    }

    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files?${params}`,
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to list files: ${response.statusText}`);
    }

    return response.json() as Promise<{
      files: GoogleDriveFile[];
      nextPageToken?: string;
    }>;
  }

  /**
   * Get file metadata
   */
  async getFile(fileId: string) {
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?fields=*`,
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to get file: ${response.statusText}`);
    }

    return response.json() as Promise<GoogleDriveFile>;
  }

  /**
   * Get changes since last sync
   */
  async getChanges(pageToken?: string) {
    const params = new URLSearchParams({
      pageSize: "100",
      fields:
        "nextPageToken,newStartPageToken,changes(file(id,name,mimeType,size,parents,webViewLink,webContentLink,thumbnailLink,modifiedTime,createdTime,trashed),removed,fileId)",
    });

    if (pageToken) {
      params.set("pageToken", pageToken);
    } else {
      // Get starting page token for initial sync
      const startTokenResponse = await fetch(
        "https://www.googleapis.com/drive/v3/changes/startPageToken",
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        },
      );

      if (!startTokenResponse.ok) {
        throw new Error(
          `Failed to get start page token: ${startTokenResponse.statusText}`,
        );
      }

      const { startPageToken } = await startTokenResponse.json();
      params.set("pageToken", startPageToken);
    }

    const response = await fetch(
      `https://www.googleapis.com/drive/v3/changes?${params}`,
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to get changes: ${response.statusText}`);
    }

    return response.json() as Promise<{
      changes: Array<{
        file?: GoogleDriveFile;
        removed: boolean;
        fileId: string;
      }>;
      nextPageToken?: string;
      newStartPageToken?: string;
    }>;
  }

  /**
   * Download file content
   */
  async downloadFile(fileId: string) {
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.statusText}`);
    }

    return response;
  }

  /**
   * Create webhook subscription
   */
  async createWebhook(
    webhookUrl: string,
    channelId: string,
    channelToken: string,
  ) {
    const response = await fetch(
      "https://www.googleapis.com/drive/v3/changes/watch",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: channelId,
          type: "web_hook",
          address: webhookUrl,
          token: channelToken,
          expiration: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to create webhook: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Stop webhook subscription
   */
  async stopWebhook(channelId: string, resourceId: string) {
    const response = await fetch(
      "https://www.googleapis.com/drive/v3/channels/stop",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: channelId,
          resourceId: resourceId,
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to stop webhook: ${response.statusText}`);
    }

    return { success: true };
  }
}

/**
 * Google Drive OAuth configuration
 */
export const googleDriveProvider: CloudProvider = {
  id: "google-drive",
  name: "Google Drive",
  clientId: process.env.GOOGLE_DRIVE_CLIENT_ID || "",
  clientSecret: process.env.GOOGLE_DRIVE_CLIENT_SECRET || "",
  authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenUrl: "https://oauth2.googleapis.com/token",
  userInfoUrl: "https://www.googleapis.com/oauth2/v2/userinfo",
  scopes: [
    "https://www.googleapis.com/auth/drive.readonly",
    "https://www.googleapis.com/auth/drive.metadata.readonly",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
  ],
};
