import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { playerStatus, users } from "@/db/schema";
import { requireActive } from "@/lib/guards";
import { notifyAllActive } from "@/lib/notify";

export const runtime = "nodejs";

const HEALTH = ["spreman", "zauzet", "ozlijeden", "odsutan"];

export async function GET() {
  const auth = await requireActive();
  if ("error" in auth) return auth.error;

  const rows = await db
    .select({
      userId: users.id,
      callsign: users.callsign,
      rank: users.rank,
      avatarHue: users.avatarHue,
      health: playerStatus.health,
      helpMsg: playerStatus.helpMsg,
      updatedAt: playerStatus.updatedAt
    })
    .from(users)
    .leftJoin(playerStatus, eq(users.id, playerStatus.userId))
    .where(eq(users.status, "aktivan"));

  return NextResponse.json({
    statuses: rows.map((r) => ({
      ...r,
      health: r.health ?? "spreman",
      helpMsg: r.helpMsg ?? null
    }))
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireActive();
  if ("error" in auth) return auth.error;

  let body: { health?: string; helpMsg?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Neispravan zahtjev." }, { status: 400 });
  }

  const health = HEALTH.includes(body.health ?? "") ? (body.health as string) : "spreman";
  const helpMsg =
    body.helpMsg === null || body.helpMsg === undefined
      ? null
      : String(body.helpMsg).trim().slice(0, 160) || null;

  const now = new Date();
  await db
    .insert(playerStatus)
    .values({
      userId: auth.user.id,
      health,
      helpMsg,
      updatedAt: now
    })
    .onConflictDoUpdate({
      target: playerStatus.userId,
      set: { health, helpMsg, updatedAt: now }
    });

  if (helpMsg) {
    await notifyAllActive(
      {
        kind: "help",
        title: "POMOC · " + auth.user.callsign,
        body: helpMsg,
        link: "/status"
      },
      auth.user.id
    );
  }

  return NextResponse.json({ ok: true, health, helpMsg });
}