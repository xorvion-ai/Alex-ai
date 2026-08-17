// Translate the exact WhatsApp message being sent into English, so the
// translation box always matches the send box (one Gemini call, on demand).

import { NextRequest, NextResponse } from "next/server";
import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import { GEMINI_MODEL } from "@/lib/config";
import { guard, spend } from "@/lib/quota";
import { jsonError } from "@/lib/api";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const text = String(body.text ?? "").trim();
    if (!text) return NextResponse.json({ error: "nothing to translate" }, { status: 400 });
    if (text.length > 3000) return NextResponse.json({ error: "text too long" }, { status: 400 });

    await guard("gemini");
    const r = await generateText({
      model: google(GEMINI_MODEL),
      prompt: [
        "Translate the following WhatsApp outreach message into natural English.",
        "Keep the same meaning, tone, line breaks and emoji. Keep names, prices and numbers exactly as they are.",
        "Reply with the translation only — no preamble, no quotes.",
        "",
        text,
      ].join("\n"),
    });
    await spend("gemini");
    return NextResponse.json({ english: r.text.trim() });
  } catch (e) {
    return jsonError(e);
  }
}
