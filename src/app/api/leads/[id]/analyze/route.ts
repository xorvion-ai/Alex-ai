import { NextRequest, NextResponse } from "next/server";
import { analyzeLead } from "@/lib/analyze";
import { jsonError } from "@/lib/api";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    // Same rule as the batch: a found website deletes the lead, no prompt.
    const result = await analyzeLead(Number(id));
    return NextResponse.json(result);
  } catch (e) {
    return jsonError(e);
  }
}
