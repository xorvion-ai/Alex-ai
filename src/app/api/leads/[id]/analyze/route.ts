import { NextRequest, NextResponse } from "next/server";
import { analyzeLead } from "@/lib/analyze";
import { jsonError } from "@/lib/api";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    // Interactive single analyze: never auto-delete on a found website — the UI
    // asks the operator to confirm first.
    const result = await analyzeLead(Number(id), { dropOnSite: false });
    return NextResponse.json(result);
  } catch (e) {
    return jsonError(e);
  }
}
