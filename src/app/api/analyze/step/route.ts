import { NextResponse } from "next/server";
import { analyzeNextNew } from "@/lib/analyze";
import { jsonError } from "@/lib/api";

// One batch step = one lead analyzed. The client paces calls to stay inside
// the Gemini free-tier rate limit and can pause/resume anytime.
export async function POST() {
  try {
    const result = await analyzeNextNew();
    return NextResponse.json(result);
  } catch (e) {
    return jsonError(e);
  }
}
