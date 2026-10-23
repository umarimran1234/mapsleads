import { and, eq } from "drizzle-orm";
import { jobs, leads } from "@/db/schema";
import { db } from "./db";
import { parseCsv } from "./csv";
import { saveLeads } from "./leads";

const BASE = process.env.SCRAPER_BASE_URL || `http://localhost:${process.env.SCRAPER_PORT || "8080"}`;
const KEY = process.env.SCRAPER_API_KEY || "";
const UA = "google-maps-scraper-kit-app/0.1";

function engine(method: string, path: string, body?: unknown) {
  return fetch(BASE + path, {
    method,
    headers: { "Content-Type": "application/json", "User-Agent": UA, ...(KEY ? { "X-API-Key": KEY } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
    cache: "no-store",
  });
}

export const engineBase = () => BASE;

export async function engineUp() {
  try { return (await engine("GET", "/api/v1/jobs")).ok; } catch { return false; }
}

/** Nominatim (OpenStreetMap), free, ~1 request/sec. */
export async function geocode(place: string) {
  const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(place)}`,
    { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20_000) });
  const hits = (await res.json()) as { lat: string; lon: string }[];
  return hits[0] ? { lat: String(hits[0].lat), lon: String(hits[0].lon) } : null;
}

/** Like geocode, plus the area's bounding box [south, north, west, east]. */
export async function geocodeBox(place: string) {
  const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(place)}`,
    { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20_000) });
  const hits = (await res.json()) as { lat: string; lon: string; boundingbox?: string[]; display_name?: string }[];
  const h = hits[0];
  if (!h?.boundingbox) return null;
  return { bbox: h.boundingbox.map(Number) as [number, number, number, number], name: h.display_name ?? place };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Create one engine job (or resume `existingId`), wait for it, and return its CSV rows.
 * Throws if the engine reports failure, the wait runs out, or `shouldStop()` turns true.
 */
export async function runEngineJob(
  body: Record<string, unknown>,
  opts: { existingId?: string | null; onId?: (id: string) => Promise<void>; shouldStop?: () => Promise<boolean> } = {},
) {
  let id = opts.existingId ?? null;
  if (!id) {
    const res = await engine("POST", "/api/v1/jobs", body);
    if (!res.ok) throw new Error(`Engine rejected the job: HTTP ${res.status} ${(await res.text()).slice(0, 160)}`);
    id = ((await res.json()) as { id: string }).id;
    await opts.onId?.(id);
  }
  const deadline = Date.now() + (Number(body.max_time) || 600) * 1000 + 180_000;
  while (Date.now() < deadline) {
    if (await opts.shouldStop?.()) throw new Error("Stopped");
    const res = await engine("GET", `/api/v1/jobs/${id}`).catch(() => null); // engine briefly unreachable: keep waiting
    if (res?.status === 404) throw new Error("Job no longer exists in the engine");
    if (res?.ok) {
      const status = ((await res.json()) as { Status?: string }).Status;
      if (status === "failed") throw new Error("Engine reported failure (you may be rate-limited)");
      if (status === "ok") {
        const csv = await engine("GET", `/api/v1/jobs/${id}/download`);
        await engine("DELETE", `/api/v1/jobs/${id}`).catch(() => {}); // free engine disk; the rows are ours now
        return parseCsv(await csv.text());
      }
    }
    await sleep(6000);
  }
  throw new Error("Timed out waiting for the engine");
}

export type NewJob = { keywords: string[]; city: string; depth: number; email: boolean; maxTime: number };

export async function createJob(j: NewJob) {
  const geo = await geocode(j.city);
  if (!geo) throw new Error(`Could not find coordinates for "${j.city}". Try a clearer city name.`);
  const keywords = j.keywords.map((k) => (/\bin\b/i.test(k) ? k : `${k} in ${j.city}`));
  const res = await engine("POST", "/api/v1/jobs", {
    name: "leads-app", keywords, lang: "en", zoom: 15, lat: geo.lat, lon: geo.lon,
    fast_mode: false, radius: 10000, depth: j.depth, email: j.email, max_time: j.maxTime,
  });
  if (!res.ok) throw new Error(`Engine rejected the job: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  const { id } = (await res.json()) as { id: string };
  await (await db()).insert(jobs).values({
    id, name: keywords[0] + (keywords.length > 1 ? ` +${keywords.length - 1}` : ""),
    keywords, city: j.city, depth: j.depth, email: j.email,
  });
  return id;
}

/** Ask the engine about every running job; finished ones get their CSV pulled into the leads table. */
export async function refreshJobs() {
  const d = await db();
  const running = await d.select({ id: jobs.id }).from(jobs).where(eq(jobs.status, "running"));
  for (const { id } of running) {
    try {
      const res = await engine("GET", `/api/v1/jobs/${id}`);
      if (res.status === 404) { await finish(id, "failed", 0, "Job no longer exists in the engine."); continue; }
      if (!res.ok) continue;
      const status = ((await res.json()) as { Status?: string }).Status;
      if (status === "failed") await finish(id, "failed", 0, "Engine reported failure. You may be rate-limited: wait, lower depth or add proxies.");
      else if (status === "ok") {
        const csv = await engine("GET", `/api/v1/jobs/${id}/download`);
        const { added } = await saveLeads(parseCsv(await csv.text()), id);
        await finish(id, "done", added, null);
      }
    } catch { /* engine unreachable: leave the job running, try next poll */ }
  }
}

async function finish(id: string, status: "done" | "failed", leadCount: number, error: string | null) {
  await (await db()).update(jobs).set({ status, leadCount, error, finishedAt: new Date() })
    // Several pollers can see the same finished job; only the first to get here records it.
    .where(and(eq(jobs.id, id), eq(jobs.status, "running")));
}

export async function deleteJob(id: string, withLeads: boolean) {
  try { await engine("DELETE", `/api/v1/jobs/${id}`); } catch { /* engine may be down; still clean up locally */ }
  const d = await db();
  // leads.job_id is ON DELETE SET NULL, so deleting the job alone keeps its leads.
  if (withLeads) await d.delete(leads).where(eq(leads.jobId, id));
  await d.delete(jobs).where(eq(jobs.id, id));
}
