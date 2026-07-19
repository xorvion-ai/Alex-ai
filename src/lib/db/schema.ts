import {
  boolean,
  doublePrecision,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export type SitePlan = {
  contentAngle: string;
  sellingPoints: string[];
  suggestedPages: string[];
};

export type Outreach = {
  localLanguageLabel: string;
  whatsappEn: string;
  whatsappLocal: string;
  callScript: string[];
  bestCallWindow: string;
};

export type SweepQuery = {
  source: "google" | "osm" | "tomtom";
  categoryId: string;
  label: string;
};

export const leads = pgTable(
  "leads",
  {
    id: serial("id").primaryKey(),
    source: text("source").$type<"google" | "osm" | "tomtom">().notNull(),
    sourceId: text("source_id").notNull(),
    name: text("name").notNull(),
    category: text("category"),
    types: jsonb("types").$type<string[]>(),
    address: text("address"),
    area: text("area"),
    city: text("city"),
    country: text("country"),
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    phone: text("phone"),
    phoneIntl: text("phone_intl"),
    rating: doublePrecision("rating"),
    reviewCount: integer("review_count"),
    priceLevel: text("price_level"),
    hours: text("hours"),
    mapsUri: text("maps_uri"),
    websiteStatus: text("website_status")
      .$type<"none" | "social_only">()
      .notNull(),
    verifiedNoWebsite: boolean("verified_no_website"),
    verifiedAt: timestamp("verified_at"),
    socials: jsonb("socials").$type<string[]>(),
    languageHint: text("language_hint"),
    status: text("status").$type<"new" | "analyzed">().notNull().default("new"),
    score: integer("score"),
    isDemo: boolean("is_demo").notNull().default(false),
    firstSeenAt: timestamp("first_seen_at").notNull().defaultNow(),
    lastRefreshedAt: timestamp("last_refreshed_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("leads_source_uq").on(t.source, t.sourceId)],
);

export const analyses = pgTable("analyses", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id")
    .notNull()
    .references(() => leads.id, { onDelete: "cascade" }),
  model: text("model").notNull(),
  score: integer("score").notNull(),
  reasoning: text("reasoning").notNull(),
  businessProfile: text("business_profile").notNull(),
  sitePlan: jsonb("site_plan").$type<SitePlan>().notNull(),
  outreach: jsonb("outreach").$type<Outreach>().notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const searches = pgTable("searches", {
  id: serial("id").primaryKey(),
  label: text("label").notNull(),
  country: text("country"),
  city: text("city").notNull(),
  keyword: text("keyword"),
  categories: jsonb("categories").$type<string[]>().notNull(),
  sources: jsonb("sources").$type<string[]>().notNull(),
  queries: jsonb("queries").$type<SweepQuery[]>().notNull(),
  bbox: jsonb("bbox").$type<[number, number, number, number] | null>(), // s,w,n,e for OSM
  cursor: integer("cursor").notNull().default(0),
  requestsUsed: integer("requests_used").notNull().default(0),
  scanned: integer("scanned").notNull().default(0),
  leadsAdded: integer("leads_added").notNull().default(0),
  status: text("status")
    .$type<"running" | "stopped" | "complete">()
    .notNull()
    .default("running"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const activities = pgTable("activities", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id")
    .notNull()
    .references(() => leads.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(), // NOTE | CALL | WHATSAPP | VISIT | SYSTEM (follow-ups: any kind + dueAt)
  note: text("note").notNull(),
  dueAt: timestamp("due_at"),
  done: boolean("done").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const quotaUsage = pgTable(
  "quota_usage",
  {
    id: serial("id").primaryKey(),
    provider: text("provider").notNull(),
    period: text("period").notNull(), // '2026-07' (month) or '2026-07-19' (day)
    count: integer("count").notNull().default(0),
  },
  (t) => [uniqueIndex("quota_provider_period_uq").on(t.provider, t.period)],
);

export const contactedArchive = pgTable("contacted_archive", {
  id: serial("id").primaryKey(),
  leadName: text("lead_name").notNull(),
  snapshot: jsonb("snapshot").notNull(),
  archivedAt: timestamp("archived_at").notNull().defaultNow(),
});

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
});
