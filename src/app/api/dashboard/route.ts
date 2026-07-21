import { NextResponse } from "next/server";
import { and, eq, gte, isNotNull, lte, sql } from "drizzle-orm";
import { activities, contactedArchive, db, leads, searches } from "@/lib/db";
import { getQuotaSnapshot } from "@/lib/quota";
import { ensureSeeded } from "@/lib/seed";
import { jsonError } from "@/lib/api";

export async function GET() {
  try {
    await ensureSeeded();
    const d = db();

    const [counts] = await d
      .select({
        live: sql<number>`count(*) filter (where ${leads.verifiedNoWebsite} is distinct from false)::int`,
        analyzed: sql<number>`count(*) filter (where ${leads.status} = 'analyzed' and ${leads.verifiedNoWebsite} is distinct from false)::int`,
        fresh: sql<number>`count(*) filter (where ${leads.status} = 'new' and ${leads.verifiedNoWebsite} is distinct from false)::int`,
        cities: sql<number>`count(distinct ${leads.city})::int`,
        sources: sql<number>`count(distinct ${leads.source})::int`,
      })
      .from(leads);

    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    const [archived] = await d
      .select({ n: sql<number>`count(*)::int` })
      .from(contactedArchive)
      .where(gte(contactedArchive.archivedAt, monthStart));

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    const followUps = await d
      .select({
        id: activities.id,
        leadId: activities.leadId,
        kind: activities.kind,
        note: activities.note,
        dueAt: activities.dueAt,
        leadName: leads.name,
      })
      .from(activities)
      .innerJoin(leads, eq(activities.leadId, leads.id))
      .where(
        and(
          isNotNull(activities.dueAt),
          eq(activities.done, false),
          lte(activities.dueAt, endOfToday),
        ),
      )
      .orderBy(activities.dueAt)
      .limit(8);

    const sweeps = await d
      .select()
      .from(searches)
      .orderBy(sql`${searches.createdAt} desc`)
      .limit(5);

    return NextResponse.json({
      stats: {
        live: counts?.live ?? 0,
        analyzed: counts?.analyzed ?? 0,
        newCount: counts?.fresh ?? 0,
        cities: counts?.cities ?? 0,
        sources: counts?.sources ?? 0,
        archivedThisMonth: archived?.n ?? 0,
      },
      followUps,
      sweeps: sweeps.map((s) => ({
        id: s.id,
        label: s.label,
        when: s.createdAt,
        found: s.scanned,
        added: s.leadsAdded,
        requests: s.requestsUsed,
        status: s.status,
      })),
      quota: await getQuotaSnapshot(),
    });
  } catch (e) {
    return jsonError(e);
  }
}
