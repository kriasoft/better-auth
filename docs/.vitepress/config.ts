// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import { withMermaid } from "vitepress-plugin-mermaid";

// https://vitepress.dev/reference/site-config
export default withMermaid({
  base: "/better-auth/",
  lang: "en-US",
  title: "🧩\u00A0 Better Auth Plugins",
  description: "Better Auth Plugins",
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [{ text: "Guide", link: "/getting-started" }],

    sidebar: [
      {
        text: "Guide",
        items: [{ text: "Getting Started", link: "/getting-started" }],
      },
      {
        text: "Feature Flags",
        collapsed: false,
        items: [
          { text: "Overview", link: "/feature-flags/overview" },
          { text: "Quickstart", link: "/feature-flags/quickstart" },
          { text: "Configuration", link: "/feature-flags/configuration" },
          { text: "API Reference", link: "/feature-flags/api-reference" },
          { text: "Client SDK", link: "/feature-flags/client-sdk" },
          { text: "Device Detection", link: "/feature-flags/device-detection" },
          { text: "Troubleshooting", link: "/feature-flags/troubleshooting" },
        ],
      },
    ],

    socialLinks: [
      { icon: "github", link: "https://github.com/kriasoft/better-auth" },
      { icon: "discord", link: "https://discord.gg/SBwX6VeqCY" },
      { icon: "x", link: "https://x.com/kriasoft" },
    ],
  },
  sitemap: {
    hostname: "https://kriasoft.com/better-auth/",
  },
});
