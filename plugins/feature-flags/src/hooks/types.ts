// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import type { BetterAuthPlugin } from "better-auth";

/**
 * Type for a single hook configuration
 */
export interface HookConfig {
  matcher: (ctx: any) => boolean;
  handler: (ctx: any) => Promise<any>;
}

/**
 * Type for before hooks
 */
export type BeforeHooks = NonNullable<BetterAuthPlugin["hooks"]>["before"];

/**
 * Type for after hooks
 */
export type AfterHooks = NonNullable<BetterAuthPlugin["hooks"]>["after"];

/**
 * Combined hook types
 */
export type Hooks = BeforeHooks | AfterHooks;

/**
 * Hook handler function type
 */
export type HookHandler = (ctx: any) => Promise<any>;

/**
 * Hook matcher function type
 */
export type HookMatcher = (ctx: any) => boolean;
