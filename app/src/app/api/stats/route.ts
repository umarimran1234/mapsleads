import { NextResponse } from "next/server";
import { desc, sql } from "drizzle-orm";
import { jobs, leads } from "@/db/schema";
import { db } from "@/lib/db";
import { engineUp, refreshJobs } from "@/lib/engine";

export const dynamic = "force-dynamic";

const count = sql<number>`count(*)::int`;
const countIf = (cond: ReturnType<typeof sql>) => sql<number>`(count(*) filter (where ${cond}))::int`;

export async function GET(req: Request) {
  const up = await engineUp();
  if (up) await refreshJobs();
  const d = await db();

  // Day buckets are cut in the viewer's timezone so "today" matches their clock.
  const tzParam = new URL(req.url).searchParams.get("tz") || "UTC";
  const tz = /^[A-Za-z0-9_+\-/]+$/.test(tzParam) ? tzParam : "UTC";
  const day = sql<string>`to_char(${leads.createdAt} at time zone ${tz}, 'YYYY-MM-DD')`;

  const [[lt], [jt], perDay, statuses, categories, recentJobs] = await Promise.all([
    d.select({
      leads: count,
      withEmail: countIf(sql`${leads.emails} <> ''`),
      withPhone: countIf(sql`${leads.phone} <> ''`),
      withWebsite: countIf(sql`${leads.website} <> ''`),
    }).from(leads),
    d.select({
      jobs: count,
      running: countIf(sql`${jobs.status} = 'running'`),
      failed: countIf(sql`${jobs.status} = 'failed'`),
    }).from(jobs),
    d.select({ d: day, c: count }).from(leads)
      .where(sql`${leads.createdAt} >= now() - interval '31 days'`).groupBy(sql`1`), // by position: the tz parameter would otherwise differ between SELECT and GROUP BY
    d.select({ status: leads.status, c: count }).from(leads).groupBy(leads.status),
    d.select({ category: leads.category, c: count }).from(leads)
      .where(sql`${leads.category} <> ''`).groupBy(leads.category).orderBy(desc(count)).limit(6),
    d.select().from(jobs).orderBy(desc(jobs.createdAt)).limit(5),
  ]);

  // Last 30 days, zero-filled so the chart has no gaps
  const byDay = new Map(perDay.map((r) => [r.d, r.c]));
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
  const timeline = Array.from({ length: 30 }, (_, i) => {
    const key = fmt.format(new Date(Date.now() - (29 - i) * 86400_000));
    return { date: key, leads: byDay.get(key) ?? 0 };
  });

  return NextResponse.json({ engineUp: up, totals: { ...lt, ...jt }, timeline, statuses, categories, recentJobs });
}
