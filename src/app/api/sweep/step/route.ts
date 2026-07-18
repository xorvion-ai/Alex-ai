import { NextRequest, NextResponse } from "next/server";
import { stepSweep } from "@/lib/sweep";
import { jsonError } from "@/lib/api";

export async function POST(req: NextRequest) {
  try {
    const { searchId } = await req.json();
    const result = await stepSweep(Number(searchId));
    return NextResponse.json(result);
  } catch (e) {
    return jsonError(e);
  }
}
