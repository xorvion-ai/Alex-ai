import { NextRequest } from "next/server";
import { parseFilters, queryLeads } from "@/lib/leads-query";
import { csvResponse, toCsv } from "@/lib/csv";
import { jsonError } from "@/lib/api";

export async function GET(req: NextRequest) {
  try {
    const rows = await queryLeads(parseFilters(req.nextUrl.searchParams), 10000);
    const csv = toCsv(
      [
        "name", "category", "phone", "address", "area", "city", "country",
        "rating", "reviews", "website_status", "verified_no_website", "score",
        "status", "source", "map_link", "socials", "hours", "first_seen",
      ],
      rows.map((l) => [
        l.name, l.category, l.phone, l.address, l.area, l.city, l.country,
        l.rating, l.reviewCount, l.websiteStatus,
        l.verifiedNoWebsite == null ? "" : l.verifiedNoWebsite,
        l.score, l.status, l.source, l.mapsUri, (l.socials ?? []).join(" | "),
        l.hours, l.firstSeenAt?.toISOString?.().slice(0, 10),
      ]),
    );
    return csvResponse("alex-ai-leads.csv", csv);
  } catch (e) {
    return jsonError(e);
  }
}
