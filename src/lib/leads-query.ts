import { and, desc, eq, gte, ilike, or, sql, SQL } from "drizzle-orm";
import { countryName } from "@/lib/config";
import { db, leads } from "@/lib/db";

export type LeadFilters = {
  search?: string;
  country?: string;
  city?: string;
  category?: string[];
  source?: "google" | "osm";
  ws?: ("none" | "social_only")[];
  minScore?: number;
  verifiedOnly?: boolean;
  status?: "new" | "analyzed";
};

export function parseFilters(params: URLSearchParams): LeadFilters {
  const f: LeadFilters = {};
  const g = (k: string) => params.get(k)?.trim() || undefined;
  f.search = g("search");
  const country = g("country");
  if (country && countryName(country)) f.country = countryName(country);
  f.city = g("city");
  const cats = g("category");
  if (cats) {
    const list = cats.split(",").filter((c) => c && c !== "any");
    if (list.length) f.category = list;
  }
  const src = g("source");
  if (src === "google" || src === "osm") f.source = src;
  const ws = g("ws");
  if (ws) {
    const list = ws.split(",").filter((w): w is "none" | "social_only" =>
      w === "none" || w === "social_only",
    );
    if (list.length && list.length < 2) f.ws = list;
  }
  const minScore = g("minScore");
  if (minScore && Number(minScore) > 0) f.minScore = Number(minScore);
  if (g("verified") === "1") f.verifiedOnly = true;
  const status = g("status");
  if (status === "new" || status === "analyzed") f.status = status;
  return f;
}

export function filterConditions(f: LeadFilters): SQL[] {
  const conds: SQL[] = [];
  if (f.search) {
    const term = `%${f.search}%`;
    conds.push(
      or(
        ilike(leads.name, term),
        ilike(leads.address, term),
        ilike(leads.city, term),
      )! as SQL,
    );
  }
  if (f.country) conds.push(eq(leads.country, f.country) as SQL);
  if (f.city) conds.push(ilike(leads.city, `%${f.city}%`) as SQL);
  if (f.category)
    conds.push(sql`${leads.category} in (${sql.join(f.category.map((c) => sql`${c}`), sql`, `)})`);
  if (f.source) conds.push(eq(leads.source, f.source) as SQL);
  if (f.ws) conds.push(eq(leads.websiteStatus, f.ws[0]) as SQL);
  if (f.minScore) conds.push(gte(leads.score, f.minScore) as SQL);
  if (f.verifiedOnly) conds.push(eq(leads.verifiedNoWebsite, true) as SQL);
  if (f.status) conds.push(eq(leads.status, f.status) as SQL);
  return conds;
}

export async function queryLeads(f: LeadFilters, limit = 1000) {
  const conds = filterConditions(f);
  return db()
    .select()
    .from(leads)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(sql`coalesce(${leads.score}, -1)`), desc(leads.firstSeenAt))
    .limit(limit);
}

export async function countLeads(f: LeadFilters): Promise<number> {
  const conds = filterConditions(f);
  const rows = await db()
    .select({ n: sql<number>`count(*)::int` })
    .from(leads)
    .where(conds.length ? and(...conds) : undefined);
  return rows[0]?.n ?? 0;
}
