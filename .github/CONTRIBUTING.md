# Contributing to Better Auth Plugins

Thanks for your interest in contributing to Better Auth Plugins! We welcome all kinds of contributions - from bug reports and feature requests to code changes and documentation improvements.

## Getting Started

### Development Setup

1. **Fork and clone the repository**

   ```bash
   git clone https://github.com/yourusername/better-auth-plugins.git
   cd better-auth-plugins
   ```

2. **Install dependencies**

   ```bash
   bun install
   ```

3. **Build all packages**

   ```bash
   bun run build
   ```

4. **Run tests**

   ```bash
   bun test
   ```

### Development Workflow

1. **Create a feature branch**

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Follow the existing code style and conventions
   - Add tests for new functionality
   - Update documentation as needed

3. **Test your changes**

   ```bash
   # Run all tests
   bun test

   # Type check
   bun run typecheck

   # Build to ensure everything compiles
   bun run build
   ```

4. **Commit and push**

   ```bash
   git add .
   git commit -m "feat: add amazing new feature"
   git push origin feature/your-feature-name
   ```

5. **Create a Pull Request**
   - Use a descriptive title
   - Explain what changes you made and why
   - Reference any related issues

## Plugin Development Guidelines

### Creating a New Plugin

1. **Use the plugin structure**

   ```text
   plugins/your-plugin/
   ├── src/
   │   ├── index.ts        # Main export
   │   ├── plugin.ts       # Server-side plugin
   │   ├── client.ts       # Client-side plugin
   │   ├── schema.ts       # Database schema
   │   └── types.ts        # TypeScript types
   ├── package.json
   ├── tsconfig.json
   └── tsup.config.ts
   ```

2. **Follow naming conventions**
   - Package name: `better-auth-{plugin-name}`
   - Export names: `{pluginName}Plugin` and `{pluginName}Client`

3. **Include comprehensive types**
   - Export all public interfaces and types
   - Use `type` imports where possible
   - Prefer interfaces over type aliases

### Code Style

- **TypeScript**: Use strict mode with full type safety
- **Security**: Always validate inputs with Zod schemas
- **Performance**: Lazy load dependencies when possible
- **Testing**: Include unit tests for all functionality

## Types of Contributions

### 🐛 Bug Reports

Found a bug? Please create an issue with:

- Clear description of the problem
- Steps to reproduce
- Expected vs actual behavior
- Environment details (Node version, database, etc.)

### 💡 Feature Requests

Have an idea? We'd love to hear it! Please include:

- What problem it solves
- How it would work
- Any implementation ideas

### 📝 Documentation

Documentation improvements are always welcome:

- Fix typos or unclear explanations
- Add examples or tutorials
- Improve API documentation

### 🔧 Code Contributions

- Bug fixes
- New features
- Performance improvements
- Test coverage improvements

## Plugin Ideas

Looking for ideas? Consider these plugin categories:

**Security**: Rate limiting, fraud detection, audit logging, compliance automation  
**Integrations**: Cloud storage, notification services, webhook endpoints  
**User Management**: Session management, onboarding flows, user impersonation  
**Analytics**: Event tracking, feature flags, subscription management

## Review Process

1. All contributions go through code review
2. We check for code quality, tests, and documentation
3. Maintainers may suggest changes or improvements
4. Once approved, your PR will be merged

## Getting Help

- 🎮 **Discord**: [Join our community](https://discord.gg/SBwX6VeqCY)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/kriasoft/better-auth/discussions)
- 🐛 **Issues**: [GitHub Issues](https://github.com/kriasoft/better-auth/issues)

## Code of Conduct

Please read our [Code of Conduct](CODE_OF_CONDUCT.md) to understand the standards we expect from our community.

---

Thank you for contributing to Better Auth Plugins! 🎉
