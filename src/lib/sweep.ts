// Discovery engine — one "step" processes one query unit (client-driven chunks).

import { and, between, eq, sql } from "drizzle-orm";
import { countryName, GOOGLE_MAX_PAGES, LANGUAGE_HINTS } from "@/lib/config";
import { getCategory } from "@/lib/categories";
import { db, leads, searches, SweepQuery } from "@/lib/db";
import { similarName } from "@/lib/dedupe";
import {
  googleTextSearchPage,
  isPermanentlyClosed,
  normalizeGooglePlace,
} from "@/lib/leadsource/google";
import { geocodeCity, normalizeOsmElement, overpassSearch } from "@/lib/leadsource/osm";
import { normalizeTomtomPoi, tomtomPoiSearch } from "@/lib/leadsource/tomtom";
import { NormalizedLead } from "@/lib/leadsource/types";
import { QuotaExceededError } from "@/lib/quota";

export type FeedItem = {
  name: string;
  src: "G" | "OSM" | "TT";
  meta: string;
  tag: "NO_SITE" | "SOCIAL";
};

export type SweepProgress = {
  searchId: number;
  status: "running" | "stopped" | "complete";
  cursor: number;
  total: number;
  requests: number;
  scanned: number;
  added: number;
  quotaBlocked?: boolean;
  error?: string;
};

export async function createSweep(input: {
  country: string;
  city: string;
  keyword?: string;
  categories: string[];
  sources: ("google" | "osm" | "tomtom")[];
}): Promise<{ id: number; total: number; estRequests: number; warning?: string }> {
  const city = input.city.trim();
  if (!city) throw new Error("City / area is required");
  if (!input.categories.length) throw new Error("Pick at least one business type");
  if (!input.sources.length) throw new Error("Pick at least one lead source");

  const cname = countryName(input.country);
  let warning: string | undefined;

  // OSM and TomTom both need a bounding box (from free Nominatim geocoding)
  let bbox: [number, number, number, number] | null = null;
  let sources = input.sources;
  if (sources.includes("osm") || sources.includes("tomtom")) {
    bbox = await geocodeCity(city, cname || null);
    if (!bbox) {
      sources = sources.filter((s) => s !== "osm" && s !== "tomtom");
      warning = "couldn't locate this city on the map — sweeping Google only";
      if (!sources.length) throw new Error("couldn't locate this city on the map");
    }
  }

  const queries: SweepQuery[] = [];
  for (const source of sources) {
    for (const categoryId of input.categories) {
      const cat = getCategory(categoryId);
      queries.push({
        source: source as "google" | "osm" | "tomtom",
        categoryId,
        label: `${cat.label} · ${city}${source === "osm" ? " (OSM)" : source === "tomtom" ? " (TomTom)" : ""}`,
      });
    }
  }

  const label = `${input.categories.join("+")} · ${city}`;
  const rows = await db()
    .insert(searches)
    .values({
      label,
      country: cname || null,
      city,
      keyword: input.keyword?.trim() || null,
      categories: input.categories,
      sources,
      queries,
      bbox,
    })
    .returning({ id: searches.id });

  const googleQueries = queries.filter((q) => q.source === "google").length;
  const tomtomQueries = queries.filter((q) => q.source === "tomtom").length;
  return {
    id: rows[0].id,
    total: queries.length,
    estRequests: googleQueries * GOOGLE_MAX_PAGES + tomtomQueries,
    warning,
  };
}

/** Upsert one candidate. Returns whether it was newly added. */
async function insertLead(
  cand: NormalizedLead,
  ctx: { city: string; country: string | null },
): Promise<"added" | "updated" | "skipped"> {
  if (cand.websiteStatus === "has_site" || !cand.name) return "skipped";

  const d = db();
  const existing = await d
    .select({ id: leads.id })
    .from(leads)
    .where(and(eq(leads.source, cand.source), eq(leads.sourceId, cand.sourceId)));

  const data = {
    name: cand.name,
    category: cand.category,
    types: cand.types,
    address: cand.address,
    area: cand.area,
    lat: cand.lat,
    lng: cand.lng,
    phone: cand.phone,
    phoneIntl: cand.phoneIntl,
    rating: cand.rating,
    reviewCount: cand.reviewCount,
    priceLevel: cand.priceLevel,
    hours: cand.hours,
    mapsUri: cand.mapsUri,
    websiteStatus: cand.websiteStatus as "none" | "social_only",
    socials: cand.socials,
  };

  if (existing.length) {
    await d
      .update(leads)
      .set({ ...data, lastRefreshedAt: new Date() })
      .where(eq(leads.id, existing[0].id));
    return "updated";
  }

  // Cross-source dedup: same-ish name within ~150 m from the other source.
  if (cand.lat != null && cand.lng != null) {
    const nearby = await d
      .select({ id: leads.id, name: leads.name, source: leads.source })
      .from(leads)
      .where(
        and(
          between(leads.lat, cand.lat - 0.0015, cand.lat + 0.0015),
          between(leads.lng, cand.lng - 0.0015, cand.lng + 0.0015),
        ),
      );
    if (nearby.some((n) => n.source !== cand.source && similarName(n.name, cand.name))) {
      return "skipped";
    }
  }

  await d.insert(leads).values({
    source: cand.source,
    sourceId: cand.sourceId,
    ...data,
    city: ctx.city,
    country: ctx.country,
    languageHint: ctx.country ? (LANGUAGE_HINTS[ctx.country] ?? null) : null,
  });
  return "added";
}

export async function stepSweep(
  searchId: number,
): Promise<{ progress: SweepProgress; newLeads: FeedItem[] }> {
  const d = db();
  const rows = await d.select().from(searches).where(eq(searches.id, searchId));
  const s = rows[0];
  if (!s) throw new Error("Sweep not found");

  const toProgress = (over: Partial<SweepProgress> = {}): SweepProgress => ({
    searchId: s.id,
    status: s.status,
    cursor: s.cursor,
    total: s.queries.length,
    requests: s.requestsUsed,
    scanned: s.scanned,
    added: s.leadsAdded,
    ...over,
  });

  if (s.status !== "running" || s.cursor >= s.queries.length) {
    if (s.status === "running") {
      await d.update(searches).set({ status: "complete", updatedAt: new Date() }).where(eq(searches.id, s.id));
      return { progress: toProgress({ status: "complete" }), newLeads: [] };
    }
    return { progress: toProgress(), newLeads: [] };
  }

  const q = s.queries[s.cursor];
  const cat = getCategory(q.categoryId);
  const ctx = { city: s.city, country: s.country };
  const feed: FeedItem[] = [];
  let requests = 0;
  let scanned = 0;
  let added = 0;
  let quotaBlocked = false;
  let error: string | undefined;

  const pushFeed = (lead: NormalizedLead) => {
    feed.push({
      name: lead.name,
      src: lead.source === "google" ? "G" : lead.source === "osm" ? "OSM" : "TT",
      meta: `${lead.category ?? lead.types[0] ?? "business"} · ${lead.area ?? s.city}`,
      tag: lead.websiteStatus === "social_only" ? "SOCIAL" : "NO_SITE",
    });
  };

  try {
    if (q.source === "google") {
      const catLabel = q.categoryId === "any" ? (s.keyword || "local businesses") : cat.label;
      const keyword = q.categoryId === "any" ? "" : s.keyword ? ` ${s.keyword}` : "";
      const where = s.country ? `${s.city}, ${s.country}` : s.city;
      const query = `${catLabel}${keyword} in ${where}`;
      let pageToken: string | undefined;
      for (let page = 0; page < GOOGLE_MAX_PAGES; page++) {
        const res = await googleTextSearchPage(query, pageToken);
        requests++;
        for (const place of res.places) {
          scanned++;
          if (isPermanentlyClosed(place)) continue;
          const cand = normalizeGooglePlace(place, q.categoryId);
          const outcome = await insertLead(cand, ctx);
          if (outcome === "added") {
            added++;
            pushFeed(cand);
          }
        }
        pageToken = res.nextPageToken;
        if (!pageToken) break;
      }
    } else if (q.source === "tomtom") {
      if (!s.bbox) throw new Error("Missing map bounding box");
      const queryText =
        q.categoryId === "any"
          ? s.keyword || "shop"
          : `${cat.label}${s.keyword ? ` ${s.keyword}` : ""}`;
      const results = await tomtomPoiSearch(queryText, s.bbox);
      requests++;
      for (const r of results) {
        const cand = normalizeTomtomPoi(r, q.categoryId);
        if (!cand) continue;
        scanned++;
        const outcome = await insertLead(cand, ctx);
        if (outcome === "added") {
          added++;
          pushFeed(cand);
        }
      }
    } else {
      if (!s.bbox) throw new Error("Missing map bounding box");
      const elements = await overpassSearch(cat, s.bbox);
      for (const el of elements) {
        const cand = normalizeOsmElement(el, q.categoryId);
        if (!cand) continue;
        scanned++;
        if (s.keyword) {
          const hay = `${cand.name} ${cand.types.join(" ")}`.toLowerCase();
          if (!hay.includes(s.keyword.toLowerCase())) continue;
        }
        const outcome = await insertLead(cand, ctx);
        if (outcome === "added") {
          added++;
          pushFeed(cand);
        }
      }
    }
  } catch (e) {
    if (e instanceof QuotaExceededError) {
      quotaBlocked = true;
    } else {
      error = e instanceof Error ? e.message : String(e);
    }
  }

  const cursor = s.cursor + 1;
  const status: "running" | "stopped" | "complete" = quotaBlocked
    ? "stopped"
    : cursor >= s.queries.length
      ? "complete"
      : "running";

  await d
    .update(searches)
    .set({
      cursor,
      requestsUsed: s.requestsUsed + requests,
      scanned: s.scanned + scanned,
      leadsAdded: s.leadsAdded + added,
      status,
      updatedAt: new Date(),
    })
    .where(eq(searches.id, s.id));

  return {
    progress: {
      searchId: s.id,
      status,
      cursor,
      total: s.queries.length,
      requests: s.requestsUsed + requests,
      scanned: s.scanned + scanned,
      added: s.leadsAdded + added,
      quotaBlocked,
      error,
    },
    newLeads: feed,
  };
}

export async function stopSweep(searchId: number): Promise<void> {
  await db()
    .update(searches)
    .set({ status: "stopped", updatedAt: new Date() })
    .where(and(eq(searches.id, searchId), eq(searches.status, "running")));
}

export async function recentSweeps(limit = 5) {
  return db()
    .select()
    .from(searches)
    .orderBy(sql`${searches.createdAt} desc`)
    .limit(limit);
}
