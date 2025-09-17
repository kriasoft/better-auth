# @better-auth/db

Database schema and migrations for Better Auth plugins using Drizzle ORM.

## Features

- 📊 **Complete Schema** - User, session, organization, and plugin-specific tables
- 🔄 **Migrations** - Automated schema migrations with Drizzle Kit
- 🗄️ **Multi-Database** - Support for PostgreSQL, MySQL, and SQLite
- 🔗 **Relations** - Properly defined table relationships
- 📘 **Type Safety** - Full TypeScript support with inferred types

## Installation

```bash
bun add @better-auth/db drizzle-orm

# Database drivers (install the one you need)
bun add postgres     # For PostgreSQL (serverless)
bun add pg           # For PostgreSQL (traditional)
bun add better-sqlite3  # For SQLite
```

## Usage

### Create Database Connection

```typescript
import { createDb } from "@better-auth/db";

// PostgreSQL (recommended for production)
const db = createDb({
  provider: "postgres",
  url: process.env.DATABASE_URL,
});

// SQLite (for development/testing)
const db = createDb({
  provider: "sqlite",
  url: "./data/better-auth.db", // or use memory: true
});
```

### Run Migrations

```typescript
import { migrate } from "@better-auth/db";

// Run migrations
await migrate(db);

// Check if migrations are needed
const needsMigration = await checkMigrations(db);
```

### Use Schemas

```typescript
import { users, sessions, featureFlags } from "@better-auth/db/schema";
import { eq } from "@better-auth/db";

// Query examples
const allUsers = await db.select().from(users);
const userSessions = await db
  .select()
  .from(sessions)
  .where(eq(sessions.userId, userId));
```

## Database Commands

```bash
# Generate migrations from schema changes
bun run db:generate

# Apply migrations to database
bun run db:migrate

# Push schema directly (development)
bun run db:push

# Open Drizzle Studio (database viewer)
bun run db:studio

# Check migration status
bun run db:check
```

## Schema Overview

### Core Tables

- `users` - User accounts
- `sessions` - Active sessions
- `organizations` - Multi-tenant organizations
- `organization_members` - User-org relationships
- `accounts` - OAuth provider accounts
- `verification_tokens` - Email/phone verification
- `password_reset_tokens` - Password recovery

### Feature Flags

- `feature_flags` - Flag definitions
- `feature_flag_rules` - Targeting rules
- `feature_flag_variants` - A/B test variants
- `feature_flag_overrides` - User overrides
- `feature_flag_evaluations` - Usage tracking

### Audit & Analytics

- `audit_logs` - Security audit trail
- `analytics_events` - Event tracking
- `analytics_metrics` - Aggregated metrics

### Subscriptions & Billing

- `subscription_plans` - Plan definitions
- `subscriptions` - Active subscriptions
- `payments` - Payment history
- `usage_records` - Metered usage

### Notifications

- `notification_templates` - Message templates
- `notifications` - Sent notifications
- `notification_preferences` - User preferences

## Environment Variables

```env
# PostgreSQL
DATABASE_URL=postgresql://user:pass@localhost:5432/dbname

# SQLite
DATABASE_URL=file:./data/better-auth.db

# Optional: Table prefix for multi-tenancy
TABLE_PREFIX=tenant1_
```

## Type Exports

All table types are automatically inferred and exported:

```typescript
import type {
  User,
  NewUser,
  Session,
  FeatureFlag,
  Subscription,
  // ... etc
} from "@better-auth/db/schema";
```

## License

MIT © Kriasoft
