import { NextRequest, NextResponse } from "next/server";
import { createSweep } from "@/lib/sweep";
import { jsonError } from "@/lib/api";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = await createSweep({
      country: String(body.country ?? ""),
      city: String(body.city ?? ""),
      keyword: body.keyword ? String(body.keyword) : undefined,
      categories: Array.isArray(body.categories) ? body.categories.map(String) : [],
      sources: Array.isArray(body.sources) ? body.sources : [],
    });
    return NextResponse.json(result);
  } catch (e) {
    return jsonError(e);
  }
}
