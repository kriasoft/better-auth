// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import "../augmentation"; // Ensure augmentations are loaded
import type { HookEndpointContext } from "better-auth";

/**
 * Middleware context is now just HookEndpointContext
 * with augmentations from augmentation.ts
 */
export type MiddlewareContext = HookEndpointContext;

/**
 * Input context for middleware handlers
 */
export type MiddlewareInputContext = HookEndpointContext;

/**
 * Options for middleware configuration
 */
export interface MiddlewareOptions {
  // Add middleware options here
}

/**
 * Middleware handler function type
 */
export type MiddlewareHandler<T = any> = (
  ctx: MiddlewareInputContext,
) => Promise<T>;

/**
 * Middleware registration entry
 */
export interface MiddlewareEntry {
  matcher: (context: HookEndpointContext) => boolean;
  handler: MiddlewareHandler;
}
