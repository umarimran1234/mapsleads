import { NextResponse } from "next/server";
import { and, eq, inArray, ne } from "drizzle-orm";
import { leads } from "@/db/schema";
import { db } from "@/lib/db";
import { findEmails } from "@/lib/email-extract";
import { cleanEmails } from "@/lib/leads";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Leads that have a website but no email yet. Optional ?job= limits it to one job. */
export async function GET(req: Request) {
  const job = new URL(req.url).searchParams.get("job");
  const rows = await (await db()).select({ id: leads.id }).from(leads)
    .where(and(eq(leads.emails, ""), ne(leads.website, ""), job ? eq(leads.jobId, job) : undefined));
  return NextResponse.json({ ids: rows.map((r) => r.id) });
}

/**
 * Body: { ids: number[] } (max 10 per call). Visits each lead's website and stores any emails and
 * Instagram / Facebook / LinkedIn profiles found. Existing values are kept; only empty social fields are filled.
 */
export async function POST(req: Request) {
  const { ids } = await req.json();
  const list = (Array.isArray(ids) ? ids : []).map(Number).filter(Number.isInteger).slice(0, 10);
  if (!list.length) return NextResponse.json({ error: "ids required" }, { status: 400 });
  const d = await db();
  const rows = await d.select().from(leads).where(inArray(leads.id, list));

  const results = await Promise.all(rows.map(async (r) => {
    if (!r.website) return { id: r.id, found: 0, socials: 0 };
    const site = await findEmails(r.website);
    const set: Partial<typeof leads.$inferInsert> = {};
    if (site.emails.length) set.emails = cleanEmails([r.emails, ...site.emails.map((e) => e.email)].join(","));
    for (const k of ["instagram", "facebook", "linkedin"] as const) if (!r[k] && site.socials[k]) set[k] = site.socials[k];
    if (Object.keys(set).length) await d.update(leads).set(set).where(eq(leads.id, r.id));
    return {
      id: r.id, found: site.emails.length, error: site.error,
      socials: Object.keys(set).filter((k) => k !== "emails").length,
    };
  }));
  return NextResponse.json({ results });
}
