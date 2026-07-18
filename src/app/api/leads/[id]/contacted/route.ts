import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { activities, analyses, contactedArchive, db, leads } from "@/lib/db";
import { jsonError } from "@/lib/api";

// Per plan: marking Contacted/Done archives a full snapshot to the
// contacted-history CSV table, then permanently deletes the lead.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const leadId = Number(id);
    const d = db();
    const leadRows = await d.select().from(leads).where(eq(leads.id, leadId));
    const lead = leadRows[0];
    if (!lead) return NextResponse.json({ error: "not found" }, { status: 404 });

    // The demo lead is deleted without polluting the real contacted history.
    if (lead.isDemo) {
      await d.delete(leads).where(eq(leads.id, leadId));
      return NextResponse.json({ ok: true, demo: true });
    }

    const analysisRows = await d
      .select()
      .from(analyses)
      .where(eq(analyses.leadId, leadId))
      .orderBy(desc(analyses.createdAt))
      .limit(1);
    const activityRows = await d
      .select()
      .from(activities)
      .where(eq(activities.leadId, leadId));

    await d.insert(contactedArchive).values({
      leadName: lead.name,
      snapshot: {
        lead,
        analysis: analysisRows[0] ?? null,
        activities: activityRows,
      },
    });
    await d.delete(leads).where(eq(leads.id, leadId)); // cascades analyses/activities

    return NextResponse.json({ ok: true });
  } catch (e) {
    return jsonError(e);
  }
}
