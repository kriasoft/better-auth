# Database Schema Sync

Synchronize Drizzle ORM schema files with Better Auth schema definitions and generate migrations.

## Sync Operations

### Schema File Updates

- Update `@db/schema/*.ts` files to match `@packages/auth/schema.json`
- Add missing tables, columns, or constraints from Better Auth schema
- Remove tables, columns, indexes etc. no longer present in Better Auth schema
- Update column types, defaults, and relationships as needed

### Migration Generation

- Generate new Drizzle migrations for schema changes
- Update `@db/migrations/` with any required database alterations
- Ensure migration compatibility with existing data

### Validation Steps

- **Schema Consistency**: Verify all Better Auth tables are represented in Drizzle
- **Type Safety**: Ensure TypeScript compilation succeeds
- **Relationships**: Maintain proper foreign key constraints and cascade behaviors

## Technical Context

- **Source**: `@packages/auth/schema.json` (Better Auth schema definitions)
- **Target**: `@db/schema/*.ts` (Drizzle ORM schema files)
- **Stack**: PostgreSQL + Drizzle ORM v0.44.5+ + Better Auth v1.3.12+

## Success Criteria

- All Better Auth schema.json tables reflected in Drizzle schema files
- Generated migrations ready for database deployment
- Clean TypeScript compilation with no schema inconsistencies
