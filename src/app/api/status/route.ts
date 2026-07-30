import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { playerStatus, users } from "@/db/schema";
import { requireActive, isCommander } from "@/lib/guards";
import { modeLabel, normalizeMode, PLAYER_MODES, setPlayerMode, type PlayerMode } from "@/lib/player-mode";
import { getLiveHealthBatch, isConfigured } from "@/lib/warera";

export const runtime = "nodejs";

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

  const visible = rows.filter((r) => cmd || r.userId === auth.user.id);
  const callsigns = visible.map((r) => r.callsign);
  const liveMap = isConfigured()
    ? await getLiveHealthBatch(callsigns)
    : new Map<string, null>();

  const statuses = visible.map((r) => {
    const mode = normalizeMode(r.health);
    const live = liveMap.get(r.callsign) ?? null;
    return {
      userId: r.userId,
      callsign: r.callsign,
      rank: r.rank,
      avatarHue: r.avatarHue,
      mode,
      modeLabel: modeLabel(mode),
      liveHealth: live,
      updatedAt: r.updatedAt
    };
  });

  return NextResponse.json({
    statuses,
    canSeeRoster: cmd,
    live: isConfigured(),
    fetchedAt: new Date().toISOString()
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireActive();
  if ("error" in auth) return auth.error;

  let body: { health?: string; mode?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Neispravan zahtjev." }, { status: 400 });
  }

  const raw = (body.mode ?? body.health ?? "spreman") as string;
  const mode: PlayerMode = PLAYER_MODES.includes(raw as PlayerMode)
    ? (raw as PlayerMode)
    : "spreman";
  await setPlayerMode(auth.user.id, mode);

  return NextResponse.json({ ok: true, mode, modeLabel: modeLabel(mode) });
}