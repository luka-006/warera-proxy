import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireCommander } from "@/lib/guards";
import { resolveAppUserIdsForMu } from "@/lib/mu-resolve";
import { notifyAllActive, notifyUsers } from "@/lib/notify";
import { battleLink } from "@/lib/warera";
import { rateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const auth = await requireCommander();
  if ("error" in auth) return auth.error;
  const me = auth.user;

  const rl = rateLimit(`ping:${me.id}`, 20, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Pricekaj minutu prije sljedeceg pinga." }, { status: 429 });
  }

  let body: {
    targetUserId?: string;
    targetCallsign?: string;
    muId?: string;
    muName?: string;
    battleId?: string;
    battleLabel?: string;
    message?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Neispravan zahtjev." }, { status: 400 });
  }

  const note = (body.message ?? "").trim().slice(0, 200);
  const battleId = (body.battleId ?? "").trim() || undefined;
  const battleLabel = (body.battleLabel ?? "").trim().slice(0, 120);
  const muName = (body.muName ?? "").trim().slice(0, 80);
  const targetCallsign = (body.targetCallsign ?? "").trim();
  const targetUserId = (body.targetUserId ?? "").trim();

  async function ackSender(summary: string) {
    await notifyUsers([me.id], {
      kind: "ping-ack",
      title: "Ping poslan",
      body: summary,
      link: "/jedinice",
      battleId
    });
  }

  if (targetUserId || targetCallsign) {
    let uid = targetUserId;
    let name = targetCallsign;
    if (!uid && targetCallsign) {
      const all = await db
        .select({ id: users.id, callsign: users.callsign })
        .from(users)
        .where(eq(users.status, "aktivan"));
      const found = all.find((u) => u.callsign.toLowerCase() === targetCallsign.toLowerCase());
      if (found) {
        uid = found.id;
        name = found.callsign;
      }
    }
    if (uid) {
      await notifyUsers([uid], {
        kind: "ping",
        title: "ORDER · " + (name || "ti"),
        body: note || `${me.callsign} ti salje order`,
        link: battleId ? battleLink(battleId) : "/jedinice",
        battleId
      });
      if (uid !== me.id) {
        await ackSender(`Order poslan: ${name}`);
      }
      return NextResponse.json({ ok: true, mode: "user", target: name });
    }
    await notifyAllActive(
      {
        kind: "ping",
        title: "ORDER · " + targetCallsign,
        body: note || `${me.callsign} pinge ${targetCallsign}`,
        link: "/jedinice",
        battleId
      },
      me.id
    );
    await ackSender(`Broadcast order: ${targetCallsign} (nema app racuna)`);
    return NextResponse.json({ ok: true, mode: "broadcast-name" });
  }

  if (muName || body.muId) {
    const muId = (body.muId ?? "").trim();
    const label = muName || muId;
    const payload = {
      kind: "ping",
      title: "ORDER · MU " + label,
      body: note || `${me.callsign} salje order jedinici ${label}`,
      link: battleId ? battleLink(battleId) : "/jedinice",
      battleId
    };
    if (muId) {
      const targeted = await resolveAppUserIdsForMu(muId, me.id);
      if (targeted.length) {
        await notifyUsers(targeted, payload);
        await ackSender(`Order poslan MU ${label} (${targeted.length} clanova)`);
        return NextResponse.json({ ok: true, mode: "mu", pinged: targeted.length });
      }
    }
    await notifyAllActive(payload, me.id);
    await ackSender(`Broadcast MU ${label}`);
    return NextResponse.json({ ok: true, mode: "mu-broadcast" });
  }

  if (battleId) {
    await notifyAllActive({
      kind: "ping",
      title: "PING · " + (battleLabel || "Bitka"),
      body: note || `${me.callsign} zove na bitku`,
      link: battleLink(battleId),
      battleId
    });
    return NextResponse.json({ ok: true, mode: "battle" });
  }

  return NextResponse.json({ error: "Odaberi clana, MU ili bitku." }, { status: 400 });
}