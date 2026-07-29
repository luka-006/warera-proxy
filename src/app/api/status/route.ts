import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { playerStatus, users } from "@/db/schema";
import { requireActive, isCommander } from "@/lib/guards";

export const runtime = "nodejs";

const CLICKABLE = ["spreman", "zauzet", "odsutan"];
const ALL_HEALTH = ["spreman", "zauzet", "debuff", "odsutan", "ozlijeden"];

function normalizeHealth(h: string | null | undefined): string {
  if (!h) return "spreman";
  if (h === "ozlijeden") return "debuff";
  return ALL_HEALTH.includes(h) ? h : "spreman";
}

export async function GET() {
  const auth = await requireActive();
  if ("error" in auth) return auth.error;

  const cmd = isCommander(auth.user.rank);

  const rows = await db
    .select({
      userId: users.id,
      callsign: users.callsign,
      rank: users.rank,
      avatarHue: users.avatarHue,
      health: playerStatus.health,
      updatedAt: playerStatus.updatedAt
    })
    .from(users)
    .leftJoin(playerStatus, eq(users.id, playerStatus.userId))
    .where(eq(users.status, "aktivan"));

  const statuses = rows
    .filter((r) => cmd || r.userId === auth.user.id)
    .map((r) => ({
      userId: r.userId,
      callsign: r.callsign,
      rank: r.rank,
      avatarHue: r.avatarHue,
      health: normalizeHealth(r.health),
      updatedAt: r.updatedAt
    }));

  return NextResponse.json({ statuses, canSeeRoster: cmd });
}

export async function POST(req: NextRequest) {
  const auth = await requireActive();
  if ("error" in auth) return auth.error;

  let body: { health?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Neispravan zahtjev." }, { status: 400 });
  }

  // Debuff nije clickable — app ga prikazuje samo zapovjednistvu
  const health = CLICKABLE.includes(body.health ?? "") ? (body.health as string) : "spreman";
  const now = new Date();
  await db
    .insert(playerStatus)
    .values({
      userId: auth.user.id,
      health,
      helpMsg: null,
      updatedAt: now
    })
    .onConflictDoUpdate({
      target: playerStatus.userId,
      set: { health, helpMsg: null, updatedAt: now }
    });

  return NextResponse.json({ ok: true, health });
}