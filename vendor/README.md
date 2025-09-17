# Vendor Dependencies

This directory contains Git submodules used as reference implementations and development dependencies for the Better Auth Plugins project. These are included to ensure consistent plugin architecture patterns and provide type definitions during development.

## Included Projects

### Better Auth

- **Repository**: [better-auth/better-auth](https://github.com/better-auth/better-auth)
- **Purpose**: Core authentication framework - provides plugin patterns, APIs, and type definitions
- **License**: MIT License
- **Copyright**: © 2024 - present, Bereket Engida

### Zod

- **Repository**: [colinhacks/zod](https://github.com/colinhacks/zod)
- **Purpose**: TypeScript-first schema validation - used for input validation and type safety across plugins
- **License**: MIT License
- **Copyright**: © 2025 Colin McDonnell

## Submodule Management

### Initial Setup

After cloning the repository, initialize submodules:

```bash
git submodule update --init --recursive
```

### Updating Submodules

To update all submodules to their latest commits:

```bash
git submodule update --remote --merge
```

To update a specific submodule:

```bash
git submodule update --remote --merge vendor/better-auth
git submodule update --remote --merge vendor/zod
```

### Committing Submodule Updates

After updating submodules, commit the new references:

```bash
git add vendor/
git commit -m "Update vendor dependencies"
```

### Checking Submodule Status

View current submodule commits and check for updates:

```bash
git submodule status
```

## Usage in Development

These vendor dependencies are used for:

- **Type definitions**: Importing types without runtime dependencies
- **Architecture reference**: Following established patterns from Better Auth core
- **Schema validation**: Using Zod patterns for consistent validation across plugins
- **Testing compatibility**: Ensuring plugins work with the latest framework versions

**Note**: These are development references only. Production plugins declare their own dependencies through package.json.

## License Compliance

All included projects are MIT licensed, allowing for:

- Commercial and private use
- Distribution and modification
- Inclusion as submodules with proper attribution

This README serves as attribution for the included projects. Each project's original license file is preserved in its respective directory.

## Adding New Submodules

When adding new vendor dependencies:

1. Add the submodule: `git submodule add <repository-url> vendor/<name>`
2. Update this README with project details and license information
3. Ensure the project's license is compatible (prefer MIT/Apache-2.0/BSD)
4. Document the purpose and usage patterns
