# Better Auth Storage

A Better Auth plugin that enables users to connect their cloud storage accounts (Google Drive, OneDrive, etc.) and sync files with your application.

## 🚧 Work in Progress

This package is currently under development. The MCP plugin will enable:

- 🔗 OAuth integration for multiple cloud storage providers
- 📁 Automatic file synchronization
- 🔄 Real-time updates via webhooks
- 🔒 Secure token storage and refresh
- 📊 Sync status tracking
- 🎯 TypeScript support with full type safety

## Installation

```bash
bun add better-auth-storage
# or
npm install better-auth-storage
```

## Setup

### 1. Configure the Plugin

```typescript
import { betterAuth } from "better-auth";
import {
  storagePlugin,
  googleDriveProvider,
  oneDriveProvider,
} from "better-auth-storage";

export const auth = betterAuth({
  // ... your other auth config
  plugins: [
    storagePlugin({
      providers: [
        googleDriveProvider, // Uses env vars: GOOGLE_DRIVE_CLIENT_ID, GOOGLE_DRIVE_CLIENT_SECRET
        oneDriveProvider, // Uses env vars: ONEDRIVE_CLIENT_ID, ONEDRIVE_CLIENT_SECRET
      ],
      sync: {
        interval: 300, // Sync every 5 minutes
        batchSize: 100, // Process 100 files per sync
        allowedTypes: ["image/*", "application/pdf"],
      },
      storage: {
        maxSizePerUser: 1073741824, // 1GB per user
        maxFileSize: 104857600, // 100MB per file
      },
    }),
  ],
});
```

### 2. Set Up Environment Variables

```env
# Google Drive OAuth
GOOGLE_DRIVE_CLIENT_ID=your_client_id
GOOGLE_DRIVE_CLIENT_SECRET=your_client_secret

# OneDrive OAuth
ONEDRIVE_CLIENT_ID=your_client_id
ONEDRIVE_CLIENT_SECRET=your_client_secret
```

### 3. Client-Side Integration

```typescript
import { createAuthClient } from "better-auth/client";
import { storageClient } from "better-auth-storage/client";

const authClient = createAuthClient({
  plugins: [storageClient()],
});

// List available providers
const { providers } = await authClient.connect.listProviders();

// Connect a storage account
await authClient.connect.authorize("google-drive", {
  callbackURL: "/dashboard",
  errorCallbackURL: "/connect/error",
});

// List connected accounts
const { accounts } = await authClient.connect.listAccounts();

// Trigger manual sync
const { syncId } = await authClient.connect.syncAccount(accountId);

// Check sync status
const status = await authClient.connect.getSyncStatus(accountId);

// List synced files
const { files, total } = await authClient.connect.listFiles({
  accountId: accountId,
  limit: 50,
  mimeType: "image/jpeg",
});

// Disconnect an account
await authClient.connect.disconnectAccount(accountId);
```

## Database Schema

The plugin creates three tables:

- `connected_accounts` - Stores OAuth tokens and account metadata
- `synced_files` - Tracks synchronized files
- `sync_status` - Monitors sync operations

## API Endpoints

### Connection Management

- `GET /connect/providers` - List available storage providers
- `POST /connect/authorize/:providerId` - Initiate OAuth flow
- `GET /connect/callback/:providerId` - Handle OAuth callback
- `GET /connect/accounts` - List connected accounts
- `DELETE /connect/accounts/:accountId` - Disconnect account

### File Synchronization

- `POST /connect/sync/:accountId` - Trigger manual sync
- `GET /connect/sync/:accountId/status` - Get sync status
- `GET /connect/files` - List synced files
- `GET /connect/files/:fileId` - Get file details

### Webhooks

- `POST /connect/webhook/google-drive` - Google Drive notifications
- `POST /connect/webhook/onedrive` - OneDrive notifications
- `POST /connect/webhook/register` - Register webhook for account

## Security

- OAuth tokens are stored encrypted in the database
- Rate limiting on sync operations (10 requests/minute)
- Rate limiting on authorization (5 requests/minute)
- Webhook signature verification
- User ownership verification on all operations

## License

MIT
