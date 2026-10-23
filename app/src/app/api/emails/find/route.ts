import { NextResponse } from "next/server";
import { findEmails } from "@/lib/email-extract";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Body: { urls: string[] } (max 10 per call; the browser sends batches and shows progress). */
export async function POST(req: Request) {
  const { urls } = await req.json();
  const list = (Array.isArray(urls) ? urls : []).map(String).slice(0, 10);
  if (!list.length) return NextResponse.json({ error: "urls required" }, { status: 400 });
  return NextResponse.json({ results: await Promise.all(list.map(findEmails)) });
}
