import { NextRequest, NextResponse } from "next/server";
import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { battleNotes, users } from "@/db/schema";
import { requireActive, requireCommander } from "@/lib/guards";
import { newId } from "@/lib/ids";

export const runtime = "nodejs";

const PRIORITIES = ["HITNO", "VISOKO", "NORMALNO", "NISKO"];

// GET /api/notes?battleIds=a,b,c  -> biljeske grupirane po bitci
export async function GET(req: NextRequest) {
  const auth = await requireActive();
  if ("error" in auth) return auth.error;

  const idsParam = req.nextUrl.searchParams.get("battleIds") ?? "";
  const ids = idsParam.split(",").map((s) => s.trim()).filter(Boolean);

  const rows = await db
    .select({
      id: battleNotes.id,
      battleId: battleNotes.battleId,
      body: battleNotes.body,
      priority: battleNotes.priority,
      createdAt: battleNotes.createdAt,
      userId: battleNotes.userId,
      author: users.callsign,
      authorRank: users.rank
    })
    .from(battleNotes)
    .innerJoin(users, eq(battleNotes.userId, users.id))
    .where(ids.length ? inArray(battleNotes.battleId, ids) : undefined)
    .orderBy(desc(battleNotes.createdAt));

  const byBattle: Record<string, typeof rows> = {};
  for (const r of rows) {
    (byBattle[r.battleId] ??= []).push(r);
  }
  return NextResponse.json({ notes: byBattle });
}

// POST /api/notes  { battleId, battleLabel, body, priority }  -> samo zapovjednik/admin
export async function POST(req: NextRequest) {
  const auth = await requireCommander();
  if ("error" in auth) return auth.error;

  let body: {
    battleId?: string;
    battleLabel?: string;
    body?: string;
    priority?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Neispravan zahtjev." }, { status: 400 });
  }

  const battleId = (body.battleId ?? "").trim();
  const text = (body.body ?? "").trim();
  const priority = PRIORITIES.includes(body.priority ?? "")
    ? (body.priority as string)
    : "NORMALNO";

  if (!battleId) {
    return NextResponse.json({ error: "Nedostaje bitka." }, { status: 400 });
  }
  if (text.length < 1 || text.length > 500) {
    return NextResponse.json(
      { error: "Biljeska mora imati 1-500 znakova." },
      { status: 400 }
    );
  }

  const id = newId();
  await db.insert(battleNotes).values({
    id,
    battleId,
    battleLabel: body.battleLabel ?? null,
    userId: auth.user.id,
    body: text,
    priority
  });

  return NextResponse.json({
    note: {
      id,
      battleId,
      body: text,
      priority,
      createdAt: new Date(),
      userId: auth.user.id,
      author: auth.user.callsign,
      authorRank: auth.user.rank
    }
  });
}

// DELETE /api/notes?id=...  -> autor ili admin
export async function DELETE(req: NextRequest) {
  const auth = await requireCommander();
  if ("error" in auth) return auth.error;

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Nedostaje id." }, { status: 400 });

  const rows = await db.select().from(battleNotes).where(eq(battleNotes.id, id)).limit(1);
  const note = rows[0];
  if (!note) return NextResponse.json({ error: "Ne postoji." }, { status: 404 });

  if (note.userId !== auth.user.id && auth.user.rank !== "admin") {
    return NextResponse.json({ error: "Nemas ovlast." }, { status: 403 });
  }

  await db.delete(battleNotes).where(eq(battleNotes.id, id));
  return NextResponse.json({ ok: true });
}
