import { NextRequest, NextResponse } from "next/server";
import { countLeads, parseFilters, queryLeads } from "@/lib/leads-query";
import { ensureSeeded } from "@/lib/seed";
import { jsonError } from "@/lib/api";

export async function GET(req: NextRequest) {
  try {
    await ensureSeeded();
    const params = req.nextUrl.searchParams;
    const filters = parseFilters(params);
    if (params.get("countOnly") === "1") {
      return NextResponse.json({ count: await countLeads(filters) });
    }
    const rows = await queryLeads(filters);
    return NextResponse.json({ leads: rows, count: rows.length });
  } catch (e) {
    return jsonError(e);
  }
}
