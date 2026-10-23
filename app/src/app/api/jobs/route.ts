import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { jobs } from "@/db/schema";
import { db } from "@/lib/db";
import { listSearches, resumeAll } from "@/lib/deep-search";
import { createJob, deleteJob, engineUp, refreshJobs } from "@/lib/engine";

export const dynamic = "force-dynamic";

export async function GET() {
  const up = await engineUp();
  if (up) await refreshJobs();
  await resumeAll(); // no-op unless the server restarted mid-search
  const rows = await (await db()).select().from(jobs).orderBy(desc(jobs.createdAt)).limit(100);
  return NextResponse.json({ engineUp: up, jobs: rows, searches: await listSearches() });
}

export async function POST(req: Request) {
  const b = await req.json();
  const keywords = (Array.isArray(b.keywords) ? b.keywords : [])
    .map((k: unknown) => String(k).trim()).filter(Boolean);
  const city = String(b.city ?? "").trim();
  if (!keywords.length || !city) {
    return NextResponse.json({ error: "Add at least one keyword and a city." }, { status: 400 });
  }
  if (!(await engineUp())) {
    return NextResponse.json({ error: "Scraper engine is not running. Start it with: docker compose up -d" }, { status: 503 });
  }
  try {
    const id = await createJob({
      keywords: [...new Set<string>(keywords)], city,
      depth: Math.min(Math.max(Number(b.depth) || 5, 1), 50),
      email: b.email !== false,
      maxTime: Math.min(Math.max(Number(b.maxTime) || 600, 60), 7200),
    });
    return NextResponse.json({ id }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}

export async function DELETE(req: Request) {
  const p = new URL(req.url).searchParams;
  const id = p.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await deleteJob(id, p.get("leads") === "1");
  return NextResponse.json({ ok: true });
}
