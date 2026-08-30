import {
  sqliteTable,
  text,
  integer,
  real,
  index,
} from "drizzle-orm/sqlite-core";
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
