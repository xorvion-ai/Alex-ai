// Web verification via Brave Search (free tier): confirm a lead truly has no
// website anywhere online, and harvest social links as extra contact channels.

import { eq } from "drizzle-orm";
import { SOCIAL_HOSTS, VERIFY_IGNORE_HOSTS } from "@/lib/config";
import { db, leads } from "@/lib/db";
import { normName } from "@/lib/dedupe";
import { guard, spend } from "@/lib/quota";

type BraveResult = { url: string; title: string };

async function braveSearch(q: string): Promise<BraveResult[]> {
  const key = process.env.BRAVE_SEARCH_API_KEY;
  if (!key) throw new Error("BRAVE_SEARCH_API_KEY is not set — see README setup");
  await guard("brave");
  const res = await fetch(
    `https://api.search.brave.com/res/v1/web/search?count=10&q=${encodeURIComponent(q)}`,
    { headers: { Accept: "application/json", "X-Subscription-Token": key } },
  );
  await spend("brave");
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Brave search failed (${res.status}): ${body.slice(0, 200)}`);
  }
  const json = await res.json();
  /* eslint-disable @typescript-eslint/no-explicit-any */
  return (json.web?.results ?? []).map((r: any) => ({
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
  const results = await braveSearch(q);

  const tokens = significantTokens(lead.name);
  const nameNorm = normName(lead.name);
  const socials = new Set(lead.socials ?? []);
  let foundSite: string | null = null;

  for (const r of results) {
    const h = host(r.url);
    if (!h) continue;
    const titleNorm = normName(r.title);
    const matchesName =
      titleNorm.includes(nameNorm) || tokens.some((t) => h.includes(t) || titleNorm.includes(t));
    if (!matchesName) continue;

    const isSocial = SOCIAL_HOSTS.some((s) => h === s || h.endsWith("." + s));
    if (isSocial) {
      socials.add(r.url);
      continue;
    }
    const ignored = VERIFY_IGNORE_HOSTS.some((s) => h === s || h.endsWith("." + s));
    if (!ignored && !foundSite) foundSite = r.url;
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
