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
  const rl = rateLimit(`setpw:${ip}`, 6, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Previse pokusaja." }, { status: 429 });
  }

  let body: { callsign?: string; phrase?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Neispravan zahtjev." }, { status: 400 });
  }

  const callsign = normalizeCallsign(body.callsign ?? "");
  const phrase = body.phrase ?? "";
  const password = body.password ?? "";

  if (password.length < 8) {
    return NextResponse.json(
      { error: "Lozinka mora imati najmanje 8 znakova." },
      { status: 400 }
    );
  }

  const rows = await db.select().from(users).where(eq(users.callsign, callsign)).limit(1);
  const user = rows[0];

  if (!user || !user.phraseHash) {
    return NextResponse.json(
      { error: "Fraza vise nije valjana. Prijavite se lozinkom." },
      { status: 400 }
    );
  }

  const okPhrase = await bcrypt.compare(phrase, user.phraseHash);
  if (!okPhrase) {
    return NextResponse.json({ error: "Neispravna jednokratna fraza." }, { status: 401 });
  }

  if (user.status !== "aktivan") {
    return NextResponse.json(
      { error: "Racun ceka odobrenje administratora." },
      { status: 403 }
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);

  // Postavljamo lozinku i ponistavamo jednokratnu frazu
  await db
    .update(users)
    .set({ passwordHash, phraseHash: null, lastLoginAt: new Date() })
    .where(eq(users.id, user.id));

  await createSession(user.id);

  return NextResponse.json({ ok: true });
}
