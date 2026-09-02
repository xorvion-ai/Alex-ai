// What the batch would analyze, and the country / business-type slices it can be
// narrowed to. Powers the two selectors next to the ANALYZE button.

import { NextRequest, NextResponse } from "next/server";
import { batchQueue } from "@/lib/analyze";
import { jsonError } from "@/lib/api";

export async function GET(req: NextRequest) {
  try {
    const p = req.nextUrl.searchParams;
    const q = await batchQueue({
      country: p.get("country") || null,
      category: p.get("category") || null,
    });
    return NextResponse.json(q);
  } catch (e) {
    return jsonError(e);
  }
}
