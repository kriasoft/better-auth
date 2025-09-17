// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import type { BetterAuthClientPlugin } from "better-auth/client";

/**
 * Feature Flags — Admin client plugin
 *
 * Ship only to admin surfaces. Provides admin CRUD operations.
 * @see src/endpoints/admin/ for server implementation
 */
export function featureFlagsAdminClient(): BetterAuthClientPlugin {
  return {
    id: "feature-flags-admin-client",

    // HTTP methods for route inference/devtools
    pathMethods: {
      "/feature-flags/admin/flags": "GET",
      "/feature-flags/admin/flags/:id": "GET",
      "/feature-flags/admin/flags/:id/enable": "POST",
      "/feature-flags/admin/flags/:id/disable": "POST",
      "/feature-flags/admin/flags/:flagId/rules": "GET",
      "/feature-flags/admin/flags/:flagId/rules/:ruleId": "GET",
      "/feature-flags/admin/flags/:flagId/rules/reorder": "POST",
      "/feature-flags/admin/flags/:flagId/stats": "GET",
      "/feature-flags/admin/overrides": "GET",
      "/feature-flags/admin/overrides/:id": "GET",
      "/feature-flags/admin/metrics/usage": "GET",
      "/feature-flags/admin/audit": "GET",
      "/feature-flags/admin/audit/:id": "GET",
      "/feature-flags/admin/environments": "GET",
      "/feature-flags/admin/environments/:id": "GET",
      "/feature-flags/admin/export": "POST",
    },

    getAtoms: () => ({}),

    getActions(fetch) {
      // HTTP method helpers
      const get = (path: string, query?: Record<string, any>) =>
        fetch(path, { method: "GET", query });
      const post = (path: string, body?: any) =>
        fetch(path, { method: "POST", body });
      const patch = (path: string, body?: any) =>
        fetch(path, { method: "PATCH", body });
      const del = (path: string) => fetch(path, { method: "DELETE" });

      return {
        featureFlags: {
          admin: {
            flags: {
              list: (query?: {
                organizationId?: string;
                cursor?: string;
                limit?: number;
                q?: string;
                sort?: string; // e.g., "-updatedAt"
                include?: "stats";
              }) => get("/feature-flags/admin/flags", query),
              create: (data: any) => post("/feature-flags/admin/flags", data),
              get: (id: string) => get(`/feature-flags/admin/flags/${id}`),
              update: (id: string, updates: any) =>
                patch(`/feature-flags/admin/flags/${id}`, updates),
              delete: (id: string) => del(`/feature-flags/admin/flags/${id}`),
              enable: (id: string) =>
                post(`/feature-flags/admin/flags/${id}/enable`),
              disable: (id: string) =>
                post(`/feature-flags/admin/flags/${id}/disable`),
            },
            rules: {
              list: (flagId: string) =>
                get(`/feature-flags/admin/flags/${flagId}/rules`),
              create: (flagId: string, data: any) =>
                post(`/feature-flags/admin/flags/${flagId}/rules`, data),
              get: (flagId: string, ruleId: string) =>
                get(`/feature-flags/admin/flags/${flagId}/rules/${ruleId}`),
              update: (flagId: string, ruleId: string, updates: any) =>
                patch(
                  `/feature-flags/admin/flags/${flagId}/rules/${ruleId}`,
                  updates,
                ),
              delete: (flagId: string, ruleId: string) =>
                del(`/feature-flags/admin/flags/${flagId}/rules/${ruleId}`),
              reorder: (flagId: string, ids: string[]) =>
                post(`/feature-flags/admin/flags/${flagId}/rules/reorder`, {
                  ids,
                }),
            },
            overrides: {
              list: (query?: {
                organizationId?: string;
                cursor?: string;
                limit?: number;
                q?: string;
                sort?: string; // e.g., "-createdAt"
                flagId?: string;
                userId?: string;
              }) => get("/feature-flags/admin/overrides", query),
              create: (data: any) =>
                post("/feature-flags/admin/overrides", data),
              get: (id: string) => get(`/feature-flags/admin/overrides/${id}`),
              update: (id: string, updates: any) =>
                patch(`/feature-flags/admin/overrides/${id}`, updates),
              delete: (id: string) =>
                del(`/feature-flags/admin/overrides/${id}`),
            },
            analytics: {
              stats: {
                get: (
                  flagId: string,
                  query?: {
                    granularity?: "hour" | "day" | "week" | "month";
                    start?: string;
                    end?: string;
                    timezone?: string;
                  },
                ) => get(`/feature-flags/admin/flags/${flagId}/stats`, query),
              },
              usage: {
                get: (query?: {
                  start?: string;
                  end?: string;
                  timezone?: string;
                  organizationId?: string;
                }) => get("/feature-flags/admin/metrics/usage", query),
              },
            },
            audit: {
              list: (query?: {
                flagId?: string;
                limit?: number;
                offset?: number;
              }) => get("/feature-flags/admin/audit", query),
              get: (id: string) => get(`/feature-flags/admin/audit/${id}`),
            },
            environments: {
              list: (query?: {
                organizationId?: string;
                cursor?: string;
                limit?: number;
              }) => get("/feature-flags/admin/environments", query),
              create: (data: any) =>
                post("/feature-flags/admin/environments", data),
              update: (id: string, updates: any) =>
                patch(`/feature-flags/admin/environments/${id}`, updates),
              delete: (id: string) =>
                del(`/feature-flags/admin/environments/${id}`),
            },
            exports: {
              create: (data: any) => post("/feature-flags/admin/export", data),
            },
          },
        },
      };
    },
  } satisfies BetterAuthClientPlugin;
}

export default featureFlagsAdminClient;
