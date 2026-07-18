import { NextRequest, NextResponse } from "next/server";
import { analyzeLead } from "@/lib/analyze";
import { jsonError } from "@/lib/api";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const result = await analyzeLead(Number(id));
    return NextResponse.json(result);
  } catch (e) {
    return jsonError(e);
  }
}
