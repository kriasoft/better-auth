# Better Auth Audit Log

Comprehensive audit logging plugin for Better Auth. Track all authentication events with immutable logs for compliance, security monitoring, and forensic analysis.

## 🚧 Work in Progress

This package is currently under development. The audit log plugin will enable:

- **Complete Event Tracking** - Log every authentication-related action
- **Immutable Logs** - Cryptographically signed, tamper-proof audit trail
- **Compliance Ready** - SOC2, HIPAA, GDPR, PCI-DSS compliant logging
- **Flexible Storage** - Database, S3, Elasticsearch, SIEM integration
- **Advanced Querying** - Search and filter logs with powerful queries
- **Real-time Streaming** - Stream logs to external systems via webhooks

## Installation

```bash
bun add better-auth-audit-log
# or
npm install better-auth-audit-log
```

## Setup

```typescript
import { betterAuth } from "better-auth";
import { auditLogPlugin } from "better-auth-audit-log";

export const auth = betterAuth({
  plugins: [
    auditLogPlugin({
      storage: {
        type: "database", // or "s3", "elasticsearch"
        retention: 2555, // days (7 years for compliance)
        encryption: true,
      },
      events: {
        // Configure which events to log
        authentication: true,
        authorization: true,
        userManagement: true,
        adminActions: true,
        securityEvents: true,
        dataAccess: true,
      },
      compliance: {
        mode: "soc2", // or "hipaa", "gdpr", "pci-dss"
        includeIpAddress: true,
        includeUserAgent: true,
        anonymizePII: false,
      },
      export: {
        // Export to external systems
        siem: {
          type: "splunk",
          endpoint: process.env.SPLUNK_ENDPOINT,
          token: process.env.SPLUNK_TOKEN,
        },
      },
    }),
  ],
});
```

## Features (Planned)

### Event Categories

- **Authentication Events**: Login, logout, failed attempts, MFA events
- **User Management**: Account creation, deletion, profile updates
- **Authorization Events**: Permission changes, role assignments
- **Security Events**: Password changes, suspicious activity, lockouts
- **Admin Actions**: Impersonation, bulk operations, config changes
- **Data Access**: Sensitive data views, exports, API access

### Storage Backends

- PostgreSQL/MySQL with dedicated audit tables
- Amazon S3 with lifecycle policies
- Elasticsearch for full-text search
- MongoDB for document storage
- File system with rotation

### Compliance Features

- Immutable log entries with checksums
- Cryptographic signing and verification
- Automatic PII redaction options
- Configurable retention policies
- Export for compliance audits
- Chain of custody documentation

### Query & Analysis

- Advanced filtering by user, action, date range
- Full-text search across log entries
- Anomaly detection and alerts
- Audit reports generation
- CSV/JSON export capabilities

## Client Usage

```typescript
import { createAuthClient } from "better-auth/client";
import { auditLogClient } from "better-auth-audit-log/client";

const authClient = createAuthClient({
  plugins: [auditLogClient()],
});

// Query audit logs (admin only)
const logs = await authClient.auditLog.query({
  userId: "user123",
  action: "login",
  startDate: new Date("2024-01-01"),
  endDate: new Date("2024-12-31"),
  limit: 100,
});

// Export logs for compliance
const report = await authClient.auditLog.export({
  format: "csv",
  dateRange: "last_quarter",
});

// Verify log integrity
const verification = await authClient.auditLog.verify({
  logId: "log123",
});
```

## License

MIT
