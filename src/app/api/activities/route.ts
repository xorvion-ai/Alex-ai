// The activity log: every note / call / follow-up ever added, newest first.
// Leads land here once they have a log entry (they leave the working list), so
// this is the "worked leads" view — searchable, filterable, paged.

import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, ilike, or, sql, SQL } from "drizzle-orm";
import { activities, db, leads } from "@/lib/db";
import { jsonError } from "@/lib/api";

const KINDS = ["NOTE", "CALL", "WHATSAPP", "VISIT"];

export async function GET(req: NextRequest) {
  try {
    const p = req.nextUrl.searchParams;
    const search = p.get("search")?.trim();
    const kind = p.get("kind")?.trim().toUpperCase();
    const limit = Math.min(200, Math.max(1, Number(p.get("limit")) || 10));
    const offset = Math.max(0, Number(p.get("offset")) || 0);

    const conds: SQL[] = [];
    if (search) {
      const term = `%${search}%`;
      conds.push(or(ilike(leads.name, term), ilike(activities.note, term))! as SQL);
    }
    if (kind && KINDS.includes(kind)) conds.push(eq(activities.kind, kind) as SQL);
    const where = conds.length ? and(...conds) : undefined;

    const d = db();
    const rows = await d
      .select({
        id: activities.id,
        leadId: activities.leadId,
        kind: activities.kind,
        note: activities.note,
        dueAt: activities.dueAt,
        createdAt: activities.createdAt,
        leadName: leads.name,
        country: leads.country,
      })
      .from(activities)
      .innerJoin(leads, eq(activities.leadId, leads.id))
      .where(where)
      .orderBy(desc(activities.createdAt))
      .limit(limit)
      .offset(offset);

    const [c] = await d
      .select({ n: sql<number>`count(*)::int` })
      .from(activities)
      .innerJoin(leads, eq(activities.leadId, leads.id))
      .where(where);

    return NextResponse.json({ activities: rows, total: c?.n ?? 0 });
  } catch (e) {
    return jsonError(e);
  }
}
