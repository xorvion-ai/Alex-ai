import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { activities, analyses, db, leads } from "@/lib/db";
import { trashLead } from "@/lib/trash";
import { jsonError } from "@/lib/api";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const leadId = Number(id);
    const d = db();
    const leadRows = await d.select().from(leads).where(eq(leads.id, leadId));
    if (!leadRows.length) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
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
      .where(eq(activities.leadId, leadId))
      .orderBy(desc(activities.createdAt))
      .limit(50);
    return NextResponse.json({
      lead: leadRows[0],
      analysis: analysisRows[0] ?? null,
      activities: activityRows,
    });
  } catch (e) {
    return jsonError(e);
  }
}

// Delete a lead. A copy goes to the one-hour trash first (dashboard DELETED
// LIST) so a mistake is recoverable; after an hour it is purged for good.
// Cascades to its analyses + activities.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const leadId = Number(id);
    const d = db();
    const rows = await d.select().from(leads).where(eq(leads.id, leadId));
    if (rows[0]) await trashLead(rows[0], "deleted");
    await d.delete(leads).where(eq(leads.id, leadId));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return jsonError(e);
  }
}
