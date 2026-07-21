// Web verification via Tavily (free plan: 1,000 searches/month, no card):
// confirm a lead truly has no website anywhere online, and harvest social
// links as extra contact channels.

import { eq } from "drizzle-orm";
import { SOCIAL_HOSTS, VERIFY_IGNORE_HOSTS } from "@/lib/config";
import { db, leads } from "@/lib/db";
import { normName } from "@/lib/dedupe";
import { guard, spend } from "@/lib/quota";

type SearchResult = { url: string; title: string };

async function tavilySearch(q: string): Promise<SearchResult[]> {
  const key = process.env.TAVILY_API_KEY;
  if (!key) throw new Error("TAVILY_API_KEY is not set — see .env.example");
  await guard("tavily");
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      query: q,
      max_results: 10,
      search_depth: "basic",
      include_answer: false,
    }),
  });
  await spend("tavily");
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Tavily search failed (${res.status}): ${body.slice(0, 200)}`);
  }
  const json = await res.json();
  /* eslint-disable @typescript-eslint/no-explicit-any */
  return (json.results ?? []).map((r: any) => ({
    url: r.url ?? "",
    title: r.title ?? "",
  }));
}

function host(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function significantTokens(name: string): string[] {
  const GENERIC = new Set([
    "shop", "store", "the", "and", "salon", "restaurant", "hotel", "cafe",
    "clinic", "centre", "center", "works", "house", "new", "best",
  ]);
  return normName(name)
    .split(" ")
    .filter((t) => t.length > 3 && !GENERIC.has(t));
}

// A domain "belongs to" the business only when the business name — or at least
// two of its significant tokens — is baked into the hostname. That is the
// reliable signal a small business owns a site. Matching on the page *title*
// alone is far too loose: a business named for a place ("Arizona Shower Door")
// otherwise matches unrelated pages like a tourism site titled "Arizona".
function looksLikeOwnSite(h: string, nameNorm: string, tokens: string[]): boolean {
  const flatHost = h.replace(/[^a-z0-9]/g, "");
  const flatName = nameNorm.replace(/[^a-z0-9]/g, "");
  if (flatName.length >= 5 && flatHost.includes(flatName)) return true;
  if (tokens.length) {
    const hits = tokens.filter((t) => flatHost.includes(t)).length;
    if (hits >= Math.min(2, tokens.length)) return true;
  }
  return false;
}

export async function verifyLead(leadId: number): Promise<{
  verifiedNoWebsite: boolean;
  foundSite: string | null;
  socials: string[];
}> {
  const d = db();
  const rows = await d.select().from(leads).where(eq(leads.id, leadId));
  const lead = rows[0];
  if (!lead) throw new Error("Lead not found");

  const q = `"${lead.name}" ${lead.city ?? ""} ${lead.country ?? ""}`.trim();
  const results = await tavilySearch(q);

  const tokens = significantTokens(lead.name);
  const nameNorm = normName(lead.name);
  const socials = new Set(lead.socials ?? []);
  let foundSite: string | null = null;

  for (const r of results) {
    const h = host(r.url);
    if (!h) continue;
    const titleNorm = normName(r.title);
    const isSocial = SOCIAL_HOSTS.some((s) => h === s || h.endsWith("." + s));

    if (isSocial) {
      // Harvest social pages that plausibly belong to this business. A loose
      // match is acceptable here — socials are supplementary contact channels,
      // not the "has a real website" decision.
      const related =
        titleNorm.includes(nameNorm) ||
        tokens.filter((t) => titleNorm.includes(t) || r.url.toLowerCase().includes(t)).length >=
          Math.min(2, tokens.length || 1);
      if (related) socials.add(r.url);
      continue;
    }

    const ignored = VERIFY_IGNORE_HOSTS.some((s) => h === s || h.endsWith("." + s));
    if (ignored) continue;

    // Count a result as "their real website" only when the domain itself is
    // name-derived — this is what prevents a false positive from dropping a
    // genuine no-website lead.
    if (!foundSite && looksLikeOwnSite(h, nameNorm, tokens)) foundSite = r.url;
  }

  const verifiedNoWebsite = !foundSite;
  await d
    .update(leads)
    .set({
      verifiedNoWebsite,
      verifiedAt: new Date(),
      socials: [...socials],
    })
    .where(eq(leads.id, leadId));

  return { verifiedNoWebsite, foundSite, socials: [...socials] };
}
