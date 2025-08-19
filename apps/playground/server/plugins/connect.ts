// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import type { ConnectPluginOptions, DataSource } from "better-auth-connect";
import { connectPlugin } from "better-auth-connect";
import type { Env } from "../env";
import { getPluginStatus } from "../env";

/**
 * Connect Plugin Configuration
 *
 * Provides data source connection management with:
 * - OAuth-based connections (Google Drive, Gmail, GitHub, etc.)
 * - API key management
 * - Webhook handling
 * - Data synchronization
 * - Token management
 */
export function getConnectPlugin(env: Env): ReturnType<typeof connectPlugin> | null {
  const pluginStatus = getPluginStatus(env);
  
  // Check if connect plugin is enabled
  if (!pluginStatus.connect) {
    return null;
  }

  // Define available data sources
  const dataSources: DataSource[] = [];

  // Google Drive integration
  if (env.GOOGLE_DRIVE_CLIENT_ID && env.GOOGLE_DRIVE_CLIENT_SECRET) {
    dataSources.push({
      id: "google-drive",
      name: "Google Drive",
      type: "oauth",
      scopes: [
        "https://www.googleapis.com/auth/drive.file",
        "https://www.googleapis.com/auth/drive.readonly",
        "https://www.googleapis.com/auth/userinfo.email",
      ],
      authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenUrl: "https://oauth2.googleapis.com/token",
      clientId: env.GOOGLE_DRIVE_CLIENT_ID,
      clientSecret: env.GOOGLE_DRIVE_CLIENT_SECRET,
    });
  }

  // Gmail integration
  if (env.GMAIL_CLIENT_ID && env.GMAIL_CLIENT_SECRET) {
    dataSources.push({
      id: "gmail",
      name: "Gmail",
      type: "oauth",
      scopes: [
        "https://www.googleapis.com/auth/gmail.readonly",
        "https://www.googleapis.com/auth/gmail.metadata",
        "https://www.googleapis.com/auth/userinfo.email",
      ],
      authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenUrl: "https://oauth2.googleapis.com/token",
      clientId: env.GMAIL_CLIENT_ID,
      clientSecret: env.GMAIL_CLIENT_SECRET,
    });
  }

  // GitHub integration
  if (env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET) {
    dataSources.push({
      id: "github",
      name: "GitHub",
      type: "oauth",
      scopes: ["repo", "read:org", "user:email"],
      authUrl: "https://github.com/login/oauth/authorize",
      tokenUrl: "https://github.com/login/oauth/access_token",
      clientId: env.GITHUB_CLIENT_ID,
      clientSecret: env.GITHUB_CLIENT_SECRET,
    });
  }

  // OneDrive integration
  if (env.ONEDRIVE_CLIENT_ID && env.ONEDRIVE_CLIENT_SECRET) {
    dataSources.push({
      id: "onedrive",
      name: "OneDrive",
      type: "oauth",
      scopes: ["Files.Read", "Files.Read.All", "User.Read", "offline_access"],
      authUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
      tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
      clientId: env.ONEDRIVE_CLIENT_ID,
      clientSecret: env.ONEDRIVE_CLIENT_SECRET,
    });
  }

  // Dropbox integration
  if (env.DROPBOX_CLIENT_ID && env.DROPBOX_CLIENT_SECRET) {
    dataSources.push({
      id: "dropbox",
      name: "Dropbox",
      type: "oauth",
      scopes: [
        "files.metadata.read",
        "files.content.read",
        "account_info.read",
      ],
      authUrl: "https://www.dropbox.com/oauth2/authorize",
      tokenUrl: "https://api.dropboxapi.com/oauth2/token",
      clientId: env.DROPBOX_CLIENT_ID,
      clientSecret: env.DROPBOX_CLIENT_SECRET,
    });
  }

  // Slack integration
  if (env.SLACK_CLIENT_ID && env.SLACK_CLIENT_SECRET) {
    dataSources.push({
      id: "slack",
      name: "Slack",
      type: "oauth",
      scopes: ["channels:read", "chat:write", "users:read", "team:read"],
      authUrl: "https://slack.com/oauth/v2/authorize",
      tokenUrl: "https://slack.com/api/oauth.v2.access",
      clientId: env.SLACK_CLIENT_ID,
      clientSecret: env.SLACK_CLIENT_SECRET,
    });
  }

  // Notion integration
  if (env.NOTION_CLIENT_ID && env.NOTION_CLIENT_SECRET) {
    dataSources.push({
      id: "notion",
      name: "Notion",
      type: "oauth",
      authUrl: "https://api.notion.com/v1/oauth/authorize",
      tokenUrl: "https://api.notion.com/v1/oauth/token",
      clientId: env.NOTION_CLIENT_ID,
      clientSecret: env.NOTION_CLIENT_SECRET,
    });
  }

  const config: ConnectPluginOptions = {
    // Use configured data sources or fall back to empty array
    sources: dataSources.length > 0 ? dataSources : undefined,

    // Sync configuration
    syncInterval: env.CONNECT_SYNC_INTERVAL, // 5 minutes default
    maxSyncSize: env.CONNECT_MAX_SYNC_SIZE, // 100MB default

    // Webhook secret for signature verification
    webhookSecret: env.CONNECT_WEBHOOK_SECRET,

    // Connection lifecycle callbacks
    onConnect: async (source, userId, metadata) => {
      console.log("User connected to source:", {
        source,
        userId,
        metadata,
        timestamp: new Date().toISOString(),
      });

      // Example: Track connection in analytics
      // await analytics.track({
      //   userId,
      //   event: "Source Connected",
      //   properties: { source, metadata },
      // });

      // Example: Send welcome notification
      // await sendNotification(userId, {
      //   type: "source_connected",
      //   source,
      //   message: `Successfully connected to ${source}`,
      // });
    },

    onDisconnect: async (source, userId) => {
      console.log("User disconnected from source:", {
        source,
        userId,
        timestamp: new Date().toISOString(),
      });

      // Example: Cleanup related data
      // await cleanupSourceData(userId, source);

      // Example: Track disconnection
      // await analytics.track({
      //   userId,
      //   event: "Source Disconnected",
      //   properties: { source },
      // });
    },

    onSync: async (source, userId, data) => {
      console.log("Syncing data from source:", {
        source,
        userId,
        dataSize: JSON.stringify(data).length,
        timestamp: new Date().toISOString(),
      });

      // Example: Process synced data
      // switch (source) {
      //   case "google-drive":
      //     await processGoogleDriveData(userId, data);
      //     break;
      //   case "github":
      //     await processGitHubData(userId, data);
      //     break;
      //   default:
      //     console.log("No processor for source:", source);
      // }

      // Example: Update last sync timestamp
      // await updateLastSync(userId, source);
    },
  };

  return connectPlugin(config);
}
