// One normalized shape every lead source produces — pluggable per ALEX-AI-PLAN.md.

export type NormalizedLead = {
  source: "google" | "osm" | "tomtom";
  sourceId: string;
  name: string;
  category: string | null;
  types: string[];
  address: string | null;
  area: string | null;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  phoneIntl: string | null;
  rating: number | null;
  reviewCount: number | null;
  priceLevel: string | null;
  hours: string | null;
  mapsUri: string | null;
  websiteStatus: "none" | "social_only" | "has_site";
  socials: string[];
};

export function classifyWebsite(
  uri: string | null | undefined,
  socialHosts: string[],
  directoryHosts: string[],
): { status: "none" | "social_only" | "has_site"; social: string | null } {
  if (!uri) return { status: "none", social: null };
  let host = "";
  try {
    host = new URL(uri).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return { status: "none", social: null };
  }
  const match = (list: string[]) =>
    list.some((h) => host === h || host.endsWith("." + h));
  if (match(socialHosts)) return { status: "social_only", social: uri };
  if (match(directoryHosts)) return { status: "social_only", social: uri };
  return { status: "has_site", social: null };
}

/**
 * Does this "website" actually exist? Free — a plain HTTP request, no API.
 *
 * A Maps listing often points at a dead domain, a parked page or a link that
 * 404s, and dropping a genuine lead over one of those is the expensive mistake.
 * Social links never reach here: classifyWebsite() has already sorted
 * instagram.com, facebook.com, linktr.ee and the rest into social_only, which
 * keeps the lead. Undecidable cases (timeout, network error) count as NOT live,
 * which errs toward keeping the lead.
 */
export async function isLiveWebsite(url: string, timeoutMs = 6000): Promise<boolean> {
  const once = async (method: "HEAD" | "GET"): Promise<number> => {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method,
        signal: ac.signal,
        redirect: "follow",
        headers: { "User-Agent": "Mozilla/5.0 (compatible; Alex.ai-lead-finder/1.0)" },
      });
      return res.status;
    } catch {
      return 0;
    } finally {
      clearTimeout(timer);
    }
  };
  let status = await once("HEAD");
  // plenty of small-business hosts refuse HEAD but serve GET fine
  if (status === 0 || status === 403 || status === 405 || status >= 500) status = await once("GET");
  return status >= 200 && status < 400;
}

/** A sweep's own category label, or null when it carries no real information. */
export function cleanCategory(categoryId: string | null): string | null {
  return categoryId && categoryId !== "any" ? categoryId : null;
}

/** Metres between two points — good enough to tell "same shop" from "same street". */
export function metresApart(
  a: { lat: number | null; lng: number | null },
  b: { lat: number | null; lng: number | null },
): number | null {
  if (a.lat == null || a.lng == null || b.lat == null || b.lng == null) return null;
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Tidy a phone number as a source actually stored it.
 *
 * OSM contributors type numbers into a text field, so values arrive as
 * "3313463546.0" (entered as a number, trailing .0) or "33 1234 5678; 33 8765
 * 4321" (several numbers in one tag). Stripping digits naively turned the first
 * into 33134635460 — a real number with a spurious zero, which is what the CALL
 * and WhatsApp buttons then dialled.
 */
export function cleanPhone(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  let s = String(raw).trim();
  if (!s) return null;
  // several numbers in one tag — keep the first
  s = s.split(/[;,/]|\bor\b/i)[0].trim();
  // "...546.0" / "...546.00" — a decimal point that was never a phone digit
  s = s.replace(/\.0+$/, "");
  return s || null;
}

export function digitsPhone(phone: string | null | undefined): string | null {
  const cleaned = cleanPhone(phone);
  if (!cleaned) return null;
  const d = cleaned.replace(/[^\d]/g, "");
  return d.length >= 7 ? d : null;
}
