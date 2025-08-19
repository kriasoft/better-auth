# better-auth-connect

Connect and sync data from various sources (Google Drive, Gmail, GitHub, etc.) with Better Auth.

> ⚠️ **Work in Progress**: This package is currently in development and the API may change.

## Installation

```bash
npm install better-auth-connect
# or
bun add better-auth-connect
```

## Quick Start

### Server Setup

```typescript
import { betterAuth } from "better-auth";
import { connectPlugin } from "better-auth-connect";

export const auth = betterAuth({
  // ... your auth config
  plugins: [
    connectPlugin({
      // Optional: customize sources
      sources: [
        // Use predefined sources or add custom ones
      ],
      // Optional: callbacks
      onConnect: async (source, userId, metadata) => {
        console.log(`User ${userId} connected ${source}`);
      },
      onDisconnect: async (source, userId) => {
        console.log(`User ${userId} disconnected ${source}`);
      },
      onSync: async (source, userId, data) => {
        console.log(`Syncing data for user ${userId} from ${source}`);
      },
    }),
  ],
});
```

### Client Setup

```typescript
import { createAuthClient } from "better-auth/client";
import { connectClient } from "better-auth-connect/client";

const authClient = createAuthClient({
  plugins: [
    connectClient({
      onConnectSuccess: (source, connectionId) => {
        console.log(`Connected to ${source}: ${connectionId}`);
      },
      onConnectError: (source, error) => {
        console.error(`Failed to connect ${source}:`, error);
      },
    }),
  ],
});

// List available sources
const { sources } = await authClient.connect.listSources();

// Connect a data source
await authClient.connect.authorize("google-drive");

// List connections
const connections = await authClient.connect.getConnections();

// Sync data
await authClient.connect.sync(connectionId);

// Disconnect
await authClient.connect.disconnect(connectionId);
```

## Supported Data Sources

### Pre-configured Sources

The plugin comes with pre-configured support for popular services:

- **Google Drive** - Access and sync files from Google Drive
- **Gmail** - Read emails and metadata
- **GitHub** - Access repositories and code
- **OneDrive** - Sync files from Microsoft OneDrive
- **Dropbox** - Access Dropbox files

### Environment Variables

Configure OAuth credentials for each service:

```env
# Google Drive
GOOGLE_DRIVE_CLIENT_ID=your_client_id
GOOGLE_DRIVE_CLIENT_SECRET=your_client_secret

# Gmail
GMAIL_CLIENT_ID=your_client_id
GMAIL_CLIENT_SECRET=your_client_secret

# GitHub
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret

# OneDrive
ONEDRIVE_CLIENT_ID=your_client_id
ONEDRIVE_CLIENT_SECRET=your_client_secret

# Dropbox
DROPBOX_CLIENT_ID=your_client_id
DROPBOX_CLIENT_SECRET=your_client_secret
```

### Custom Sources

Add your own data sources:

```typescript
connectPlugin({
  sources: [
    {
      id: "custom-api",
      name: "Custom API",
      type: "oauth",
      scopes: ["read", "write"],
      authUrl: "https://api.example.com/oauth/authorize",
      tokenUrl: "https://api.example.com/oauth/token",
      clientId: process.env.CUSTOM_API_CLIENT_ID,
      clientSecret: process.env.CUSTOM_API_CLIENT_SECRET,
    },
  ],
});
```

## Database Schema

The plugin automatically creates the following tables:

### connections

- `id` - Unique connection identifier
- `userId` - Reference to user
- `source` - Data source identifier
- `accessToken` - OAuth access token (encrypted)
- `refreshToken` - OAuth refresh token (encrypted)
- `expiresAt` - Token expiration
- `metadata` - Additional connection data
- `lastSyncedAt` - Last sync timestamp
- `status` - Connection status (active/expired/error)

### syncedData

- `id` - Unique record identifier
- `connectionId` - Reference to connection
- `sourceId` - Source-specific identifier
- `type` - Data type (file/email/repo/etc)
- `data` - Synced data (JSON)
- `syncedAt` - Sync timestamp

## API Reference

### Server Endpoints

| Endpoint                   | Method | Description                 |
| -------------------------- | ------ | --------------------------- |
| `/connect/sources`         | GET    | List available data sources |
| `/connect/authorize`       | POST   | Start OAuth authorization   |
| `/connect/callback`        | POST   | Handle OAuth callback       |
| `/connect/disconnect`      | POST   | Remove a connection         |
| `/connect/sync`            | POST   | Trigger data sync           |
| `/connect/connections`     | GET    | List user connections       |
| `/connect/webhook/:source` | POST   | Webhook receiver            |

### Client Methods

#### `listSources()`

Returns available data sources.

```typescript
const { sources } = await authClient.connect.listSources();
// Returns: { sources: DataSource[] }
```

#### `authorize(source, redirectUri?)`

Initiates OAuth flow for a data source.

```typescript
await authClient.connect.authorize("google-drive");
// Redirects to OAuth provider
```

#### `handleCallback(source, code, state)`

Handles OAuth callback (usually automatic).

```typescript
const result = await authClient.connect.handleCallback(
  "google-drive",
  code,
  state,
);
// Returns: { success: boolean, connectionId: string }
```

#### `getConnections()`

Lists all user connections.

```typescript
const connections = await authClient.connect.getConnections();
// Returns: Connection[]
```

#### `sync(connectionId)`

Triggers data sync for a connection.

```typescript
const result = await authClient.connect.sync(connectionId);
// Returns: { success: boolean, syncedAt: string }
```

#### `disconnect(connectionId)`

Removes a connection.

```typescript
const result = await authClient.connect.disconnect(connectionId);
// Returns: { success: boolean }
```

## Configuration Options

### Plugin Options

```typescript
interface ConnectPluginOptions {
  // Custom data sources
  sources?: DataSource[];

  // Sync interval in seconds (default: 300)
  syncInterval?: number;

  // Maximum sync size in bytes (default: 100MB)
  maxSyncSize?: number;

  // Webhook verification secret
  webhookSecret?: string;

  // Lifecycle callbacks
  onConnect?: (source: string, userId: string, metadata: any) => Promise<void>;
  onDisconnect?: (source: string, userId: string) => Promise<void>;
  onSync?: (source: string, userId: string, data: any) => Promise<void>;
}
```

### Client Options

```typescript
interface ConnectClientOptions {
  // Success callback for connections
  onConnectSuccess?: (source: string, connectionId: string) => void;

  // Error callback for failed connections
  onConnectError?: (source: string, error: Error) => void;

  // Callback when disconnection succeeds
  onDisconnectSuccess?: (source: string) => void;

  // Callback when sync completes
  onSyncComplete?: (source: string, data: any) => void;
}
```

## Webhooks

To receive real-time updates from data sources:

1. Configure webhook URL in your OAuth app settings:

   ```
   https://your-domain.com/api/auth/connect/webhook/[source]
   ```

2. Set webhook secret:

   ```typescript
   connectPlugin({
     webhookSecret: process.env.WEBHOOK_SECRET,
   });
   ```

3. The plugin will automatically verify and process incoming webhooks.

## Security

- OAuth tokens are stored encrypted in the database
- Webhook signatures are verified when configured
- All endpoints require authentication
- User can only access their own connections
- Tokens are automatically refreshed when expired

## Examples

### React Component

```tsx
import { useAuth } from "@/lib/auth-client";

function DataConnections() {
  const { connect } = useAuth();
  const [connections, setConnections] = useState([]);

  useEffect(() => {
    loadConnections();
  }, []);

  const loadConnections = async () => {
    const data = await connect.getConnections();
    setConnections(data);
  };

  const handleConnect = async (source: string) => {
    await connect.authorize(source);
  };

  const handleSync = async (connectionId: string) => {
    await connect.sync(connectionId);
    toast.success("Sync started");
  };

  return (
    <div>
      <h2>Data Sources</h2>

      <div className="sources">
        {["google-drive", "gmail", "github"].map((source) => (
          <button key={source} onClick={() => handleConnect(source)}>
            Connect {source}
          </button>
        ))}
      </div>

      <h3>Connected Accounts</h3>
      {connections.map((conn) => (
        <div key={conn.id}>
          <span>{conn.source}</span>
          <button onClick={() => handleSync(conn.id)}>Sync</button>
          <button onClick={() => connect.disconnect(conn.id)}>
            Disconnect
          </button>
        </div>
      ))}
    </div>
  );
}
```

### Next.js API Route

```typescript
// app/api/auth/[...all]/route.ts
import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

export const { GET, POST } = toNextJsHandler(auth);
```

## Roadmap

- [ ] Automatic sync scheduling
- [ ] File content retrieval
- [ ] Selective sync filters
- [ ] Rate limiting per source
- [ ] Batch operations
- [ ] Search across connected sources
- [ ] Real-time sync via WebSockets
- [ ] More data sources (Slack, Discord, etc.)

## License

MIT

## Author

Konstantin Tarkus ([@koistya](https://github.com/koistya))

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## Support

For issues and feature requests, please visit the [GitHub repository](https://github.com/kriasoft/better-auth-plugins).
