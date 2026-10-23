import { NextResponse } from "next/server";
import { GRID_LEVELS, createSearch, listSearches, resumeAll } from "@/lib/deep-search";
import { engineUp } from "@/lib/engine";

export const dynamic = "force-dynamic";

export async function GET() {
  await resumeAll(); // no-op unless the server restarted mid-search
  return NextResponse.json({ engineUp: await engineUp(), searches: await listSearches() });
}

export async function POST(req: Request) {
  const b = await req.json();
  const keywords = [...new Set<string>((Array.isArray(b.keywords) ? b.keywords : []).map((k: unknown) => String(k).trim()).filter(Boolean))];
  const area = String(b.area ?? "").trim();
  const gridN = Number(b.gridN);
  if (!keywords.length || !area) return NextResponse.json({ error: "Add a business type and an area." }, { status: 400 });
  if (!(GRID_LEVELS as readonly number[]).includes(gridN)) return NextResponse.json({ error: "Pick a coverage level." }, { status: 400 });
  if (!(await engineUp())) {
    return NextResponse.json({ error: "Scraper engine is not running. Start it with: docker compose up -d" }, { status: 503 });
  }
  const id = await createSearch({ keywords, area, gridN, findEmails: b.findEmails !== false });
  return NextResponse.json({ id }, { status: 201 });
}
