// TomTom Search API — third independent lead source (own commercial POI data).
// Free tier: 2,500 non-tile requests/day, no card. One request per category.

import { DIRECTORY_HOSTS, SOCIAL_HOSTS } from "@/lib/config";
import { guard, spend } from "@/lib/quota";
import { BBox } from "./osm";
import { classifyWebsite, digitsPhone, NormalizedLead } from "./types";

function apiKey(): string {
  const k = process.env.TOMTOM_API_KEY;
  if (!k) throw new Error("TOMTOM_API_KEY is not set — see .env.example");
  return k;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type TomtomResult = any;

export async function tomtomPoiSearch(
  queryText: string,
  bbox: BBox,
): Promise<TomtomResult[]> {
  await guard("tomtom");
  const [s, w, n, e] = bbox;
  const lat = (s + n) / 2;
  const lon = (w + e) / 2;
  // radius to bbox corner in meters, clamped to sensible city bounds
  const dLat = ((n - s) / 2) * 111_000;
  const dLon = ((e - w) / 2) * 111_000 * Math.cos((lat * Math.PI) / 180);
  const radius = Math.min(30_000, Math.max(3_000, Math.round(Math.hypot(dLat, dLon))));

  const url =
    `https://api.tomtom.com/search/2/poiSearch/${encodeURIComponent(queryText)}.json` +
    `?key=${apiKey()}&lat=${lat}&lon=${lon}&radius=${radius}&limit=100`;
  const res = await fetch(url);
  await spend("tomtom");
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`TomTom search failed (${res.status}): ${body.slice(0, 200)}`);
  }
  const json = await res.json();
  return json.results ?? [];
}

export async function tomtomPlaceById(entityId: string): Promise<TomtomResult | null> {
  await guard("tomtom");
  const res = await fetch(
    `https://api.tomtom.com/search/2/place.json?entityId=${encodeURIComponent(entityId)}&key=${apiKey()}`,
  );
  await spend("tomtom");
  if (!res.ok) return null;
  const json = await res.json();
  return json.results?.[0] ?? null;
}

export function normalizeTomtomPoi(
  r: TomtomResult,
  categoryId: string | null,
): NormalizedLead | null {
  const name: string | undefined = r.poi?.name;
  if (!name) return null;

  // TomTom urls are often scheme-less ("www.shop.com")
  let url: string | null = r.poi?.url ?? null;
  if (url && !/^https?:\/\//i.test(url)) url = `https://${url}`;
  const ws = classifyWebsite(url, SOCIAL_HOSTS, DIRECTORY_HOSTS);

  const phone: string | null = r.poi?.phone ?? null;
  const lat = r.position?.lat ?? null;
  const lng = r.position?.lon ?? null;

  return {
    source: "tomtom",
    sourceId: String(r.id),
    name,
    category: categoryId,
    types: (r.poi?.categories ?? []).slice(0, 5),
    address: r.address?.freeformAddress ?? null,
    area:
      r.address?.municipalitySubdivision ??
      r.address?.streetName ??
      r.address?.municipality ??
      null,
    lat,
    lng,
    phone,
    phoneIntl: digitsPhone(phone),
    rating: null,
    reviewCount: null,
    priceLevel: null,
    hours: null,
    mapsUri:
      lat != null && lng != null
        ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
        : null,
    websiteStatus: ws.status,
    socials: ws.social ? [ws.social] : [],
  };
}
