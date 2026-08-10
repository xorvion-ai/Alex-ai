import { NextResponse } from "next/server";
import { getRates } from "@/lib/fx";
import { jsonError } from "@/lib/api";

export async function GET() {
  try {
    const rates = await getRates();
    if (!rates) return NextResponse.json({ inrPer: {}, updatedAt: null });
    return NextResponse.json(rates);
  } catch (e) {
    return jsonError(e);
  }
}
