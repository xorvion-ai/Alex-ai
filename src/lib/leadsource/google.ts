// Google Places API (New) — Text Search + Place Details.
// Every request is quota-guarded and logged (provider: google_places).

import { DIRECTORY_HOSTS, SOCIAL_HOSTS } from "@/lib/config";
import { guard, spend } from "@/lib/quota";
import { classifyWebsite, digitsPhone, NormalizedLead } from "./types";

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
    category: categoryId,
    types: p.types ?? [],
    address,
    area,
    lat: p.location?.latitude ?? null,
    lng: p.location?.longitude ?? null,
    phone: p.nationalPhoneNumber ?? p.internationalPhoneNumber ?? null,
    phoneIntl: digitsPhone(p.internationalPhoneNumber ?? p.nationalPhoneNumber),
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

export function isPermanentlyClosed(p: GooglePlace): boolean {
  return p.businessStatus === "CLOSED_PERMANENTLY";
}
