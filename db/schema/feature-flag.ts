// SPDX-FileCopyrightText: 2025-present Kriasoft
// SPDX-License-Identifier: MIT

import {
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { organization } from "./organization";

export const featureFlag = pgTable("feature_flag", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  type: text("type").default("boolean"),
  enabled: boolean("enabled").default(false),
  defaultValue: text("default_value"),
  rolloutPercentage: integer("rollout_percentage").default(0),
  organizationId: text("organization_id").references(() => organization.id, {
    onDelete: "cascade",
  }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  variants: text("variants"),
  metadata: text("metadata"),
});

export const flagRule = pgTable("flag_rule", {
  id: text("id").primaryKey(),
  flagId: text("flag_id")
    .notNull()
    .references(() => featureFlag.id, { onDelete: "cascade" }),
  priority: integer("priority").default(0),
  name: text("name"),
  conditions: text("conditions").notNull(),
  value: text("value").notNull(),
  percentage: integer("percentage"),
  enabled: boolean("enabled").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
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
  enabled: boolean("enabled").default(true),
  variant: text("variant"),
  reason: text("reason"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
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
  evaluatedAt: timestamp("evaluated_at").defaultNow().notNull(),
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
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
