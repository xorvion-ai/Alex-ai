import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, leads } from "@/lib/db";
import { jsonError } from "@/lib/api";

// Marking a lead Contacted permanently DELETES it (per Sumit, 2026-07-21: no
// archive/history copy — a contacted lead is removed completely). Cascades to
// its analyses + activities.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const leadId = Number(id);
    const d = db();
    const leadRows = await d.select({ id: leads.id }).from(leads).where(eq(leads.id, leadId));
    if (!leadRows.length) return NextResponse.json({ error: "not found" }, { status: 404 });

    await d.delete(leads).where(eq(leads.id, leadId));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return jsonError(e);
  }
}
