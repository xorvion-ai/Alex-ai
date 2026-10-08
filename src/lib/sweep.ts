// Discovery engine — one "step" processes one query unit (client-driven chunks).

import { and, between, eq, sql } from "drizzle-orm";
import {
  countryName,
  GOOGLE_MAX_PAGES,
  LANGUAGE_HINTS,
  toInternational,
} from "@/lib/config";
import { getCategory } from "@/lib/categories";
import { db, leads, searches, SweepQuery } from "@/lib/db";
import { similarName } from "@/lib/dedupe";
import {
  googleLookupBusiness,
  googleTextSearchPage,
  isClosed,
  normalizeGooglePlace,
} from "@/lib/leadsource/google";
import { geocodeCity, normalizeOsmElement, overpassSearch } from "@/lib/leadsource/osm";
import { normalizeTomtomPoi, tomtomPoiSearch } from "@/lib/leadsource/tomtom";
import {
  digitsPhone,
  isLiveWebsite,
  metresApart,
  NormalizedLead,
} from "@/lib/leadsource/types";
import { canSpend, QuotaExceededError } from "@/lib/quota";
import { isSkipped, phoneKey, skipLead } from "@/lib/skip";

/** How long one step works through candidates before handing back. */
const STEP_BUDGET_MS = 60_000;
/** How many times a failing query is retried before the sweep moves on. */
const MAX_ATTEMPTS = 3;

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
  /** this step ran out of time and the next one continues the same query */
  partial?: boolean;
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

  // A sweep whose tab was closed mid-run stays "running" forever — 25 of them
  // had piled up, some for 76 days. Nothing drives a sweep but its own page, so
  // one that has not moved for half an hour is not running; say so.
  await db()
    .update(searches)
    .set({ status: "stopped" })
    .where(and(eq(searches.status, "running"), sql`${searches.updatedAt} < now() - interval '30 minutes'`));

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

/**
 * Cross-check an OSM / TomTom candidate against Google Maps before it is
 * allowed into the list, and fold in what Google knows.
 *
 * Returns `{ reject }` when the business should NOT become a lead — it has a
 * real website, or Maps says it is temporarily or permanently closed.
 *
 * Costs one Places request per candidate, so it only runs while the free tier
 * is comfortable; past that the candidate goes in unchecked exactly as before
 * (the analysis pass still web-verifies it later).
 */
async function crossCheckOnGoogle(
  cand: NormalizedLead,
  ctx: { city: string; country: string | null },
): Promise<NormalizedLead | { reject: "closed" | "has_website" }> {
  const phone = cand.phoneIntl || cand.phone;
  // Runs right up to the Guardian's stop. Quitting earlier (it used to stop at
  // 80%) only meant the last stretch of a month's sweeps came in unverified.
  if (!(await canSpend("google_places", 2))) {
    return cand;
  }

  let p: Awaited<ReturnType<typeof googleLookupBusiness>> = null;
  try {
    p = await googleLookupBusiness({
      phone,
      name: cand.name,
      near: cand.address ?? [ctx.city, ctx.country].filter(Boolean).join(", "),
    });
  } catch {
    return cand; // a failed lookup must not stop the sweep
  }
  if (!p) return cand;

  // Prove it is the same business before trusting Google over the source: the
  // same phone, or the same spot (a name search can easily land on a namesake
  // in another suburb, and dropping a good lead over that is the worst error).
  const samePhone =
    !!phone &&
    digitsPhone(p.nationalPhoneNumber ?? p.internationalPhoneNumber)?.slice(-9) ===
      digitsPhone(phone)?.slice(-9);
  const apart = metresApart(cand, {
    lat: p.location?.latitude ?? null,
    lng: p.location?.longitude ?? null,
  });
  if (!samePhone && !(apart != null && apart <= 250)) return cand;

  if (isClosed(p)) return { reject: "closed" };
  const g = normalizeGooglePlace(p, null);
  // An instagram.com / facebook.com "website" is social_only, so the lead
  // stays. A real domain only disqualifies it if the link actually loads.
  if (g.websiteStatus === "has_site" && (await isLiveWebsite(p.websiteUri))) {
    return { reject: "has_website" };
  }

  // Keep the original source and id — this is enrichment, not a Google lead.
  return {
    ...cand,
    rating: g.rating ?? cand.rating,
    reviewCount: g.reviewCount ?? cand.reviewCount,
    priceLevel: g.priceLevel ?? cand.priceLevel,
    hours: g.hours ?? cand.hours,
    address: cand.address ?? g.address,
    area: cand.area ?? g.area,
    lat: g.lat ?? cand.lat,
    lng: g.lng ?? cand.lng,
    // the real Maps link for this exact place, instead of a name search
    mapsUri: g.mapsUri ?? cand.mapsUri,
    websiteStatus: g.websiteStatus === "social_only" ? "social_only" : cand.websiteStatus,
    socials: [...new Set([...cand.socials, ...g.socials])],
  };
}

/** The candidate's columns, as stored. */
function fields(c: NormalizedLead, country: string | null) {
  return {
    name: c.name,
    category: c.category,
    types: c.types,
    address: c.address,
    area: c.area,
    lat: c.lat,
    lng: c.lng,
    phone: c.phone,
    // stored in full international form — wa.me and Places both need it
    phoneIntl: toInternational(c.phoneIntl ?? c.phone, country),
    phoneAlt: toInternational(c.phoneAlt, country),
    rating: c.rating,
    reviewCount: c.reviewCount,
    priceLevel: c.priceLevel,
    hours: c.hours,
    mapsUri: c.mapsUri,
    websiteStatus: c.websiteStatus as "none" | "social_only",
    socials: c.socials,
  };
}

/** Upsert one candidate. Returns whether it was newly added. */
async function insertLead(
  cand: NormalizedLead,
  ctx: { city: string; country: string | null },
): Promise<"added" | "updated" | "skipped"> {
  if (cand.websiteStatus === "has_site" || !cand.name) return "skipped";
  // Already contacted or deleted once — never bring it back.
  if (await isSkipped(cand.source, cand.sourceId, cand.phoneIntl ?? cand.phone)) return "skipped";

  const d = db();
  const existing = await d
    .select({ id: leads.id })
    .from(leads)
    .where(and(eq(leads.source, cand.source), eq(leads.sourceId, cand.sourceId)));

  if (existing.length) {
    await d
      .update(leads)
      .set({ ...fields(cand, ctx.country), lastRefreshedAt: new Date() })
      .where(eq(leads.id, existing[0].id));
    return "updated";
  }

  // Cross-source dedup, first pass: the same phone number is the same business,
  // whatever the sources call it. Names differ between Google, TomTom and OSM
  // ("Rose Clothing" vs "Rose Clothing Inc"), so name+distance alone let the
  // same shop into the list twice.
  const key = phoneKey(cand.phoneIntl ?? cand.phone);
  if (key) {
    const samePhone = await d
      .select({ id: leads.id })
      .from(leads)
      .where(
        sql`right(regexp_replace(coalesce(${leads.phoneIntl}, ${leads.phone}, ''), '[^0-9]', '', 'g'), 9) = ${key}`,
      )
      .limit(1);
    if (samePhone.length) return "skipped";
  }

  // Cross-source dedup, second pass: same-ish name within ~150 m from the other source.
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

  // Last gate before it becomes a lead: ask Google about anything that did not
  // come from Google. Runs here, after every free rejection above, so a request
  // is only ever spent on a candidate that would otherwise be added.
  if (cand.source !== "google") {
    const checked = await crossCheckOnGoogle(cand, ctx);
    if ("reject" in checked) {
      // Remember the verdict. Without this, a rejected shop was checked again —
      // a Places lookup and a website test — on every re-run of the query and
      // every later sweep of the same city; with it, it is one indexed lookup.
      await skipLead({ ...cand, country: ctx.country }, checked.reject);
      return "skipped";
    }
    cand = checked;
  }

  // The existence check above happened before the Google cross-check, which
  // takes seconds — long enough for a second run of the same query (a retry, or
  // another tab stepping the same sweep) to insert this row in between. Losing
  // that race is normal and must not abort the whole query, so the conflict is
  // absorbed and reported as "already had it".
  const inserted = await d
    .insert(leads)
    .values({
      source: cand.source,
      sourceId: cand.sourceId,
      // rebuilt from `cand`, which the cross-check above may have enriched
      ...fields(cand, ctx.country),
      city: ctx.city,
      country: ctx.country,
      languageHint: ctx.country ? (LANGUAGE_HINTS[ctx.country] ?? null) : null,
    })
    .onConflictDoNothing({ target: [leads.source, leads.sourceId] })
    .returning({ id: leads.id });
  return inserted.length ? "added" : "skipped";
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

  // OSM and TomTom queries can return hundreds of shops, and every NEW one
  // costs a Maps lookup and a website check, so one query used to run for
  // minutes until the platform killed the step. The cursor never moved, the
  // page gave up, and the sweep had to be started again from zero.
  //
  // Now such a query works for at most STEP_BUDGET_MS, records exactly which
  // result it reached (itemOffset), and the next step carries on from there —
  // every step moves forward, so it cannot loop. Google queries are exempt:
  // they are small (≤60 results), skip the cross-check, and re-running one
  // would pay for the search again.
  const startAt = s.itemOffset;
  let nextOffset = 0;
  let partial = false;
  let deadline = Infinity;
  const startClock = () => {
    deadline = Date.now() + STEP_BUDGET_MS;
  };
  /** Stop before result `i` if time is up — but always do at least one. */
  const outOfTime = (i: number) => {
    if (i === startAt || Date.now() < deadline) return false;
    partial = true;
    nextOffset = i;
    return true;
  };

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
          // permanently OR temporarily closed — neither is worth pitching
          if (isClosed(place)) continue;
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
      startClock();
      for (let i = startAt; i < results.length; i++) {
        if (outOfTime(i)) break;
        const r = results[i];
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
      startClock();
      for (let i = startAt; i < elements.length; i++) {
        if (outOfTime(i)) break;
        const el = elements[i];
        const cand = normalizeOsmElement(el, q.categoryId);
        if (!cand) continue;
        scanned++;
        // OSM entries usually list no contact at all. Keep only reachable ones:
        // require a phone (the only channel we can act on — no email pipeline).
        if (!cand.phone) continue;
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

  // Where the cursor goes next:
  //  - out of time  → stay, the next step continues this query
  //  - a failure (a busy Overpass mirror, a timeout) → stay and RETRY, up to
  //    MAX_ATTEMPTS. It used to move straight on, which is how a sweep quietly
  //    lost whole queries ("all Overpass servers busy" and the next one ran).
  //  - after MAX_ATTEMPTS failures → move on, and say the query was skipped.
  const failed = !!error && !quotaBlocked;
  const attempts = failed ? s.attempts + 1 : 0;
  const giveUp = failed && attempts >= MAX_ATTEMPTS;
  const advance = !quotaBlocked && !partial && (!failed || giveUp);
  const cursor = advance ? s.cursor + 1 : s.cursor;
  const status: "running" | "stopped" | "complete" = quotaBlocked
    ? "stopped"
    : cursor >= s.queries.length
      ? "complete"
      : "running";
  if (failed) {
    error = giveUp
      ? `${q.source}/${q.categoryId} skipped after ${MAX_ATTEMPTS} tries — ${error}`
      : `${error} — retrying (${attempts}/${MAX_ATTEMPTS})`;
  }

  await d
    .update(searches)
    .set({
      cursor,
      attempts: advance ? 0 : attempts,
      // where the next step picks this query back up: the result reached, or
      // the top of the next query. A failed step keeps the last good offset.
      itemOffset: advance ? 0 : partial ? nextOffset : s.itemOffset,
      requestsUsed: s.requestsUsed + requests,
      // each pass scans only results the last one didn't reach, so this adds up
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
      partial,
    },
    newLeads: feed,
  };
}

export async function resumeSweep(searchId: number): Promise<void> {
  await db()
    .update(searches)
    .set({ status: "running", attempts: 0, updatedAt: new Date() })
    .where(
      and(
        eq(searches.id, searchId),
        eq(searches.status, "stopped"),
        sql`${searches.cursor} < jsonb_array_length(${searches.queries}::jsonb)`,
      ),
    );
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
