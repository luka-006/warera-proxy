import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
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

  let body: { callsign?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Neispravan zahtjev." }, { status: 400 });
  }

  const callsign = normalizeCallsign(body.callsign ?? "");
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

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.callsign, callsign))
    .limit(1);
  if (existing[0]) {
    return NextResponse.json(
      { error: "Pozivni znak je vec zauzet." },
      { status: 409 }
    );
  }

  const { phrase } = generatePhrase();
  const phraseHash = await bcrypt.hash(phrase, 10);

  await db.insert(users).values({
    id: newId(),
    callsign,
    phraseHash,
    rank: "vojnik",
    status: "ceka"
  });

  // Frazu vracamo SAMO sada, jednom. Nikad se ne sprema u citljivom obliku.
  return NextResponse.json({ callsign, phrase });
}
