import { NextResponse } from "next/server";
import { and, eq, gte, isNotNull, lte, sql } from "drizzle-orm";
import { activities, contactedArchive, db, leads, searches } from "@/lib/db";
import { getQuotaSnapshot } from "@/lib/quota";
import { ensureSeeded } from "@/lib/seed";
import { getSettings } from "@/lib/settings";
import { jsonError } from "@/lib/api";

export async function GET() {
  try {
    await ensureSeeded();
    const d = db();

    // "Live leads" = leads that exist in the app: the working list plus the ones
    // that moved to the activity log. Rows without a phone are uncontactable and
    // show up nowhere, so counting them here made the tile read like a scan total.
    const contactable = sql`${leads.phone} is not null and ${leads.phone} <> ''`;
    const [counts] = await d
      .select({
        live: sql<number>`count(*) filter (where ${contactable})::int`,
        analyzed: sql<number>`count(*) filter (where ${leads.status} = 'analyzed' and ${contactable})::int`,
        fresh: sql<number>`count(*) filter (where ${leads.status} = 'new' and ${contactable})::int`,
        cities: sql<number>`count(distinct ${leads.city})::int`,
        sources: sql<number>`count(distinct ${leads.source})::int`,
      })
      .from(leads);

    // How many of those already have a log entry (they live in the ACTIVITY LOG
    // rather than the working list). Counted separately: a subquery inside a
    // `count(*) filter (...)` came back as 0 through the query builder.
    const [loggedRow] = await d
      .select({ n: sql<number>`count(distinct ${activities.leadId})::int` })
      .from(activities)
      .innerJoin(leads, eq(activities.leadId, leads.id))
      .where(sql`${leads.phone} is not null and ${leads.phone} <> ''`);
    const logged = loggedRow?.n ?? 0;

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

    const activityLog = await d
      .select({
        id: activities.id,
        leadId: activities.leadId,
        kind: activities.kind,
        note: activities.note,
        createdAt: activities.createdAt,
        leadName: leads.name,
        country: leads.country,
      })
      .from(activities)
      .innerJoin(leads, eq(activities.leadId, leads.id))
      .orderBy(sql`${activities.createdAt} desc`)
      .limit(10);

    const [activityCount] = await d
      .select({ n: sql<number>`count(*)::int` })
      .from(activities)
      .innerJoin(leads, eq(activities.leadId, leads.id));

    const sweeps = await d
      .select()
      .from(searches)
      .orderBy(sql`${searches.createdAt} desc`)
      .limit(5);

    return NextResponse.json({
      stats: {
        live: counts?.live ?? 0,
        inList: Math.max(0, (counts?.live ?? 0) - logged),
        logged,
        analyzed: counts?.analyzed ?? 0,
        newCount: counts?.fresh ?? 0,
        cities: counts?.cities ?? 0,
        sources: counts?.sources ?? 0,
        archivedThisMonth: archived?.n ?? 0,
      },
      followUps,
      activityLog,
      activityTotal: activityCount?.n ?? 0,
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
      trialEndsAt: (await getSettings()).trialEndsAt || null,
    });
  } catch (e) {
    return jsonError(e);
  }
}
