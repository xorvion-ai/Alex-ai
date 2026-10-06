import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { activities, db, leads } from "@/lib/db";
import { skipLead } from "@/lib/skip";
import { jsonError } from "@/lib/api";

// Marking a lead CONTACTED records the contact and moves it out of the working
// list into the dashboard's CONTACTED LIST (per Sumit, 2026-08-24). It is no
// longer a delete — DELETE is its own button now.
//
// The record is a row in `activities`, which is also what keeps the lead out of
// the leads list (filterConditions excludes leads that have any activity).
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const leadId = Number(id);
    const d = db();
    const leadRows = await d.select().from(leads).where(eq(leads.id, leadId));
    if (!leadRows.length) return NextResponse.json({ error: "not found" }, { status: 404 });

    // Contacting is a state, not an event to log twice. ASK CHATGPT marks the
    // lead contacted too, so ASK CHATGPT then ✓ CONTACTED used to add a second
    // row — and the lead showed up twice in the CONTACTED LIST.
    const already = await d
      .select()
      .from(activities)
      .where(and(eq(activities.leadId, leadId), eq(activities.kind, "CONTACTED")))
      .limit(1);
    if (already.length) return NextResponse.json({ ok: true, activity: already[0], already: true });

    const rows = await d
      .insert(activities)
      .values({ leadId, kind: "CONTACTED", note: "Contacted" })
      .returning();
    // A later sweep of the same city finds this business again — don't pitch it twice.
    await skipLead(leadRows[0], "contacted");
    return NextResponse.json({ ok: true, activity: rows[0] });
  } catch (e) {
    return jsonError(e);
  }
}
