"use client";
import { useRef, useState } from "react";
import { MailSearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { runBatches } from "@/lib/batch";

type Res = { id: number; found: number };

/** Visits the websites of the given leads and saves any emails found. Progress is shown live. */
export function EnrichDialog({ ids, open, onClose, onDone }: { ids: number[]; open: boolean; onClose: () => void; onDone: () => void }) {
  const [state, setState] = useState<"idle" | "running" | "finished">("idle");
  const [done, setDone] = useState(0);
  const [withEmail, setWithEmail] = useState(0);
  const abort = useRef<AbortController | null>(null);

  async function start() {
    setState("running"); setDone(0); setWithEmail(0);
    abort.current = new AbortController();
    await runBatches<number, Res>(
      ids, 6,
      async (batch) => {
        const r = await fetch("/api/emails/enrich", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: batch }) });
        return (await r.json()).results ?? [];
      },
      (n, results) => { setDone(n); setWithEmail((w) => w + results.filter((x) => x.found > 0).length); },
      abort.current.signal,
    );
    setState("finished"); onDone();
  }

  function close() {
    abort.current?.abort();
    if (state !== "idle") onDone();
    setState("idle"); onClose();
  }

  const pct = ids.length ? Math.round((100 * done) / ids.length) : 0;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><MailSearchIcon className="size-4" /> Find missing emails</DialogTitle>
          <DialogDescription>
            Checks the homepage and contact/about pages of {ids.length} website{ids.length === 1 ? "" : "s"} for published email addresses, and picks up their Instagram, Facebook and LinkedIn links.
            About one in two to three sites publishes one; others use contact forms.
          </DialogDescription>
        </DialogHeader>
        {state !== "idle" && (
          <div className="space-y-2">
            <Progress value={pct} />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{done} / {ids.length} sites checked</span>
              <span className="text-foreground">{withEmail} with email</span>
            </div>
          </div>
        )}
        <DialogFooter>
          {state === "idle" && <Button onClick={start} disabled={!ids.length}>Start ({ids.length})</Button>}
          {state === "running" && <Button variant="outline" onClick={() => abort.current?.abort()}>Stop</Button>}
          {state === "finished" && <Button onClick={close}>Done</Button>}
          {state === "idle" && <Button variant="outline" onClick={close}>Cancel</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
