// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import type { CloudProvider } from "../plugin";

export interface OneDriveFile {
  id: string;
  name: string;
  size?: number;
  parentReference?: {
    id?: string;
    path?: string;
  };
  file?: {
    mimeType: string;
    hashes?: {
      quickXorHash?: string;
      sha1Hash?: string;
      sha256Hash?: string;
    };
  };
  folder?: {
    childCount: number;
  };
  webUrl?: string;
  "@microsoft.graph.downloadUrl"?: string;
  thumbnails?: Array<{
    id: string;
    large?: { url: string };
    medium?: { url: string };
    small?: { url: string };
  }>;
  lastModifiedDateTime: string;
  createdDateTime: string;
  deleted?: {
    state: string;
  };
}

export class OneDriveSource {
  private accessToken: string;
  private refreshToken?: string;

  constructor(accessToken: string, refreshToken?: string) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
  }

  /**
   * List files from OneDrive
   */
  async listFiles(
    options: {
      path?: string;
      skipToken?: string;
      top?: number;
      select?: string;
      filter?: string;
    } = {},
  ) {
    const params = new URLSearchParams();

    if (options.skipToken) {
      params.set("$skiptoken", options.skipToken);
    }
    if (options.top) {
      params.set("$top", options.top.toString());
    }
    if (options.select) {
      params.set("$select", options.select);
    }
    if (options.filter) {
      params.set("$filter", options.filter);
    }

    const basePath = options.path || "/me/drive/root";
    const url = `https://graph.microsoft.com/v1.0${basePath}/children${params.toString() ? `?${params}` : ""}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to list files: ${response.statusText}`);
    }

    return response.json() as Promise<{
      value: OneDriveFile[];
      "@odata.nextLink"?: string;
    }>;
  }

  /**
   * Get file metadata
   */
  async getFile(fileId: string) {
    const response = await fetch(
      `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}`,
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to get file: ${response.statusText}`);
    }

    return response.json() as Promise<OneDriveFile>;
  }

  /**
   * Get delta changes since last sync
   */
  async getDelta(deltaLink?: string) {
    const url =
      deltaLink || "https://graph.microsoft.com/v1.0/me/drive/root/delta";

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get delta: ${response.statusText}`);
    }

    return response.json() as Promise<{
      value: OneDriveFile[];
      "@odata.nextLink"?: string;
      "@odata.deltaLink"?: string;
    }>;
  }

  /**
   * Download file content
   */
  async downloadFile(fileId: string) {
    // First get the download URL
    const metadata = await this.getFile(fileId);

    if (!metadata["@microsoft.graph.downloadUrl"]) {
      throw new Error("Download URL not available");
    }

    const response = await fetch(metadata["@microsoft.graph.downloadUrl"]);

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
    clientState: string,
    expirationDateTime?: Date,
  ) {
    const expiration =
      expirationDateTime || new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 3 days

    const response = await fetch(
      "https://graph.microsoft.com/v1.0/subscriptions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          changeType: "created,updated,deleted",
          notificationUrl: webhookUrl,
          resource: "/me/drive/root",
          expirationDateTime: expiration.toISOString(),
          clientState: clientState,
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to create webhook: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Update webhook subscription
   */
  async updateWebhook(subscriptionId: string, expirationDateTime: Date) {
    const response = await fetch(
      `https://graph.microsoft.com/v1.0/subscriptions/${subscriptionId}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          expirationDateTime: expirationDateTime.toISOString(),
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to update webhook: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Delete webhook subscription
   */
  async deleteWebhook(subscriptionId: string) {
    const response = await fetch(
      `https://graph.microsoft.com/v1.0/subscriptions/${subscriptionId}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      },
    );

    if (!response.ok && response.status !== 404) {
      throw new Error(`Failed to delete webhook: ${response.statusText}`);
    }

    return { success: true };
  }

  /**
   * Get user info
   */
  async getUserInfo() {
    const response = await fetch("https://graph.microsoft.com/v1.0/me", {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get user info: ${response.statusText}`);
    }

    return response.json();
  }
}

/**
 * OneDrive OAuth configuration
 */
export const oneDriveProvider: CloudProvider = {
  id: "onedrive",
  name: "OneDrive",
  clientId: process.env.ONEDRIVE_CLIENT_ID || "",
  clientSecret: process.env.ONEDRIVE_CLIENT_SECRET || "",
  authorizationUrl:
    "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
  tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
  userInfoUrl: "https://graph.microsoft.com/v1.0/me",
  scopes: ["Files.Read", "Files.Read.All", "User.Read", "offline_access"],
};
