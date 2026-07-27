import { NextRequest, NextResponse } from "next/server";
import { requireActive } from "@/lib/guards";
import { notifyAllActive } from "@/lib/notify";
import { battleLink } from "@/lib/warera";
import { rateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const auth = await requireActive();
  if ("error" in auth) return auth.error;

  const rl = rateLimit(`ping:${auth.user.id}`, 4, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Pricekaj minutu prije sljedeceg pinga." }, { status: 429 });
  }

  let body: { battleId?: string; battleLabel?: string; message?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Neispravan zahtjev." }, { status: 400 });
  }

  const battleId = (body.battleId ?? "").trim();
  const label = (body.battleLabel ?? "Bitka").trim().slice(0, 120);
  if (!battleId) {
    return NextResponse.json({ error: "Nedostaje bitka." }, { status: 400 });
  }

  const note = (body.message ?? "").trim().slice(0, 200);
  await notifyAllActive(
    {
      kind: "ping",
      title: "PING · " + label,
      body: note || (auth.user.callsign + " zove na bitku"),
      link: battleLink(battleId),
      battleId
    },
    auth.user.id
  );

  return NextResponse.json({ ok: true });
}