import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { invites } from "@/db/schema";
import { requireAdmin } from "@/lib/guards";
import { newId } from "@/lib/ids";
import { normalizeCallsign } from "@/lib/phrase";
import { randomBytes } from "crypto";

export const runtime = "nodejs";

function makeCode(): string {
  const raw = randomBytes(5).toString("hex").toUpperCase();
  return "HR-" + raw.slice(0, 4) + "-" + raw.slice(4, 8);
}

export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const rows = await db
    .select()
    .from(invites)
    .orderBy(desc(invites.createdAt))
    .limit(50);

  return NextResponse.json({ invites: rows });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  let body: { intendedCallsign?: string; note?: string; hours?: number };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const intended = body.intendedCallsign
    ? normalizeCallsign(body.intendedCallsign)
    : null;
  if (intended && (intended.length < 3 || intended.length > 24)) {
    return NextResponse.json({ error: "Pozivni znak 3-24 znaka." }, { status: 400 });
  }

  const hours = Math.min(168, Math.max(1, Number(body.hours) || 48));
  const code = makeCode();
  const id = newId();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + hours * 3600_000);

  await db.insert(invites).values({
    id,
    code,
    intendedCallsign: intended,
    note: (body.note ?? "").trim().slice(0, 120) || null,
    createdBy: auth.user.callsign,
    expiresAt,
    createdAt: now
  });

  const discordMsg = intended
    ? ("Tvoj jednokratni kod za HR Operativni Centar: `" + code + "`\nPozivni znak: **" + intended + "**\nVrijedi " + hours + "h. Nemoj dijeliti s drugima.")
    : ("Tvoj jednokratni kod za HR Operativni Centar: `" + code + "`\nVrijedi " + hours + "h. Nemoj dijeliti s drugima.");

  return NextResponse.json({
    invite: {
      id,
      code,
      intendedCallsign: intended,
      note: body.note ?? null,
      expiresAt,
      discordMsg
    }
  });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Nedostaje id." }, { status: 400 });
  await db.delete(invites).where(and(eq(invites.id, id), isNull(invites.usedBy)));
  return NextResponse.json({ ok: true });
}