# Better Auth Plugins

**What:** 18 modular Better Auth plugins (security, compliance, integrations, user mgmt, analytics)  
**Structure:** `plugins/*/` → TypeScript → tsup → npm | Bun workspaces | Independent versioning

## Architecture

**Stack:** TypeScript 5.9+ | Bun runtime & workspaces | tsup build | VitePress docs

```text
better-auth-plugins/
├── plugins/                # 18 standalone plugins
│   ├── abuse-detection/    ├── analytics/         ├── audit-log/
│   ├── backup-codes/       ├── compliance/        ├── connect/
│   ├── consent/            ├── feature-flags/     ├── fraud-detection/
│   ├── impersonation/      ├── mcp/               ├── notifications/
│   ├── onboarding/         ├── rate-limit/        ├── session-management/
│   ├── storage/            ├── subscription/      └── webhooks/
├── apps/playground/        # Dev environment
├── docs/                   # Documentation site
└── test/                   # Test suites

Plugin structure: src/{index,client,plugin,schema,types}.ts → tsup → dist/
```

## Commands

```bash
bun install        # Install all dependencies
bun run build      # Build all packages
bun run dev        # Watch mode
bun run typecheck  # Type checking
bun test           # Run all tests

# Plugin-specific
bun run --filter 'better-auth-*' build        # Build matching plugins
bun run --filter 'better-auth-storage' test   # Test single plugin
cd plugins/storage && bun add zod             # Add dependency (idiomatic)
bun --cwd=plugins/storage add -d @types/node  # Add dev dependency (alternative)
```

## Conventions

**TypeScript:** Strict mode | Export all types | `type` imports | Interfaces > type aliases  
**Security:** Encrypt tokens | Rate limit endpoints | Zod validation | CSRF protection | Verify webhooks  
**Performance:** Lazy load | Cache data | Batch DB ops | Async/await | ESM tree-shaking  
**Testing:** `bun:test` | Unit + integration tests | Test before publish
**Debug:** `betterAuth({ debug: true })` | `storagePlugin({ debug: true })`
**Philosophy:** Ideal architecture > backwards compatibility | Refactor when needed | TypeScript-first | Tree-shakeable plugins
