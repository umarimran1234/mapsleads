"use client";
import { useCallback, useEffect, useState } from "react";
import type { DeepSearch, Job } from "./types";

/**
 * Loads quick-scrape jobs and deep searches, and keeps polling every 5s while any is running
 * (the API pulls finished quick-scrape results into the DB).
 */
export function useJobs() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [searches, setSearches] = useState<DeepSearch[]>([]);
  const [engineUp, setEngineUp] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      const d = await (await fetch("/api/jobs", { cache: "no-store" })).json();
      setJobs(d.jobs); setSearches(d.searches ?? []); setEngineUp(d.engineUp);
    } catch { setEngineUp(false); }
    setLoading(false);
  }, []);

  const running = jobs.filter((j) => j.status === "running").length + searches.filter((s) => s.status === "running").length;
  useEffect(() => { reload(); }, [reload]);
  useEffect(() => {
    if (!running) return;
    const t = setInterval(reload, 5000);
    return () => clearInterval(t);
  }, [running, reload]);

  return { jobs, searches, running, engineUp, loading, reload };
}
