import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { battleAssignments, trackedMus } from "@/db/schema";
import { requireActive, requireCommander } from "@/lib/guards";
import { newId } from "@/lib/ids";
import { notifyAllActive, notifyUsers } from "@/lib/notify";
import { resolveAppUserIdsForMu } from "@/lib/mu-resolve";
import { battleLink } from "@/lib/warera";

export const runtime = "nodejs";

// GET — sve dodjele (battleId -> jedinice) + popis pracenih jedinica za izbornik
export async function GET() {
  const auth = await requireActive();
  if ("error" in auth) return auth.error;

  const [rows, mus] = await Promise.all([
    db.select().from(battleAssignments),
    db.select({ muId: trackedMus.muId, label: trackedMus.label }).from(trackedMus)
  ]);

  const byBattle: Record<string, { muId: string; muName: string }[]> = {};
  for (const r of rows) {
    (byBattle[r.battleId] ??= []).push({ muId: r.muId, muName: r.muName });
  }

  return NextResponse.json({ assignments: byBattle, units: mus });
}

// POST { battleId, muId, muName, battleLabel? } — dodijeli jedinicu bitci + auto-ping
export async function POST(req: NextRequest) {
  const auth = await requireCommander();
  if ("error" in auth) return auth.error;

  let body: { battleId?: string; muId?: string; muName?: string; battleLabel?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Neispravan zahtjev." }, { status: 400 });
  }

  const battleId = (body.battleId ?? "").trim();
  const muId = (body.muId ?? "").trim();
  const muName = (body.muName ?? "").trim().slice(0, 80) || "Jedinica";
  const battleLabel = (body.battleLabel ?? "").trim().slice(0, 120);
  if (!battleId || !muId) {
    return NextResponse.json({ error: "Nedostaju podaci." }, { status: 400 });
  }

  const existing = await db
    .select({ id: battleAssignments.id })
    .from(battleAssignments)
    .where(and(eq(battleAssignments.battleId, battleId), eq(battleAssignments.muId, muId)))
    .limit(1);
  if (existing.length) return NextResponse.json({ ok: true });

  await db.insert(battleAssignments).values({
    id: newId(),
    battleId,
    muId,
    muName,
    userId: auth.user.id
  });

  const payload = {
    kind: "assign",
    title: `ORDER · ${muName} → bitka`,
    body: battleLabel
      ? `${auth.user.callsign} dodijelio ${muName} na: ${battleLabel}`
      : `${auth.user.callsign} dodijelio ${muName} na bitku`,
    link: battleLink(battleId),
    battleId
  };

  const targeted = await resolveAppUserIdsForMu(muId, auth.user.id);
  if (targeted.length) {
    await notifyUsers(targeted, payload);
  } else {
    await notifyAllActive(payload, auth.user.id);
  }

  return NextResponse.json({ ok: true, pinged: targeted.length || "all" });
}

// DELETE ?battleId=&muId=
export async function DELETE(req: NextRequest) {
  const auth = await requireCommander();
  if ("error" in auth) return auth.error;

  const battleId = req.nextUrl.searchParams.get("battleId");
  const muId = req.nextUrl.searchParams.get("muId");
  if (!battleId || !muId) {
    return NextResponse.json({ error: "Nedostaju podaci." }, { status: 400 });
  }

  await db
    .delete(battleAssignments)
    .where(and(eq(battleAssignments.battleId, battleId), eq(battleAssignments.muId, muId)));
  return NextResponse.json({ ok: true });
}
