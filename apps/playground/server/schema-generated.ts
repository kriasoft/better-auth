// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
} from "drizzle-orm/pg-core";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified")
    .$defaultFn(() => false)
    .notNull(),
  image: text("image"),
  createdAt: timestamp("created_at")
    .$defaultFn(() => /* @__PURE__ */ new Date())
    .notNull(),
  updatedAt: timestamp("updated_at")
    .$defaultFn(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  activeOrganizationId: text("active_organization_id"),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").$defaultFn(
    () => /* @__PURE__ */ new Date(),
  ),
  updatedAt: timestamp("updated_at").$defaultFn(
    () => /* @__PURE__ */ new Date(),
  ),
});

export const connectedAccount = pgTable("connected_account", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
  provider: text("provider"),
  providerAccountId: text("provider_account_id"),
  providerAccountEmail: text("provider_account_email"),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  expiresAt: timestamp("expires_at"),
  scope: text("scope"),
  lastSyncedAt: timestamp("last_synced_at"),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

export const syncedFile = pgTable("synced_file", {
  id: text("id").primaryKey(),
  connectedAccountId: text("connected_account_id").references(
    () => connectedAccount.id,
    { onDelete: "cascade" },
  ),
  providerFileId: text("provider_file_id"),
  name: text("name"),
  mimeType: text("mime_type"),
  size: integer("size"),
  parentId: text("parent_id"),
  webUrl: text("web_url"),
  downloadUrl: text("download_url"),
  thumbnailUrl: text("thumbnail_url"),
  modifiedTime: timestamp("modified_time"),
  syncedAt: timestamp("synced_at"),
  metadata: text("metadata"),
});

export const syncStatus = pgTable("sync_status", {
  id: text("id").primaryKey(),
  connectedAccountId: text("connected_account_id").references(
    () => connectedAccount.id,
    { onDelete: "cascade" },
  ),
  status: text("status"),
  filesProcessed: integer("files_processed"),
  filesTotal: integer("files_total"),
  error: text("error"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
});

export const featureFlag = pgTable("feature_flag", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  type: text("type").default("boolean"),
  enabled: boolean("enabled"),
  defaultValue: text("default_value"),
  rolloutPercentage: integer("rollout_percentage"),
  organizationId: text("organization_id").references(() => organization.id, {
    onDelete: "cascade",
  }),
  createdAt: timestamp("created_at")
    .$defaultFn(() => /* @__PURE__ */ new Date())
    .notNull(),
  updatedAt: timestamp("updated_at")
    .$defaultFn(() => /* @__PURE__ */ new Date())
    .notNull(),
  variants: text("variants"),
  metadata: text("metadata"),
});

export const flagRule = pgTable("flag_rule", {
  id: text("id").primaryKey(),
  flagId: text("flag_id")
    .notNull()
    .references(() => featureFlag.id, { onDelete: "cascade" }),
  priority: integer("priority"),
  name: text("name"),
  conditions: text("conditions").notNull(),
  value: text("value").notNull(),
  percentage: integer("percentage"),
  enabled: boolean("enabled").default(true),
  createdAt: timestamp("created_at")
    .$defaultFn(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const flagOverride = pgTable("flag_override", {
  id: text("id").primaryKey(),
  flagId: text("flag_id")
    .notNull()
    .references(() => featureFlag.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  value: text("value").notNull(),
  reason: text("reason"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at")
    .$defaultFn(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const flagEvaluation = pgTable("flag_evaluation", {
  id: text("id").primaryKey(),
  flagId: text("flag_id")
    .notNull()
    .references(() => featureFlag.id, { onDelete: "cascade" }),
  userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
  sessionId: text("session_id"),
  value: text("value").notNull(),
  variant: text("variant"),
  reason: text("reason"),
  context: text("context"),
  evaluatedAt: timestamp("evaluated_at")
    .$defaultFn(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const flagAudit = pgTable("flag_audit", {
  id: text("id").primaryKey(),
  flagId: text("flag_id")
    .notNull()
    .references(() => featureFlag.id, { onDelete: "cascade" }),
  userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  previousValue: text("previous_value"),
  newValue: text("new_value"),
  metadata: text("metadata"),
  createdAt: timestamp("created_at")
    .$defaultFn(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const organization = pgTable("organization", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").unique(),
  logo: text("logo"),
  createdAt: timestamp("created_at").notNull(),
  metadata: text("metadata"),
});

export const member = pgTable("member", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  role: text("role").default("member").notNull(),
  createdAt: timestamp("created_at").notNull(),
});

export const invitation = pgTable("invitation", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  role: text("role"),
  status: text("status").default("pending").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  inviterId: text("inviter_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const connections = pgTable("connections", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
  source: text("source"),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  expiresAt: timestamp("expires_at"),
  metadata: text("metadata"),
  lastSyncedAt: timestamp("last_synced_at"),
  status: text("status"),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

export const syncedData = pgTable("synced_data", {
  id: text("id").primaryKey(),
  connectionId: text("connection_id").references(() => connections.id, {
    onDelete: "cascade",
  }),
  sourceId: text("source_id"),
  type: text("type"),
  data: text("data"),
  syncedAt: timestamp("synced_at"),
});
