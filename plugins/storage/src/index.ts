// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

// Server-side exports
export {
  storagePlugin,
  type ConnectPluginOptions as StoragePluginOptions,
  type CloudProvider,
} from "./plugin";
export { connectSchema as storageSchema } from "./schema";
export {
  googleDriveProvider,
  GoogleDriveSource,
  type GoogleDriveFile,
} from "./sources/google-drive";
export {
  oneDriveProvider,
  OneDriveSource,
  type OneDriveFile,
} from "./sources/onedrive";

// Client-side exports
export {
  storageClient,
  type ConnectClientOptions as StorageClientOptions,
  type ConnectedAccount,
  type SyncedFile,
  type SyncStatus,
} from "./client";
