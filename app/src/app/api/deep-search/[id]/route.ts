import { NextResponse } from "next/server";
import { cancelSearch, deleteSearch, searchEmails } from "@/lib/deep-search";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** All unique emails found by this search. */
export async function GET(_req: Request, { params }: Ctx) {
  return NextResponse.json({ emails: await searchEmails((await params).id) });
}

/** Body: { action: "cancel" } */
export async function POST(req: Request, { params }: Ctx) {
  const { action } = await req.json();
  if (action !== "cancel") return NextResponse.json({ error: "unknown action" }, { status: 400 });
  await cancelSearch((await params).id);
  return NextResponse.json({ ok: true });
}

/** ?leads=1 also deletes the leads this search found. */
export async function DELETE(req: Request, { params }: Ctx) {
  await deleteSearch((await params).id, new URL(req.url).searchParams.get("leads") === "1");
  return NextResponse.json({ ok: true });
}
