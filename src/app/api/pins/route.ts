import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { battlePins } from "@/db/schema";
import { requireActive, requireCommander } from "@/lib/guards";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireActive();
  if ("error" in auth) return auth.error;

  const pins = await db.select().from(battlePins).orderBy(desc(battlePins.weight));
  return NextResponse.json({ pins });
}

// POST { battleId, battleLabel?, weight? } — oznaci prioritet
export async function POST(req: NextRequest) {
  const auth = await requireCommander();
  if ("error" in auth) return auth.error;

  let body: { battleId?: string; battleLabel?: string; weight?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Neispravan zahtjev." }, { status: 400 });
  }

  const battleId = (body.battleId ?? "").trim();
  if (!battleId) return NextResponse.json({ error: "Nedostaje bitka." }, { status: 400 });
  const weight = Math.min(3, Math.max(1, Number(body.weight) || 2));

  await db
    .insert(battlePins)
    .values({
      battleId,
      battleLabel: body.battleLabel ?? null,
      weight,
      userId: auth.user.id
    })
    .onConflictDoUpdate({
      target: battlePins.battleId,
      set: {
        weight,
        battleLabel: body.battleLabel ?? null,
        userId: auth.user.id
      }
    });

  return NextResponse.json({ ok: true });
}

// DELETE ?battleId=
export async function DELETE(req: NextRequest) {
  const auth = await requireCommander();
  if ("error" in auth) return auth.error;

  const battleId = req.nextUrl.searchParams.get("battleId");
  if (!battleId) return NextResponse.json({ error: "Nedostaje id." }, { status: 400 });

  await db.delete(battlePins).where(eq(battlePins.battleId, battleId));
  return NextResponse.json({ ok: true });
}
