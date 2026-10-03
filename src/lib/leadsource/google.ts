// Google Places API (New) — Text Search + Place Details.
// Every request is quota-guarded and logged (provider: google_places).

import { DIRECTORY_HOSTS, SOCIAL_HOSTS } from "@/lib/config";
import { guard, spend } from "@/lib/quota";
import { classifyWebsite, cleanCategory, digitsPhone, NormalizedLead } from "./types";

const BASE = "https://places.googleapis.com/v1";

const SEARCH_FIELDS = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.types",
  "places.primaryTypeDisplayName",
  "places.rating",
  "places.userRatingCount",
  "places.nationalPhoneNumber",
  "places.internationalPhoneNumber",
  "places.websiteUri",
  "places.googleMapsUri",
  "places.regularOpeningHours",
  "places.priceLevel",
  "places.businessStatus",
  "nextPageToken",
].join(",");

const DETAIL_FIELDS = [
  "id",
  "displayName",
  "formattedAddress",
  "location",
  "types",
  "primaryTypeDisplayName",
  "rating",
  "userRatingCount",
  "nationalPhoneNumber",
  "internationalPhoneNumber",
  "websiteUri",
  "googleMapsUri",
  "regularOpeningHours",
  "priceLevel",
  "businessStatus",
].join(",");

function apiKey(): string {
  const k = process.env.GOOGLE_PLACES_API_KEY;
  if (!k) throw new Error("GOOGLE_PLACES_API_KEY is not set — see README setup");
  return k;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type GooglePlace = any;

const PRICE: Record<string, string> = {
  PRICE_LEVEL_FREE: "$",
  PRICE_LEVEL_INEXPENSIVE: "$",
  PRICE_LEVEL_MODERATE: "$$",
  PRICE_LEVEL_EXPENSIVE: "$$$",
  PRICE_LEVEL_VERY_EXPENSIVE: "$$$$",
};

export function normalizeGooglePlace(p: GooglePlace, categoryId: string | null): NormalizedLead {
  const ws = classifyWebsite(p.websiteUri, SOCIAL_HOSTS, DIRECTORY_HOSTS);
  const address: string | null = p.formattedAddress ?? null;
  // area: second-from-front address component chunk, best-effort
  const parts = (address ?? "").split(",").map((s: string) => s.trim());
  const area = parts.length >= 3 ? parts[1] : null;
  return {
    source: "google",
    sourceId: p.id,
    name: p.displayName?.text ?? "",
    // "any" sweeps must not brand every lead "any" — fall back to what the
    // source itself calls this business.
    category: cleanCategory(categoryId) ?? (p.types?.[0]?.replace(/_/g, " ") ?? null),
    types: p.types ?? [],
    address,
    area,
    lat: p.location?.latitude ?? null,
    lng: p.location?.longitude ?? null,
    phone: p.nationalPhoneNumber ?? p.internationalPhoneNumber ?? null,
    phoneIntl: digitsPhone(p.internationalPhoneNumber ?? p.nationalPhoneNumber),
    phoneAlt: null,
    rating: p.rating ?? null,
    reviewCount: p.userRatingCount ?? null,
    priceLevel: p.priceLevel ? (PRICE[p.priceLevel] ?? null) : null,
    hours: p.regularOpeningHours?.weekdayDescriptions?.join(" · ") ?? null,
    mapsUri: p.googleMapsUri ?? null,
    websiteStatus: ws.status,
    socials: ws.social ? [ws.social] : [],
  };
}

export async function googleTextSearchPage(
  query: string,
  pageToken?: string,
): Promise<{ places: GooglePlace[]; nextPageToken?: string }> {
  await guard("google_places");
  const res = await fetch(`${BASE}/places:searchText`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey(),
      "X-Goog-FieldMask": SEARCH_FIELDS,
    },
    body: JSON.stringify({
      textQuery: query,
      pageSize: 20,
      ...(pageToken ? { pageToken } : {}),
    }),
  });
  await spend("google_places");
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google Places search failed (${res.status}): ${body.slice(0, 300)}`);
  }
  const json = await res.json();
  return { places: json.places ?? [], nextPageToken: json.nextPageToken };
}

export async function googlePlaceDetails(placeId: string): Promise<GooglePlace> {
  await guard("google_places");
  const res = await fetch(`${BASE}/places/${placeId}`, {
    headers: { "X-Goog-Api-Key": apiKey(), "X-Goog-FieldMask": DETAIL_FIELDS },
  });
  await spend("google_places");
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google Place details failed (${res.status}): ${body.slice(0, 300)}`);
  }
  return res.json();
}

export type GoogleReview = { rating: number; text: string; when: string };

export async function googlePlaceReviews(placeId: string): Promise<GoogleReview[]> {
  await guard("google_places");
  const res = await fetch(`${BASE}/places/${placeId}`, {
    headers: { "X-Goog-Api-Key": apiKey(), "X-Goog-FieldMask": "reviews" },
  });
  await spend("google_places");
  if (!res.ok) return [];
  const json = await res.json();
  return (json.reviews ?? [])
    .map((r: GooglePlace) => ({
      rating: r.rating ?? 0,
      text: r.text?.text ?? r.originalText?.text ?? "",
      when: r.relativePublishTimeDescription ?? "",
    }))
    .filter((r: GoogleReview) => r.text);
}

/**
 * Shut for good, or shut "for now" — neither is a lead. Google reports both in
 * businessStatus; only OPERATIONAL is worth keeping. (This is the badge Maps
 * shows as "Permanently closed" / "Temporarily closed", not today's hours.)
 */
export function isClosed(p: GooglePlace): boolean {
  return p.businessStatus != null && p.businessStatus !== "OPERATIONAL";
}

/**
 * What Google knows about a business we found somewhere else, looked up by its
 * phone number (the one field OSM and TomTom get right).
 *
 * OSM in particular is years out of date: it happily lists a florist with no
 * website that has had floridens.com on its Maps listing for ages, or one that
 * closed last year. One search request per candidate buys the website verdict,
 * the open/closed verdict, and the rating, reviews and real Maps link that an
 * OSM row never has.
 */
async function searchOne(textQuery: string): Promise<GooglePlace | null> {
  await guard("google_places");
  const res = await fetch(`${BASE}/places:searchText`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey(),
      "X-Goog-FieldMask": SEARCH_FIELDS,
    },
    body: JSON.stringify({ textQuery, pageSize: 1 }),
  });
  await spend("google_places");
  if (!res.ok) return null;
  const json = await res.json();
  return json.places?.[0] ?? null;
}

export async function googleLookupBusiness(l: {
  phone?: string | null;
  name?: string | null;
  near?: string | null;
}): Promise<GooglePlace | null> {
  // Places only resolves a phone in full international form: "+17473295821"
  // matches, "7473295821" and "(747) 329-5821" return nothing.
  const digits = (l.phone ?? "").replace(/\D/g, "");
  if (digits.length >= 10) {
    const hit = await searchOne(`+${digits}`);
    if (hit) return hit;
  }
  // No phone match (OSM numbers often lack the country code) — fall back to the
  // name where the lead says it is. The caller still has to prove it is the same
  // business, by phone or by distance.
  if (l.name) {
    const q = [l.name, l.near].filter(Boolean).join(", ");
    return searchOne(q);
  }
  return null;
}
