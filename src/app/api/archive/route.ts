import { sql } from "drizzle-orm";
import { contactedArchive, db } from "@/lib/db";
import { csvResponse, toCsv } from "@/lib/csv";
import { jsonError } from "@/lib/api";

// Contacted-history CSV — the only place archived (deleted) leads live on.
export async function GET() {
  try {
    const rows = await db()
      .select()
      .from(contactedArchive)
      .orderBy(sql`${contactedArchive.archivedAt} desc`)
      .limit(10000);

    /* eslint-disable @typescript-eslint/no-explicit-any */
    const csv = toCsv(
      [
        "archived_at", "name", "phone", "category", "address", "city", "country",
        "rating", "reviews", "score", "map_link", "socials", "source",
      ],
      rows.map((r) => {
        const s = r.snapshot as any;
        const l = s?.lead ?? {};
        return [
          r.archivedAt?.toISOString?.().slice(0, 16).replace("T", " "),
          r.leadName,
          l.phone, l.category, l.address, l.city, l.country,
          l.rating, l.reviewCount, l.score, l.mapsUri,
          (l.socials ?? []).join(" | "), l.source,
        ];
      }),
    );
    return csvResponse("alex-ai-contacted-history.csv", csv);
  } catch (e) {
    return jsonError(e);
  }
}
