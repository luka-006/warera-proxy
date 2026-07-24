import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { normalizeCallsign } from "@/lib/phrase";
import { createSession } from "@/lib/session";
import { rateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "local";

  let body: { callsign?: string; secret?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Neispravan zahtjev." }, { status: 400 });
  }

  const callsign = normalizeCallsign(body.callsign ?? "");
  const secret = body.secret ?? "";

  const rl = rateLimit(`login:${ip}:${callsign}`, 8, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Previse pokusaja. Pricekajte minutu." },
      { status: 429 }
    );
  }

  if (!callsign || !secret) {
    return NextResponse.json(
      { error: "Unesite pozivni znak i lozinku/frazu." },
      { status: 400 }
    );
  }

  const rows = await db.select().from(users).where(eq(users.callsign, callsign)).limit(1);
  const user = rows[0];

  // Konstantno-vremenska obrana: uvijek radimo hash usporedbu
  const dummy = "$2a$10$abcdefghijklmnopqrstuu";

  if (!user) {
    await bcrypt.compare(secret, dummy);
    return NextResponse.json(
      { error: "Neispravan pozivni znak ili lozinka." },
      { status: 401 }
    );
  }

  if (user.status === "blokiran") {
    return NextResponse.json({ error: "Racun je blokiran." }, { status: 403 });
  }

  // Ako korisnik jos nije postavio trajnu lozinku -> provjeri jednokratnu frazu
  if (!user.passwordHash) {
    const okPhrase = user.phraseHash
      ? await bcrypt.compare(secret, user.phraseHash)
      : false;
    if (!okPhrase) {
      return NextResponse.json(
        { error: "Neispravna jednokratna fraza." },
        { status: 401 }
      );
    }
    if (user.status !== "aktivan") {
      return NextResponse.json(
        { error: "Racun ceka odobrenje administratora." },
        { status: 403 }
      );
    }
    // Fraza tocna -> trazi postavljanje lozinke (bez sesije jos)
    return NextResponse.json({ mustSetPassword: true, callsign });
  }

  const okPw = await bcrypt.compare(secret, user.passwordHash);
  if (!okPw) {
    return NextResponse.json(
      { error: "Neispravan pozivni znak ili lozinka." },
      { status: 401 }
    );
  }

  if (user.status !== "aktivan") {
    return NextResponse.json(
      { error: "Racun ceka odobrenje administratora." },
      { status: 403 }
    );
  }

  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
  await createSession(user.id);

  return NextResponse.json({ ok: true });
}
