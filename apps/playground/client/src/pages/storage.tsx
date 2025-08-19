import { useState, useEffect } from "react";
import { Routes, Route, Link, useNavigate } from "react-router-dom";
import { authClient } from "../auth-client";

interface ConnectedAccount {
  id: string;
  provider: string;
  providerAccountEmail: string;
  lastSyncAt: string | null;
  syncStatus: string;
}

interface SyncedFile {
  id: string;
  fileName: string;
  filePath: string;
  mimeType: string;
  size: number;
  modifiedAt: string;
  webViewLink?: string;
}

export function StoragePage() {
  return (
    <Routes>
      <Route index element={<StorageOverview />} />
      <Route path="connect" element={<ConnectProvider />} />
      <Route path="files" element={<SyncedFiles />} />
    </Routes>
  );
}

function StorageOverview() {
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchConnectedAccounts();
  }, []);

  const fetchConnectedAccounts = async () => {
    try {
      const response = await fetch("/api/storage/accounts", {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setAccounts(data.accounts || []);
      }
    } catch (error) {
      console.error("Failed to fetch accounts:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async (accountId: string) => {
    try {
      await authClient.storage.sync({ accountId });
      fetchConnectedAccounts();
    } catch (error) {
      console.error("Sync failed:", error);
    }
  };

  const handleDisconnect = async (accountId: string) => {
    try {
      await authClient.storage.disconnect({ accountId });
      fetchConnectedAccounts();
    } catch (error) {
      console.error("Disconnect failed:", error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Cloud Storage</h1>
        <Link
          to="/storage/connect"
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
        >
          Connect Provider
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-6">
          <h2 className="text-xl font-semibold mb-4">Connected Accounts</h2>

          {loading ? (
            <p className="text-gray-600">Loading...</p>
          ) : accounts.length > 0 ? (
            <div className="space-y-4">
              {accounts.map((account) => (
                <div
                  key={account.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div>
                    <div className="flex items-center space-x-2">
                      <ProviderIcon provider={account.provider} />
                      <span className="font-medium">
                        {getProviderName(account.provider)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      {account.providerAccountEmail}
                    </p>
                    {account.lastSyncAt && (
                      <p className="text-xs text-gray-500 mt-1">
                        Last synced:{" "}
                        {new Date(account.lastSyncAt).toLocaleString()}
                      </p>
                    )}
                  </div>

                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleSync(account.id)}
                      className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                    >
                      Sync Now
                    </button>
                    <button
                      onClick={() => handleDisconnect(account.id)}
                      className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                    >
                      Disconnect
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-600 mb-4">
                No cloud storage accounts connected
              </p>
              <Link
                to="/storage/connect"
                className="text-blue-600 hover:text-blue-700"
              >
                Connect your first provider →
              </Link>
            </div>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Link
          to="/storage/files"
          className="bg-white p-6 rounded-lg shadow-sm border hover:shadow-md transition-shadow"
        >
          <h3 className="text-lg font-semibold mb-2">Synced Files</h3>
          <p className="text-gray-600">
            View and manage synced files from all providers
          </p>
        </Link>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="text-lg font-semibold mb-2">Storage Settings</h3>
          <p className="text-gray-600">
            Configure sync intervals and file filters
          </p>
        </div>
      </div>
    </div>
  );
}

function ConnectProvider() {
  const navigate = useNavigate();
  const [connecting, setConnecting] = useState<string | null>(null);

  const handleConnect = async (provider: string) => {
    setConnecting(provider);
    try {
      await authClient.storage.connect({
        provider,
        callbackURL: "/storage",
      });
    } catch (error) {
      console.error("Connection failed:", error);
      setConnecting(null);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <Link to="/storage" className="text-blue-600 hover:text-blue-700">
          ← Back to Storage
        </Link>
      </div>

      <div className="bg-white p-8 rounded-lg shadow-sm border">
        <h2 className="text-2xl font-bold mb-6">Connect Cloud Storage</h2>

        <div className="space-y-4">
          <button
            onClick={() => handleConnect("google-drive")}
            disabled={connecting === "google-drive"}
            className="w-full flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            <div className="flex items-center space-x-3">
              <GoogleDriveIcon />
              <div className="text-left">
                <div className="font-medium">Google Drive</div>
                <div className="text-sm text-gray-600">
                  Connect your Google Drive account
                </div>
              </div>
            </div>
            {connecting === "google-drive" ? (
              <span className="text-sm text-gray-600">Connecting...</span>
            ) : (
              <span className="text-blue-600">Connect →</span>
            )}
          </button>

          <button
            onClick={() => handleConnect("onedrive")}
            disabled={connecting === "onedrive"}
            className="w-full flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            <div className="flex items-center space-x-3">
              <OneDriveIcon />
              <div className="text-left">
                <div className="font-medium">OneDrive</div>
                <div className="text-sm text-gray-600">
                  Connect your Microsoft OneDrive
                </div>
              </div>
            </div>
            {connecting === "onedrive" ? (
              <span className="text-sm text-gray-600">Connecting...</span>
            ) : (
              <span className="text-blue-600">Connect →</span>
            )}
          </button>
        </div>

        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <h3 className="font-medium text-blue-900 mb-2">How it works:</h3>
          <ol className="text-sm text-blue-800 space-y-1">
            <li>1. Click on a provider to start the connection</li>
            <li>2. Authorize access in the provider's consent screen</li>
            <li>3. Your files will be automatically synced</li>
            <li>4. Manage synced files from the dashboard</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

function SyncedFiles() {
  const [files, setFiles] = useState<SyncedFile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSyncedFiles();
  }, []);

  const fetchSyncedFiles = async () => {
    try {
      const response = await fetch("/api/storage/files", {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setFiles(data.files || []);
      }
    } catch (error) {
      console.error("Failed to fetch files:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Synced Files</h1>
        <Link to="/storage" className="text-blue-600 hover:text-blue-700">
          ← Back to Storage
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-6">
          {loading ? (
            <p className="text-gray-600">Loading files...</p>
          ) : files.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Size
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Modified
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {files.map((file) => (
                    <tr key={file.id}>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {file.fileName}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {file.mimeType}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {formatFileSize(file.size)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {new Date(file.modifiedAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {file.webViewLink && (
                          <a
                            href={file.webViewLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-700"
                          >
                            View
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-600">No files synced yet</p>
              <p className="text-sm text-gray-500 mt-2">
                Connect a storage provider and sync to see files here
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Helper Components
function ProviderIcon({ provider }: { provider: string }) {
  if (provider === "google-drive") return <GoogleDriveIcon />;
  if (provider === "onedrive") return <OneDriveIcon />;
  return null;
}

function getProviderName(provider: string) {
  const names: Record<string, string> = {
    "google-drive": "Google Drive",
    onedrive: "OneDrive",
  };
  return names[provider] || provider;
}

function GoogleDriveIcon() {
  return (
    <svg className="w-6 h-6" viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function OneDriveIcon() {
  return (
    <svg className="w-6 h-6" viewBox="0 0 24 24">
      <path
        fill="#0078D4"
        d="M13.5 8.5c0-2.76-2.24-5-5-5s-5 2.24-5 5c-1.93 0-3.5 1.57-3.5 3.5s1.57 3.5 3.5 3.5h10c1.93 0 3.5-1.57 3.5-3.5s-1.57-3.5-3.5-3.5z"
      />
      <path
        fill="#1BA1E2"
        d="M18.5 10c-.17 0-.33.02-.5.05C18 7.24 15.76 5 13 5c-.62 0-1.21.11-1.77.32 1.56.89 2.62 2.52 2.74 4.43.84.23 1.53.83 1.89 1.63.17-.02.33-.03.5-.03 1.93 0 3.5 1.57 3.5 3.5s-1.57 3.5-3.5 3.5H7c.63 0 1.22-.13 1.77-.35.31.08.63.13.98.13h8.75c2.21 0 4-1.79 4-4s-1.79-4-4-4z"
      />
    </svg>
  );
}
