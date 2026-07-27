import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { invites, users } from "@/db/schema";
import { newId } from "@/lib/ids";
import { generatePhrase, normalizeCallsign } from "@/lib/phrase";
import { rateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "local";
  const rl = rateLimit(`register:${ip}`, 5, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Previse pokusaja. Pricekajte minutu." },
      { status: 429 }
    );
  }

  let body: { callsign?: string; inviteCode?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Neispravan zahtjev." }, { status: 400 });
  }

  const callsign = normalizeCallsign(body.callsign ?? "");
  const inviteCode = (body.inviteCode ?? "").trim().toUpperCase();

  if (callsign.length < 3 || callsign.length > 24) {
    return NextResponse.json(
      { error: "Pozivni znak mora imati 3-24 znaka." },
      { status: 400 }
    );
  }
  if (!/^[a-z0-9._-]+$/.test(callsign)) {
    return NextResponse.json(
      { error: "Dozvoljena su mala slova, brojevi, . _ -" },
      { status: 400 }
    );
  }
  if (!inviteCode) {
    return NextResponse.json(
      { error: "Potreban je jednokratni kod od administratora (Discord)." },
      { status: 400 }
    );
  }

  // Jedinstveni, neiskoristen, neistekao kod
  const invRows = await db
    .select()
    .from(invites)
    .where(and(eq(invites.code, inviteCode), isNull(invites.usedBy)))
    .limit(1);
  const inv = invRows[0];
  if (!inv) {
    return NextResponse.json({ error: "Kod nije vazeci ili je vec iskoristen." }, { status: 400 });
  }
  if (inv.expiresAt.getTime() < Date.now()) {
    return NextResponse.json({ error: "Kod je istekao. Zatrazi novi od admina." }, { status: 400 });
  }
  // Ako je kod vezan za konkretan pozivni znak — mora se poklapati
  if (inv.intendedCallsign && inv.intendedCallsign !== callsign) {
    return NextResponse.json(
      { error: "Ovaj kod je izdan za drugi pozivni znak." },
      { status: 400 }
    );
  }

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.callsign, callsign))
    .limit(1);
  if (existing[0]) {
    return NextResponse.json({ error: "Pozivni znak je vec zauzet." }, { status: 409 });
  }

  const { phrase } = generatePhrase();
  const phraseHash = await bcrypt.hash(phrase, 10);
  const userId = newId();
  const hue = Math.floor(Math.random() * 360);

  await db.insert(users).values({
    id: userId,
    callsign,
    phraseHash,
    rank: "vojnik",
    status: "ceka",
    avatarHue: hue
  });

  // Spali kod — jednokratno
  await db
    .update(invites)
    .set({ usedBy: callsign, usedAt: new Date() })
    .where(eq(invites.id, inv.id));

  return NextResponse.json({ callsign, phrase });
}
