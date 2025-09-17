// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import type { HookEndpointContext } from "better-auth";
import type {} from "../augmentation"; // Ensure augmentations are loaded (types-only)

/**
 * Middleware context with feature flag augmentations.
 * @see ../augmentation.ts
 */
export type MiddlewareContext = HookEndpointContext;

/**
 * Input context for middleware handlers.
 */
export type MiddlewareInputContext = HookEndpointContext;

/**
 * Middleware configuration options.
 */
export interface MiddlewareOptions {
  // TODO: Add middleware configuration options
}

/**
 * Async middleware handler function.
 * @template T Return type from middleware handler
 */
export type MiddlewareHandler<T = any> = (
  ctx: MiddlewareInputContext,
) => Promise<T>;

/**
 * Middleware registration with matcher and handler.
 */
export interface MiddlewareEntry {
  /** Function to test if middleware should run for this context */
  matcher: (context: HookEndpointContext) => boolean;
  /** Async handler function to execute */
  handler: MiddlewareHandler;
}
