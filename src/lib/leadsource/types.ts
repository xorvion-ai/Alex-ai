// One normalized shape every lead source produces — pluggable per ALEX-AI-PLAN.md.

export type NormalizedLead = {
  source: "google" | "osm";
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

export function digitsPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const d = phone.replace(/[^\d]/g, "");
  return d.length >= 7 ? d : null;
}
