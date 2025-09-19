# @repo/db

Internal database package providing shared schema and migrations for the Better Auth plugins monorepo. Uses Drizzle ORM with PostgreSQL for development, integration testing, and the playground app.

> **Note:** This is a workspace-only package not published to npm.

## Project Structure

```bash
db/
├── schema/                # Database table definitions
│   ├── index.ts           # Main export
│   ├── auth.ts            # Authentication tables
│   ├── organization.ts    # Multi-tenancy
│   └── feature-flag.ts    # Feature flags
├── migrations/            # Generated migration files
├── drizzle.config.ts      # Drizzle configuration
├── index.ts               # Database connection
└── package.json           # Package config
```

## Setup

Update the `DATABASE_URL` in the `.env` file (if needed) and run:

```bash
bun run push
```

This applies the current schema to the database.

## Usage

```typescript
import { db } from "@repo/db";
import { eq } from "drizzle-orm";
import { users, sessions, featureFlags } from "@repo/db/schema";

// Query
const user = await db.select().from(users).where(eq(users.id, userId));

// Insert
await db.insert(users).values({ email: "user@example.com" });

// Update
await db.update(users).set({ name: "Jane" }).where(eq(users.id, userId));

// Transaction
await db.transaction(async (tx) => {
  const [user] = await tx.insert(users).values({ email }).returning();
  await tx.insert(sessions).values({ userId: user.id, token });
});
```

## Better Auth Integration

```typescript
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@repo/db";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg" }),
});
```

## Commands

```bash
bun run push       # Push schema changes (dev)
bun run migrate    # Run migrations (prod)
bun run generate   # Generate migration files
bun run studio     # Open Drizzle Studio
bun run typecheck  # Type checking
```

## Schema Files

- `schema/auth.ts` - Authentication tables (users, sessions, accounts)
- `schema/organization.ts` - Multi-tenancy (organizations, members)
- `schema/feature-flag.ts` - Feature flags (flags, rules, overrides)

## Syncing Schema with Better Auth

When Better Auth updates require schema changes:

```bash
# From repository root
bun generate:schema                          # Generate schema from Better Auth
cat .claude/commands/sync-db-schema.md | claude  # Review and apply changes
bun db:push                                   # Push to database
```

## Adding Tables

### 1. Create schema file in `db/schema/`

```typescript
// db/schema/my-feature.ts
import { pgTable, text, uuid } from "drizzle-orm/pg-core";

export const myTable = pgTable("my_table", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
});
```

### 2. Export from `schema/index.ts`

```typescript
export * from "./my-feature";
```

### 3. Apply changes

```bash
bun run generate  # Generate migration
bun run push      # Apply to database
```

## License

MIT © Kriasoft
