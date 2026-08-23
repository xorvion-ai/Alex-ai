import { NextRequest, NextResponse } from "next/server";
import { verifyLead } from "@/lib/verify";
import { jsonError } from "@/lib/api";

// No UI button calls this any more (analysis web-verifies every lead on its
// first pass, 2026-08-22) — kept as a manual re-check you can POST by hand.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    // A found website deletes the lead right here — no confirmation step.
    const result = await verifyLead(Number(id));
    return NextResponse.json(result);
  } catch (e) {
    return jsonError(e);
  }
}
