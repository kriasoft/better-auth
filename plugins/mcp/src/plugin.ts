// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import type { BetterAuthPlugin } from "better-auth";

export interface MCPPluginOptions {
  // TODO: Add configuration options
}

export function mcpPlugin(options?: MCPPluginOptions): BetterAuthPlugin {
  return {
    id: "mcp",

    // TODO: Implement MCP server management
    // - Connect MCP servers
    // - Execute tools
    // - Manage resources
    // - Handle permissions
  };
}
