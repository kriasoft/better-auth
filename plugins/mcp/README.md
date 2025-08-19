# Better Auth MCP

Model Context Protocol (MCP) server connector plugin for Better Auth. Enable your users to connect their Notion, Slack, GitHub, and other MCP-compatible services, allowing AI in your application to securely access their tools and data.

## 🚧 Work in Progress

This package is currently under development. The MCP connector will enable:

- **MCP Server Management** - Users can connect and manage multiple MCP servers
- **Tool Execution** - Securely execute MCP tools on behalf of users
- **Resource Access** - Access MCP server resources with fine-grained permissions
- **Credential Storage** - Secure, encrypted storage of MCP server credentials per user
- **Multi-tenancy** - Each user manages their own set of MCP server connections

## Installation

```bash
bun add better-auth-mcp
# or
npm install better-auth-mcp
```

## Usage (Coming Soon)

```typescript
import { betterAuth } from "better-auth";
import { mcpPlugin } from "better-auth-mcp";

export const auth = betterAuth({
  plugins: [
    mcpPlugin({
      // Configuration coming soon
    }),
  ],
});
```

## Planned Features

- 🔗 Connect multiple MCP servers (Notion, Slack, GitHub, etc.)
- 🔒 Secure credential storage and isolation
- 🎯 Fine-grained permission system
- 📊 Usage tracking and rate limiting
- 🔄 Automatic server lifecycle management
- 🛡️ Sandboxed execution environment

## FAQ

### How is this different from the MCP plugin in better-auth?

Better Auth actually has two different MCP-related packages that serve completely different purposes:

| Feature             | `better-auth/plugins/mcp`                                    | `better-auth-mcp` (this package)                              |
| ------------------- | ------------------------------------------------------------ | ------------------------------------------------------------- |
| **Purpose**         | Makes your app an OAuth provider for MCP clients             | Connects users to their external MCP servers                  |
| **Direction**       | Inbound - MCP clients authenticate with your app             | Outbound - your app connects to users' MCP servers            |
| **Use Case**        | You want to expose your app's tools via MCP protocol         | Users want to connect their Notion, Slack, GitHub MCP servers |
| **Example**         | Claude Desktop authenticates with your app to use your tools | User connects their Notion MCP so AI can access their notes   |
| **What it manages** | OAuth tokens for MCP clients accessing your app              | MCP server credentials for each user                          |

**In simple terms:**

- Use `better-auth/plugins/mcp` when you want to **become** an MCP server provider
- Use `better-auth-mcp` when you want to **connect to** users' MCP servers

### Why do I need this instead of using MCP servers directly?

Direct MCP server connections are great for personal use, but in a multi-user application you need:

- **Secure Credential Storage**: Each user's MCP server credentials are encrypted and isolated
- **Multi-tenancy**: Users can only access their own MCP server connections
- **Permission Management**: Control which MCP tools users can execute
- **Usage Tracking**: Monitor and limit MCP server usage per user
- **Session Integration**: MCP connections tied to Better Auth user sessions
- **Audit Logging**: Track who executed which tools and when

### Can I use both the MCP plugin and this package?

Yes! They serve complementary purposes:

- Use `better-auth/plugins/mcp` to expose your app's functionality as MCP tools
- Use `better-auth-mcp` to let users bring their own MCP servers

For example, you could build an AI assistant that:

1. Uses `better-auth/plugins/mcp` to let Claude Desktop access your app's tools
2. Uses `better-auth-mcp` to let users connect their Notion for accessing personal notes

## License

MIT
