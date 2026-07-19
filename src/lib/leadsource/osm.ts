// OpenStreetMap source: Nominatim geocoding + Overpass API queries.
// Completely free — no quota, just polite rate limiting (public-server etiquette).

import { DIRECTORY_HOSTS, OSM_MAX_ELEMENTS, SOCIAL_HOSTS } from "@/lib/config";
import { Category } from "@/lib/categories";
import { classifyWebsite, digitsPhone, NormalizedLead } from "./types";

const NOMINATIM = "https://nominatim.openstreetmap.org/search";
// Public Overpass servers get busy — try each in turn per query.
const OVERPASS_SERVERS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];
const USER_AGENT = "Alex.ai-lead-finder/1.0 (single-user personal tool)";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type BBox = [number, number, number, number]; // south, west, north, east

export async function geocodeCity(
  city: string,
  country: string | null,
): Promise<BBox | null> {
  const q = country ? `${city}, ${country}` : city;
  const url = `${NOMINATIM}?format=jsonv2&limit=1&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  await sleep(1100); // Nominatim policy: max 1 request/second
  if (!res.ok) return null;
  const json = (await res.json()) as { boundingbox?: string[] }[];
  const bb = json[0]?.boundingbox;
  if (!bb || bb.length !== 4) return null;
  // Nominatim returns [south, north, west, east]
  return [Number(bb[0]), Number(bb[2]), Number(bb[1]), Number(bb[3])];
}

function selectorToQl(selector: string, bbox: BBox): string {
  const [key, value] = selector.split("=");
  const b = bbox.join(",");
  return value === "*"
    ? `nwr["${key}"]["name"](${b});`
    : `nwr["${key}"="${value}"]["name"](${b});`;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type OsmElement = any;

export async function overpassSearch(
  category: Category,
  bbox: BBox,
): Promise<OsmElement[]> {
  const body = `[out:json][timeout:45];(${category.osm
    .map((s) => selectorToQl(s, bbox))
    .join("")});out center tags ${OSM_MAX_ELEMENTS};`;

  let lastError = "";
  for (const server of OVERPASS_SERVERS) {
    try {
      const res = await fetch(server, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": USER_AGENT,
        },
        body: `data=${encodeURIComponent(body)}`,
      });
      await sleep(1000); // be polite to the public servers
      if (res.ok) {
        const json = await res.json();
        return json.elements ?? [];
      }
      lastError = `${res.status} from ${new URL(server).hostname}`;
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
    }
  }
  throw new Error(`all Overpass servers busy (${lastError}) — retry this sweep in a minute`);
}

export async function overpassById(sourceId: string): Promise<OsmElement | null> {
  // sourceId looks like "node/123456" | "way/…" | "relation/…"
  const [type, id] = sourceId.split("/");
  if (!type || !id) return null;
  const body = `[out:json][timeout:30];${type}(${id});out center tags;`;
  const res = await fetch(OVERPASS, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": USER_AGENT,
    },
    body: `data=${encodeURIComponent(body)}`,
  });
  if (!res.ok) return null;
  const json = await res.json();
  return json.elements?.[0] ?? null;
}

export function normalizeOsmElement(
  el: OsmElement,
  categoryId: string | null,
): NormalizedLead | null {
  const tags = el.tags ?? {};
  const name: string | undefined = tags.name;
  if (!name) return null;

  const websiteTag = tags.website || tags["contact:website"] || tags.url || null;
  let ws = classifyWebsite(websiteTag, SOCIAL_HOSTS, DIRECTORY_HOSTS);
  const socials: string[] = [];
  for (const k of ["contact:facebook", "contact:instagram", "contact:whatsapp"]) {
    if (tags[k]) socials.push(String(tags[k]));
  }
  if (ws.social) socials.unshift(ws.social);
  if (ws.status === "none" && socials.length > 0) {
    ws = { status: "social_only", social: socials[0] };
  }

  const lat = el.lat ?? el.center?.lat ?? null;
  const lng = el.lon ?? el.center?.lon ?? null;
  const sourceId = `${el.type}/${el.id}`;
  const phone = tags.phone || tags["contact:phone"] || tags["contact:mobile"] || null;

  const addrParts = [
    tags["addr:housenumber"],
    tags["addr:street"],
    tags["addr:suburb"] || tags["addr:neighbourhood"],
    tags["addr:city"],
    tags["addr:postcode"],
  ].filter(Boolean);

  const kind =
    tags.shop || tags.craft || tags.amenity || tags.leisure || categoryId || null;

  return {
    source: "osm",
    sourceId,
    name,
    category: categoryId,
    types: [kind].filter(Boolean) as string[],
    address: addrParts.length ? addrParts.join(", ") : null,
    area: tags["addr:suburb"] || tags["addr:neighbourhood"] || tags["addr:street"] || null,
    lat,
    lng,
    phone,
    phoneIntl: digitsPhone(phone),
    rating: null,
    reviewCount: null,
    priceLevel: null,
    hours: tags.opening_hours ?? null,
    mapsUri: `https://www.openstreetmap.org/${sourceId}`,
    websiteStatus: ws.status,
    socials,
  };
}
