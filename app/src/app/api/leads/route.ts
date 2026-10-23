import { NextResponse } from "next/server";
import { desc, inArray, sql } from "drizzle-orm";
import { jobs, leads } from "@/db/schema";
import { db } from "@/lib/db";
import { STATUSES, filterFromParams, queryLeads } from "@/lib/leads";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const f = filterFromParams(new URL(req.url).searchParams);
  const d = await db();
  const [out, jobRows, counts] = await Promise.all([
    queryLeads(f),
    d.select({ id: jobs.id, name: jobs.name, city: jobs.city }).from(jobs).orderBy(desc(jobs.createdAt)),
    d.select({ status: leads.status, c: sql<number>`count(*)::int` }).from(leads).groupBy(leads.status),
  ]);
  return NextResponse.json({ ...out, jobs: jobRows, counts });
}

const idList = (ids: unknown) =>
  (Array.isArray(ids) ? ids : []).map(Number).filter((n) => Number.isInteger(n));

/** Body: { ids, status? , notes? }. Bulk status change, or notes for a single lead. */
export async function PATCH(req: Request) {
  const b = await req.json();
  const ids = idList(b.ids);
  if (!ids.length) return NextResponse.json({ error: "ids required" }, { status: 400 });
  const set: { status?: (typeof STATUSES)[number]; notes?: string } = {};
  if (b.status !== undefined) {
    if (!(STATUSES as readonly string[]).includes(b.status)) {
      return NextResponse.json({ error: "bad status" }, { status: 400 });
    }
    set.status = b.status;
  }
  if (b.notes !== undefined) set.notes = String(b.notes);
  if (Object.keys(set).length) await (await db()).update(leads).set(set).where(inArray(leads.id, ids));
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const ids = idList((await req.json()).ids);
  if (!ids.length) return NextResponse.json({ error: "ids required" }, { status: 400 });
  await (await db()).delete(leads).where(inArray(leads.id, ids));
  return NextResponse.json({ ok: true, deleted: ids.length });
}
