import { NextRequest, NextResponse } from "next/server";
import { requireActive } from "@/lib/guards";
import { isPushConfigured, removePushSubscription, savePushSubscription } from "@/lib/push";

export const runtime = "nodejs";

type SubBody = {
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
};

export async function POST(req: NextRequest) {
  const auth = await requireActive();
  if ("error" in auth) return auth.error;
  if (!isPushConfigured()) {
    return NextResponse.json({ error: "Push nije konfiguriran na serveru." }, { status: 503 });
  }

  let body: SubBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Neispravan zahtjev." }, { status: 400 });
  }

  const endpoint = body.endpoint?.trim();
  const p256dh = body.keys?.p256dh?.trim();
  const authKey = body.keys?.auth?.trim();
  if (!endpoint || !p256dh || !authKey) {
    return NextResponse.json({ error: "Nepotpuna pretplata." }, { status: 400 });
  }

  await savePushSubscription(auth.user.id, {
    endpoint,
    keys: { p256dh, auth: authKey }
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireActive();
  if ("error" in auth) return auth.error;
  const endpoint = req.nextUrl.searchParams.get("endpoint");
  if (!endpoint) {
    return NextResponse.json({ error: "Nedostaje endpoint." }, { status: 400 });
  }
  await removePushSubscription(endpoint);
  return NextResponse.json({ ok: true });
}