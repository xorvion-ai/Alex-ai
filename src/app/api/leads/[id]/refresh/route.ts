import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, leads } from "@/lib/db";
import { googlePlaceDetails, normalizeGooglePlace } from "@/lib/leadsource/google";
import { normalizeOsmElement, overpassById } from "@/lib/leadsource/osm";
import { normalizeTomtomPoi, tomtomPlaceById } from "@/lib/leadsource/tomtom";
import { NormalizedLead } from "@/lib/leadsource/types";
import { jsonError } from "@/lib/api";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const leadId = Number(id);
    const d = db();
    const rows = await d.select().from(leads).where(eq(leads.id, leadId));
    const lead = rows[0];
    if (!lead) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (lead.isDemo) {
      return NextResponse.json(
        { error: "demo lead — refresh works on real leads only" },
        { status: 400 },
      );
    }

    let fresh: NormalizedLead | null = null;
    if (lead.source === "google") {
      const place = await googlePlaceDetails(lead.sourceId);
      fresh = normalizeGooglePlace(place, lead.category);
    } else if (lead.source === "tomtom") {
      const poi = await tomtomPlaceById(lead.sourceId);
      fresh = poi ? normalizeTomtomPoi(poi, lead.category) : null;
    } else {
      const el = await overpassById(lead.sourceId);
      fresh = el ? normalizeOsmElement(el, lead.category) : null;
    }
    if (!fresh) {
      return NextResponse.json(
        { error: "source no longer has this business" },
        { status: 404 },
      );
    }

    // If the business now has a real website it's no longer a lead-quality target.
    const hasSiteNow = fresh.websiteStatus === "has_site";
    await d
      .update(leads)
      .set({
        name: fresh.name,
        address: fresh.address ?? lead.address,
        area: fresh.area ?? lead.area,
        lat: fresh.lat ?? lead.lat,
        lng: fresh.lng ?? lead.lng,
        phone: fresh.phone ?? lead.phone,
        phoneIntl: fresh.phoneIntl ?? lead.phoneIntl,
        rating: fresh.rating ?? lead.rating,
        reviewCount: fresh.reviewCount ?? lead.reviewCount,
        priceLevel: fresh.priceLevel ?? lead.priceLevel,
        hours: fresh.hours ?? lead.hours,
        mapsUri: fresh.mapsUri ?? lead.mapsUri,
        websiteStatus: hasSiteNow
          ? lead.websiteStatus
          : (fresh.websiteStatus as "none" | "social_only"),
        verifiedNoWebsite: hasSiteNow ? false : lead.verifiedNoWebsite,
        socials: fresh.socials.length ? fresh.socials : lead.socials,
        lastRefreshedAt: new Date(),
      })
      .where(eq(leads.id, leadId));

    return NextResponse.json({ ok: true, hasSiteNow });
  } catch (e) {
    return jsonError(e);
  }
}
