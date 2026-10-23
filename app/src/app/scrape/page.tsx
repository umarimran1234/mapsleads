"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileUpIcon, InfoIcon, PlayIcon, TriangleAlertIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/page-header";
import { useJobs } from "@/lib/use-jobs";

const PRESETS = ["dentists", "plumbers", "restaurants", "gyms", "roofing contractors", "real estate agents", "lawyers", "coffee shops"];

export default function ScrapePage() {
  const router = useRouter();
  const { engineUp } = useJobs();
  const [keywords, setKeywords] = useState("");
  const [city, setCity] = useState("");
  const [depth, setDepth] = useState(5);
  const [email, setEmail] = useState(true);
  const [busy, setBusy] = useState(false);

  const list = [...new Set(keywords.split(/\n|,/).map((k) => k.trim()).filter(Boolean))];
  const heavy = depth >= 15 || list.length >= 10;
  const add = (k: string) => setKeywords((v) => (list.includes(k) ? v : [v.trim(), k].filter(Boolean).join("\n")));

  async function loadFile(f?: File) {
    if (!f) return;
    const lines = (await f.text()).split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
    setKeywords((v) => [v.trim(), ...lines].filter(Boolean).join("\n"));
    toast.success(`Loaded ${lines.length} keywords`);
  }

  async function start(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await fetch("/api/jobs", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keywords: list, city, depth, email }),
    });
    const d = await r.json();
    setBusy(false);
    if (!r.ok) return toast.error(d.error);
    toast.success("Scrape started. Results will appear in Leads when it finishes.");
    router.push("/jobs");
  }

  return (
    <>
      <PageHeader title="New scrape" description="Pick business types and a city. The engine collects the listings and their contact details." />
      {engineUp === false && (
        <Alert variant="destructive" className="mb-6">
          <TriangleAlertIcon />
          <AlertTitle>Scraper engine is offline</AlertTitle>
          <AlertDescription>Start Docker Desktop, then run <code className="rounded bg-muted px-1">docker compose up -d</code>.</AlertDescription>
        </Alert>
      )}

      <form onSubmit={start} className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>What to search</CardTitle><CardDescription>One business type per line. The city is added to each search for you.</CardDescription></CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="kw">Business types</Label>
              <Textarea id="kw" rows={6} value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder={"dentists\nplumbers\nroofing contractors"} />
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="mr-1 text-xs text-muted-foreground">Quick add:</span>
                {PRESETS.map((p) => (
                  <button type="button" key={p} onClick={() => add(p)}>
                    <Badge variant="secondary" className="cursor-pointer hover:bg-accent">{p}</Badge>
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Denver, CO" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="file">Or load a keywords file</Label>
                <Label htmlFor="file" className="flex h-8 w-full cursor-pointer items-center gap-2 rounded-lg border border-dashed px-2.5 text-sm text-muted-foreground hover:bg-muted">
                  <FileUpIcon className="size-4" /> Choose .txt / .csv
                </Label>
                <input id="file" type="file" accept=".txt,.csv" hidden onChange={(e) => loadFile(e.target.files?.[0])} />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Options</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <div className="flex items-center justify-between"><Label htmlFor="depth">Depth</Label><span className="text-sm tabular-nums text-muted-foreground">{depth}</span></div>
                <input id="depth" type="range" min={1} max={30} value={depth} onChange={(e) => setDepth(Number(e.target.value))} className="w-full accent-primary" />
                <p className="text-xs text-muted-foreground">Higher means more results per keyword, but slower and more likely to be rate-limited. Start at 5.</p>
              </div>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Label htmlFor="email">Find emails</Label>
                  <p className="mt-1 text-xs text-muted-foreground">Visits each business website. Slower, but emails are the most valuable field.</p>
                </div>
                <Switch id="email" checked={email} onCheckedChange={setEmail} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3">
              <div className="text-sm">
                <div className="font-medium">Summary</div>
                <p className="mt-1 text-muted-foreground">
                  {list.length} keyword{list.length === 1 ? "" : "s"}{city.trim() ? <> in <b className="text-foreground">{city.trim()}</b></> : ""}, depth {depth}{email ? ", with emails" : ""}.
                </p>
              </div>
              {heavy && (
                <Alert>
                  <InfoIcon />
                  <AlertDescription>Large runs can get your IP temporarily rate-limited by Google. For big or repeated runs, use proxies.</AlertDescription>
                </Alert>
              )}
              <Button type="submit" className="w-full" disabled={busy || !list.length || !city.trim() || engineUp === false}>
                <PlayIcon /> {busy ? "Starting…" : "Start scrape"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </form>
    </>
  );
}
