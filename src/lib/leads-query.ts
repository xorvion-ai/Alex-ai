import { and, desc, eq, gte, ilike, or, sql, SQL } from "drizzle-orm";
import { countryName } from "@/lib/config";
import { db, leads } from "@/lib/db";

export type LeadFilters = {
  search?: string;
  country?: string;
  city?: string;
  category?: string[];
  source?: "google" | "osm" | "tomtom";
  ws?: ("none" | "social_only")[];
  minScore?: number;
  verifiedOnly?: boolean;
  includeNoContact?: boolean;
  /** include leads that already have a log entry (they live in the activity log) */
  includeLogged?: boolean;
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
  if (src === "google" || src === "osm" || src === "tomtom") f.source = src;
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
  if (g("noContact") === "1") f.includeNoContact = true;
  if (g("logged") === "1") f.includeLogged = true;
  const status = g("status");
  if (status === "new" || status === "analyzed") f.status = status;
  return f;
}

export function filterConditions(f: LeadFilters): SQL[] {
  const conds: SQL[] = [];
  if (f.search) {
    const term = `%${f.search}%`;
    const parts: SQL[] = [
      ilike(leads.name, term) as SQL,
      ilike(leads.address, term) as SQL,
      ilike(leads.city, term) as SQL,
    ];
    // Typing a phone number finds its lead, however it is punctuated: both sides
    // are reduced to digits, so "096548 53020", "+91 96548-53020" and
    // "9654853020" all match the same row.
    const digits = f.search.replace(/\D/g, "");
    if (digits.length >= 4) {
      parts.push(sql`regexp_replace(coalesce(${leads.phone}, ''), '[^0-9]', '', 'g') like ${`%${digits}%`}`);
      parts.push(sql`regexp_replace(coalesce(${leads.phoneIntl}, ''), '[^0-9]', '', 'g') like ${`%${digits}%`}`);
    }
    conds.push(or(...parts)! as SQL);
  }
  if (f.country) conds.push(eq(leads.country, f.country) as SQL);
  if (f.city) conds.push(ilike(leads.city, `%${f.city}%`) as SQL);
  if (f.category)
    conds.push(sql`${leads.category} in (${sql.join(f.category.map((c) => sql`${c}`), sql`, `)})`);
  if (f.source) conds.push(eq(leads.source, f.source) as SQL);
  if (f.ws) conds.push(eq(leads.websiteStatus, f.ws[0]) as SQL);
  if (f.minScore) conds.push(gte(leads.score, f.minScore) as SQL);
  // Leads found to have a real website are deleted, not hidden, so the only
  // distinction left is "web-verified as having none" vs "not checked yet".
  if (f.verifiedOnly) conds.push(eq(leads.verifiedNoWebsite, true) as SQL);
  if (f.status) conds.push(eq(leads.status, f.status) as SQL);
  // Only contactable leads by default — must have a phone (email isn't
  // collected, so it's the only reachable channel). Opt out with ?noContact=1.
  if (!f.includeNoContact) {
    conds.push(sql`${leads.phone} is not null and ${leads.phone} <> ''`);
  }
  // Once a lead has a log entry (note / call / follow-up) it moves out of the
  // working list and lives in the dashboard ACTIVITY LOG. Opt out with ?logged=1.
  if (!f.includeLogged) {
    conds.push(
      sql`not exists (select 1 from activities a where a.lead_id = ${leads.id})`,
    );
  }
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
