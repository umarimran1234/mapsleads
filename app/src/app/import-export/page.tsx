"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { DownloadIcon, FileJsonIcon, FileSpreadsheetIcon, UploadCloudIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { cn } from "@/lib/utils";

export default function ImportExportPage() {
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ name: string; added: number; skipped: number; total: number } | null>(null);

  async function upload(f?: File) {
    if (!f) return;
    setBusy(true); setResult(null);
    const fd = new FormData(); fd.append("file", f);
    const r = await fetch("/api/import", { method: "POST", body: fd });
    const d = await r.json();
    setBusy(false);
    if (input.current) input.current.value = "";
    if (!r.ok) return toast.error(d.error);
    setResult({ name: f.name, ...d });
    toast.success(`Imported ${d.added} new leads`);
  }

  return (
    <>
      <PageHeader title="Import / Export" description="Move leads in and out as CSV or JSON." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Import leads</CardTitle>
            <CardDescription>Upload a CSV or JSON file. Duplicates (same name and address) are skipped, so re-importing is safe.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => { e.preventDefault(); setDrag(false); upload(e.dataTransfer.files[0]); }}
              onClick={() => input.current?.click()}
              className={cn("flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors hover:bg-muted/50", drag && "border-primary bg-accent")}
            >
              <UploadCloudIcon className="size-8 text-muted-foreground" />
              <div className="text-sm font-medium">{busy ? "Importing…" : "Drop a file here or click to browse"}</div>
              <div className="text-xs text-muted-foreground">.csv or .json</div>
              <input ref={input} type="file" accept=".csv,.json" hidden onChange={(e) => upload(e.target.files?.[0])} />
            </div>
            {result && (
              <div className="rounded-lg border bg-muted/40 p-4 text-sm">
                <div className="font-medium">{result.name}</div>
                <div className="mt-1 text-muted-foreground">
                  {result.added} added · {result.skipped} skipped (duplicates or empty) · {result.total} rows read
                </div>
                <Button nativeButton={false} variant="link" className="mt-1 h-auto p-0" render={<Link href="/leads" />}>View leads</Button>
              </div>
            )}
            <div className="text-xs text-muted-foreground">
              Recognised columns: <code>title</code> or <code>name</code>, <code>phone</code>, <code>emails</code> or <code>email</code>, <code>website</code>, <code>category</code>, <code>address</code>, <code>review_rating</code> or <code>rating</code>, <code>review_count</code> or <code>reviews</code>. Files from this kit&apos;s CLI and the raw engine CSV work as they are.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Export leads</CardTitle>
            <CardDescription>Download everything you have collected, including status and notes. To export only some leads, filter on the Leads page and export from there.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <a href="/api/export?format=csv" className="group flex flex-col gap-3 rounded-xl border p-4 transition-colors hover:bg-muted/50">
              <FileSpreadsheetIcon className="size-8 text-emerald-500" />
              <div><div className="font-medium">CSV</div><div className="text-xs text-muted-foreground">Opens in Excel and Google Sheets</div></div>
              <span className="inline-flex items-center gap-1 text-sm text-primary"><DownloadIcon className="size-4" /> Download</span>
            </a>
            <a href="/api/export?format=json" className="group flex flex-col gap-3 rounded-xl border p-4 transition-colors hover:bg-muted/50">
              <FileJsonIcon className="size-8 text-amber-500" />
              <div><div className="font-medium">JSON</div><div className="text-xs text-muted-foreground">For scripts and other tools</div></div>
              <span className="inline-flex items-center gap-1 text-sm text-primary"><DownloadIcon className="size-4" /> Download</span>
            </a>
          </CardContent>
        </Card>
      </div>
      <p className="mt-6 text-xs text-muted-foreground">
        Scraped emails and phone numbers are personal data. If you store or contact them, follow GDPR, CCPA and CAN-SPAM, and keep an opt-out list.
      </p>
    </>
  );
}
