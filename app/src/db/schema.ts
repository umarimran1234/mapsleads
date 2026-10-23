import { boolean, index, integer, jsonb, pgTable, real, serial, text, timestamp } from "drizzle-orm/pg-core";

export const jobs = pgTable("jobs", {
  /** The engine's job id, so the same id works in both places. */
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  keywords: jsonb("keywords").$type<string[]>().notNull(),
  city: text("city").notNull(),
  depth: integer("depth").notNull(),
  email: boolean("email").notNull().default(true),
  status: text("status", { enum: ["running", "done", "failed"] }).notNull().default("running"),
  error: text("error"),
  leadCount: integer("lead_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
});

/** A deep search: one niche across a whole area, split into map tiles, then a deep email pass. */
export const searches = pgTable("searches", {
  id: text("id").primaryKey(),
  keywords: jsonb("keywords").$type<string[]>().notNull(),
  area: text("area").notNull(),
  gridN: integer("grid_n").notNull(),
  depth: integer("depth").notNull(),
  findEmails: boolean("find_emails").notNull().default(true),
  status: text("status", { enum: ["running", "done", "failed", "cancelled"] }).notNull().default("running"),
  phase: text("phase", { enum: ["geocoding", "scanning", "emails", "done"] }).notNull().default("geocoding"),
  /** [south, north, west, east] of the area, from OpenStreetMap. */
  bbox: jsonb("bbox").$type<[number, number, number, number]>(),
  tilesTotal: integer("tiles_total").notNull().default(0),
  tilesDone: integer("tiles_done").notNull().default(0),
  tilesFailed: integer("tiles_failed").notNull().default(0),
  /** Distinct businesses seen across all tiles, including ones already in the database. */
  found: integer("found").notNull().default(0),
  sitesTotal: integer("sites_total").notNull().default(0),
  sitesChecked: integer("sites_checked").notNull().default(0),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
});

export const searchTiles = pgTable(
  "search_tiles",
  {
    id: serial("id").primaryKey(),
    searchId: text("search_id").notNull().references(() => searches.id, { onDelete: "cascade" }),
    idx: integer("idx").notNull(),
    lat: text("lat").notNull(),
    lon: text("lon").notNull(),
    radius: integer("radius").notNull(),
    zoom: integer("zoom").notNull(),
    status: text("status", { enum: ["pending", "running", "done", "failed"] }).notNull().default("pending"),
    /** Kept so a restarted server can pick the same engine job back up. */
    engineJobId: text("engine_job_id"),
    rows: integer("rows").notNull().default(0),
    error: text("error"),
  },
  (t) => [index("search_tiles_search_idx").on(t.searchId)],
);

export const leads = pgTable(
  "leads",
  {
    id: serial("id").primaryKey(),
    /** name + address, lower-cased: the same business never gets stored twice. */
    dedupeKey: text("dedupe_key").notNull().unique(),
    jobId: text("job_id").references(() => jobs.id, { onDelete: "set null" }),
    searchId: text("search_id").references(() => searches.id, { onDelete: "set null" }),
    title: text("title").notNull().default(""),
    phone: text("phone").notNull().default(""),
    emails: text("emails").notNull().default(""),
    website: text("website").notNull().default(""),
    instagram: text("instagram").notNull().default(""),
    facebook: text("facebook").notNull().default(""),
    linkedin: text("linkedin").notNull().default(""),
    category: text("category").notNull().default(""),
    address: text("address").notNull().default(""),
    rating: real("rating"),
    reviews: integer("reviews"),
    status: text("status", { enum: ["new", "contacted", "replied", "won", "lost"] }).notNull().default("new"),
    notes: text("notes").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("leads_job_idx").on(t.jobId), index("leads_status_idx").on(t.status), index("leads_created_idx").on(t.createdAt)],
);

export type Job = typeof jobs.$inferSelect;
export type Lead = typeof leads.$inferSelect;
export type Search = typeof searches.$inferSelect;
