"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { DatabaseIcon, ServerIcon, ShieldAlertIcon } from "lucide-react";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/page-header";
import { bytes } from "@/lib/format";

type Info = { engineUrl: string; engineUp: boolean; dbUrl: string; dbBytes: number };

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b py-3 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="min-w-0 break-all text-sm">{children}</span>
    </div>
  );
}

export default function SettingsPage() {
  const [info, setInfo] = useState<Info | null>(null);
  const [wipe, setWipe] = useState<"leads" | "jobs" | null>(null);

  const load = () => fetch("/api/settings", { cache: "no-store" }).then((r) => r.json()).then(setInfo);
  useEffect(() => { load(); }, []);

  async function confirmWipe() {
    if (!wipe) return;
    await fetch(`/api/settings?what=${wipe}`, { method: "DELETE" });
    toast.success(wipe === "leads" ? "All leads deleted" : "Job history cleared");
    setWipe(null); load();
  }

  return (
    <>
      <PageHeader title="Settings" description="Engine connection, storage and data management." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ServerIcon className="size-4" /> Scraper engine</CardTitle>
            <CardDescription>The Docker container this app sends scrape jobs to.</CardDescription>
          </CardHeader>
          <CardContent>
            {!info ? <Skeleton className="h-24" /> : (
              <>
                <Row label="Status">
                  {info.engineUp
                    ? <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">Online</Badge>
                    : <Badge variant="outline" className="border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400">Offline</Badge>}
                </Row>
                <Row label="Address"><code>{info.engineUrl}</code></Row>
                {!info.engineUp && <p className="pt-3 text-xs text-muted-foreground">Start Docker Desktop, then run <code>docker compose up -d</code> in the kit folder. To use another address, set <code>SCRAPER_BASE_URL</code> or <code>SCRAPER_PORT</code> in the kit&apos;s <code>.env</code>.</p>}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><DatabaseIcon className="size-4" /> Storage</CardTitle>
            <CardDescription>Everything stays on this computer.</CardDescription>
          </CardHeader>
          <CardContent>
            {!info ? <Skeleton className="h-24" /> : (
              <>
                <Row label="Database (PostgreSQL)"><code className="text-xs">{info.dbUrl}</code></Row>
                <Row label="Size">{bytes(info.dbBytes)}</Row>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-destructive/40 lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive"><ShieldAlertIcon className="size-4" /> Danger zone</CardTitle>
            <CardDescription>These actions cannot be undone. Export your leads first if you need a copy.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
              <div><div className="text-sm font-medium">Clear job history</div><div className="text-xs text-muted-foreground">Removes the jobs list. Your leads are kept.</div></div>
              <Button variant="outline" onClick={() => setWipe("jobs")}>Clear jobs</Button>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/30 p-3">
              <div><div className="text-sm font-medium">Delete all leads</div><div className="text-xs text-muted-foreground">Empties the leads database.</div></div>
              <Button variant="destructive" onClick={() => setWipe("leads")}>Delete all leads</Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={!!wipe} onOpenChange={(o) => !o && setWipe(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{wipe === "leads" ? "Delete every lead?" : "Clear job history?"}</AlertDialogTitle>
            <AlertDialogDescription>{wipe === "leads" ? "All leads, statuses and notes will be permanently removed." : "Job records will be removed. Leads stay, but are no longer linked to a job."}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button variant="destructive" onClick={confirmWipe}>Confirm</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
