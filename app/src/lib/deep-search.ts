import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray, ne, sql } from "drizzle-orm";
import { leads, searchTiles, searches } from "@/db/schema";
import { db, pgPool } from "./db";
import { findEmails } from "./email-extract";
import { geocodeBox, runEngineJob } from "./engine";
import { gridCells, inBbox, type Bbox } from "./grid";
import { cleanEmails, saveLeads } from "./leads";

export const GRID_LEVELS = [3, 5, 7] as const;
const TILE_DEPTH = 10;
const TILE_MAX_TIME = 600;

// Live runners, kept on globalThis so Next's dev reloads don't lose track of them.
const g = globalThis as unknown as { __deepRunning?: Set<string> };
const running = (g.__deepRunning ??= new Set<string>());

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function createSearch(input: { keywords: string[]; area: string; gridN: number; findEmails: boolean }) {
  const id = randomUUID();
  await (await db()).insert(searches).values({
    id, keywords: input.keywords, area: input.area, gridN: input.gridN, depth: TILE_DEPTH, findEmails: input.findEmails,
  });
  start(id);
  return id;
}

/**
 * Start the background runner for a search unless one is already running.
 * The in-memory set stops a second runner inside this process; a Postgres advisory lock stops one in
 * another process (for example `next dev` and `next start` on the same database). The lock belongs to
 * a connection, so if the process holding it dies, the database frees it and another process can resume.
 */
export function start(id: string) {
  if (running.has(id)) return;
  running.add(id);
  (async () => {
    const lock = await pgPool().connect();
    try {
      const { rows } = await lock.query<{ ok: boolean }>("select pg_try_advisory_lock(hashtext($1)) as ok", [id]);
      if (!rows[0].ok) return; // another process is already running this search
      try {
        await run(id);
      } finally {
        await lock.query("select pg_advisory_unlock(hashtext($1))", [id]); // pooled connections keep session locks
      }
    } finally {
      lock.release();
    }
  })()
    .catch(async (e: Error) => {
      if (e.message === "Stopped") return;
      await patch(id, { status: "failed", error: e.message, finishedAt: new Date() });
    })
    .finally(() => running.delete(id));
}

/** After a server restart, searches still marked running have no runner: pick them back up. */
export async function resumeAll() {
  const rows = await (await db()).select({ id: searches.id }).from(searches).where(eq(searches.status, "running"));
  for (const r of rows) start(r.id);
}

export async function cancelSearch(id: string) {
  await (await db()).update(searches).set({ status: "cancelled", finishedAt: new Date() })
    .where(and(eq(searches.id, id), eq(searches.status, "running")));
}

export async function deleteSearch(id: string, withLeads: boolean) {
  const d = await db();
  await cancelSearch(id);
  if (withLeads) await d.delete(leads).where(eq(leads.searchId, id));
  await d.delete(searches).where(eq(searches.id, id)); // tiles cascade; leads.search_id is SET NULL
}

async function patch(id: string, set: Partial<typeof searches.$inferInsert>) {
  await (await db()).update(searches).set(set).where(eq(searches.id, id));
}

async function isStopped(id: string) {
  const [s] = await (await db()).select({ status: searches.status }).from(searches).where(eq(searches.id, id));
  return !s || s.status !== "running";
}

async function run(id: string) {
  const d = await db();
  let [s] = await d.select().from(searches).where(eq(searches.id, id));
  if (!s || s.status !== "running") return;

  // 1. Turn the area into map tiles (only the first time; a resumed search keeps its tiles).
  if (!s.bbox) {
    const geo = await geocodeBox(s.area);
    if (!geo) throw new Error(`Could not find "${s.area}" on the map. Try a clearer area name, like "London, UK".`);
    const cells = gridCells(geo.bbox, s.gridN);
    await d.insert(searchTiles).values(cells.map((c, idx) => ({ searchId: id, idx, ...c })));
    await patch(id, { bbox: geo.bbox, tilesTotal: cells.length, phase: "scanning" });
    [s] = await d.select().from(searches).where(eq(searches.id, id));
  }
  const bbox = s.bbox as Bbox;

  // 2. Scan tiles one at a time (never parallel jobs against Google).
  if (s.phase === "scanning") {
    const keywords = s.keywords.map((k) => (/\bin\b/i.test(k) ? k : `${k} in ${s.area}`));
    const tiles = await d.select().from(searchTiles)
      .where(and(eq(searchTiles.searchId, id), inArray(searchTiles.status, ["pending", "running"])))
      .orderBy(asc(searchTiles.idx));

    for (const t of tiles) {
      if (await isStopped(id)) return;
      await d.update(searchTiles).set({ status: "running" }).where(eq(searchTiles.id, t.id));
      let error: string | null = null, kept = 0;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const rows = await runEngineJob(
            { name: "deep-search", keywords, lang: "en", zoom: t.zoom, lat: t.lat, lon: t.lon, radius: t.radius,
              fast_mode: false, depth: s.depth, email: false, max_time: TILE_MAX_TIME },
            {
              existingId: attempt === 0 ? t.engineJobId : null,
              onId: (jobId) => d.update(searchTiles).set({ engineJobId: jobId }).where(eq(searchTiles.id, t.id)).then(() => {}),
              shouldStop: () => isStopped(id),
            },
          );
          const inside = rows.filter((r) => inBbox(r.latitude, r.longitude, bbox));
          await saveLeads(inside, null, id);
          kept = inside.length; error = null;
          break;
        } catch (e) {
          if ((e as Error).message === "Stopped") return;
          error = (e as Error).message;
        }
      }
      await d.update(searchTiles).set({ status: error ? "failed" : "done", rows: kept, error, engineJobId: null })
        .where(eq(searchTiles.id, t.id));
      // Counted from the tiles themselves, so the numbers can never drift past the total.
      const [{ n }] = await d.select({ n: sql<number>`count(*)::int` }).from(leads).where(eq(leads.searchId, id));
      const [c] = await d.select({
        done: sql<number>`(count(*) filter (where ${searchTiles.status} in ('done', 'failed')))::int`,
        failed: sql<number>`(count(*) filter (where ${searchTiles.status} = 'failed'))::int`,
      }).from(searchTiles).where(eq(searchTiles.searchId, id));
      await patch(id, { found: n, tilesDone: c.done, tilesFailed: c.failed });
      await sleep(3000);
    }

    const [after] = await d.select().from(searches).where(eq(searches.id, id));
    if (after.tilesFailed >= after.tilesTotal) {
      throw new Error("Every tile failed. You may be rate-limited by Google: wait a while, or use proxies.");
    }
    await patch(id, { phase: s.findEmails ? "emails" : "done" });
    s = after;
  }

  // 3. Deep email pass over every website found.
  if (s.findEmails && (s.phase === "emails" || s.phase === "scanning")) {
    await patch(id, { phase: "emails" });
    const todo = await d.select({ id: leads.id, website: leads.website, emails: leads.emails }).from(leads)
      .where(and(eq(leads.searchId, id), ne(leads.website, ""), eq(leads.emails, "")));
    await patch(id, { sitesTotal: todo.length, sitesChecked: 0 });

    let next = 0;
    const worker = async () => {
      for (;;) {
        // Claim the next lead before any await: with 8 workers, checking the length first and claiming
        // after an await let several workers run past the end of the list.
        const lead = todo[next++];
        if (!lead) return;
        if (await isStopped(id)) return;
        const site = await findEmails(lead.website);
        const found = { ...site.socials, ...(site.emails.length ? { emails: cleanEmails(site.emails.map((e) => e.email).join(",")) } : {}) };
        if (found.emails || found.instagram || found.facebook || found.linkedin) {
          await d.update(leads).set(found).where(eq(leads.id, lead.id));
        }
        await patch(id, { sitesChecked: sql`${searches.sitesChecked} + 1` as never });
      }
    };
    await Promise.all(Array.from({ length: 8 }, worker));
    if (await isStopped(id)) return;
  }

  await patch(id, { status: "done", phase: "done", finishedAt: new Date() });
}

/** Searches with live numbers for the UI. */
export async function listSearches() {
  const d = await db();
  const rows = await d.select().from(searches).orderBy(sql`${searches.createdAt} desc`).limit(20);
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const stats = await d.select({
    searchId: leads.searchId,
    leads: sql<number>`count(*)::int`,
    withWebsite: sql<number>`(count(*) filter (where ${leads.website} <> ''))::int`,
    withEmail: sql<number>`(count(*) filter (where ${leads.emails} <> ''))::int`,
  }).from(leads).where(inArray(leads.searchId, ids)).groupBy(leads.searchId);
  const emailRows = await d.select({ searchId: leads.searchId, emails: leads.emails }).from(leads)
    .where(and(inArray(leads.searchId, ids), ne(leads.emails, "")));
  const unique = new Map<string, Set<string>>();
  for (const r of emailRows) {
    const set = unique.get(r.searchId!) ?? new Set<string>();
    r.emails.split(", ").forEach((e) => set.add(e));
    unique.set(r.searchId!, set);
  }
  return rows.map((r) => {
    const st = stats.find((x) => x.searchId === r.id);
    return { ...r, leads: st?.leads ?? 0, withWebsite: st?.withWebsite ?? 0, withEmail: st?.withEmail ?? 0, uniqueEmails: unique.get(r.id)?.size ?? 0 };
  });
}

export async function searchEmails(id: string) {
  const rows = await (await db()).select({ emails: leads.emails }).from(leads)
    .where(and(eq(leads.searchId, id), ne(leads.emails, "")));
  return [...new Set(rows.flatMap((r) => r.emails.split(", ")))].sort();
}
