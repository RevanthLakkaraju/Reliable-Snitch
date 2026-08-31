import {
  sqliteTable,
  text,
  integer,
  real,
  index,
  primaryKey,
  uniqueIndex,
  check,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
export const reports = sqliteTable(
  "reports",
  {
    id: text("id").primaryKey(),
    requestId: text("request_id").notNull().unique(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    category: text("category").notNull(),
    status: text("status").notNull(),
    priority: text("priority").notNull(),
    department: text("department").notNull(),
    locationText: text("location_text").notNull(),
    latitude: real("latitude"),
    longitude: real("longitude"),
    accuracy: real("accuracy"),
    locationSource: text("location_source").notNull(),
    photoKey: text("photo_key"),
    isDemo: integer("is_demo").notNull().default(0),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
    resolvedAt: integer("resolved_at"),
    revision: integer("revision").notNull().default(0),
    context: text("context").notNull(),
  },
  (table) => [
    index("idx_reports_updated").on(table.updatedAt),
    index("idx_reports_status").on(table.status),
  ],
);
export const events = sqliteTable(
  "report_events",
  {
    id: text("id").primaryKey(),
    reportId: text("report_id")
      .notNull()
      .references(() => reports.id),
    kind: text("kind").notNull(),
    note: text("note").notNull(),
    actor: text("actor").notNull(),
    visibility: text("visibility").notNull(),
    createdAt: integer("created_at").notNull(),
    photoKey: text("photo_key"),
  },
  (table) => [
    index("idx_events_report_date").on(table.reportId, table.createdAt),
  ],
);
export const uploads = sqliteTable("uploads", {
  key: text("key").primaryKey(),
  owner: text("owner").notNull(),
  contentType: text("content_type").notNull(),
  size: integer("size").notNull(),
  createdAt: integer("created_at").notNull(),
});
export const portalUsers = sqliteTable(
  "portal_users",
  {
    id: text("id").primaryKey(),
    username: text("username").notNull().unique(),
    name: text("name").notNull(),
    role: text("role").notNull(),
    passwordHash: text("password_hash").notNull(),
    salt: text("salt").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [check("portal_user_role", sql`${t.role} IN ('citizen','official')`)],
);
export const portalSessions = sqliteTable(
  "portal_sessions",
  {
    tokenHash: text("token_hash").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => portalUsers.id),
    expiresAt: integer("expires_at").notNull(),
    officialCodeHash: text("official_code_hash"),
  },
  (t) => [index("idx_portal_sessions_expiry").on(t.expiresAt)],
);
export const portalRateLimits = sqliteTable("portal_rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  expiresAt: integer("expires_at").notNull(),
});
export const complaintRegistry = sqliteTable(
  "complaint_registry",
  {
    reportId: text("report_id")
      .primaryKey()
      .references(() => reports.id),
    ownerId: text("owner_id"),
    ward: text("ward").notNull().default("Unverified locality"),
    provider: text("provider").notNull().default(""),
    assignee: text("assignee").notNull().default(""),
    dueAt: integer("due_at"),
    providerTicket: text("provider_ticket").notNull().default(""),
    coordination: text("coordination").notNull().default("Not required"),
    clarification: text("clarification").notNull().default(""),
    escalated: integer("escalated").notNull().default(0),
    photoApproved: integer("photo_approved").notNull().default(0),
  },
  (t) => [index("idx_registry_owner").on(t.ownerId)],
);
export const complaintSupports = sqliteTable(
  "complaint_supports",
  {
    reportId: text("report_id")
      .notNull()
      .references(() => reports.id),
    userId: text("user_id")
      .notNull()
      .references(() => portalUsers.id),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.reportId, t.userId] })],
);
export const complaintPhotos = sqliteTable(
  "complaint_photos",
  {
    id: text("id").primaryKey(),
    reportId: text("report_id")
      .notNull()
      .references(() => reports.id),
    userId: text("user_id")
      .notNull()
      .references(() => portalUsers.id),
    photoKey: text("photo_key")
      .notNull()
      .unique()
      .references(() => uploads.key),
    status: text("status").notNull().default("pending"),
    createdAt: integer("created_at").notNull(),
    reviewedAt: integer("reviewed_at"),
  },
  (t) => [
    uniqueIndex("idx_one_pending_photo")
      .on(t.reportId)
      .where(sql`${t.status}='pending'`),
    check(
      "photo_review_status",
      sql`${t.status} IN ('pending','approved','rejected')`,
    ),
  ],
);
