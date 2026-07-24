import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { trackedMus } from "@/db/schema";
import { requireActive, requireAdmin } from "@/lib/guards";
import {
  discoverCroatianMus,
  getMilitaryUnits,
  isConfigured,
  parseMuId
} from "@/lib/warera";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const auth = await requireActive();
  if ("error" in auth) return auth.error;

  const tracked = await db.select().from(trackedMus);
  const ids = tracked.map((t) => t.muId);

  // Env fallback: WARERA_MU_IDS=id1,id2
  const fromEnv = (process.env.WARERA_MU_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const allIds = [...new Set([...ids, ...fromEnv])];

  if (!allIds.length) {
    return NextResponse.json({
      units: [],
      configured: isConfigured(),
      message: "Nema pracenih jedinica. Admin ih dodaje u Sucelju."
    });
  }

  if (!isConfigured()) {
    return NextResponse.json({
      units: [],
      configured: false,
      message: "War Era API kljuc nije postavljen."
    });
  }

  try {
    const units = await getMilitaryUnits(allIds);
    units.sort((a, b) => (b.weeklyDamage ?? 0) - (a.weeklyDamage ?? 0));
    return NextResponse.json({ units, configured: true, fetchedAt: new Date().toISOString() });
  } catch {
    return NextResponse.json(
      { units: [], configured: true, error: "Greska u dohvatu jedinica." },
      { status: 502 }
    );
  }
}

// Admin: dodaj MU rucno ili { discover: true } za automatsko otkrivanje HR/KG jedinica
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  let body: { muIdOrUrl?: string; label?: string; discover?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Neispravan zahtjev." }, { status: 400 });
  }

  if (body.discover) {
    if (!isConfigured()) {
      return NextResponse.json({ error: "API kljuc nije postavljen." }, { status: 400 });
    }
    try {
      const found = await discoverCroatianMus();
      for (const mu of found) {
        await db
          .insert(trackedMus)
          .values({ muId: mu.id, label: mu.name, addedBy: "auto" })
          .onConflictDoNothing();
      }
      return NextResponse.json({
        ok: true,
        found: found.length,
        names: found.map((f) => f.name)
      });
    } catch {
      return NextResponse.json({ error: "Otkrivanje nije uspjelo." }, { status: 502 });
    }
  }

  const muId = parseMuId(body.muIdOrUrl ?? "");
  if (!muId) {
    return NextResponse.json(
      { error: "Unesi MU ID ili link (app.warera.io/mu/...)." },
      { status: 400 }
    );
  }

  await db
    .insert(trackedMus)
    .values({
      muId,
      label: body.label?.trim() || null,
      addedBy: auth.user.callsign
    })
    .onConflictDoNothing();

  return NextResponse.json({ ok: true, muId });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const muId = req.nextUrl.searchParams.get("muId");
  if (!muId) return NextResponse.json({ error: "Nedostaje muId." }, { status: 400 });
  await db.delete(trackedMus).where(eq(trackedMus.muId, muId));
  return NextResponse.json({ ok: true });
}
