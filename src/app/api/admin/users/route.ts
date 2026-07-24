import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireAdmin } from "@/lib/guards";

export const runtime = "nodejs";

const RANKS = ["admin", "zapovjednik", "vojnik"];
const STATUSES = ["ceka", "aktivan", "blokiran"];

export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const rows = await db
    .select({
      id: users.id,
      callsign: users.callsign,
      rank: users.rank,
      status: users.status,
      canChat: users.canChat,
      hasPassword: users.passwordHash,
      createdAt: users.createdAt,
      lastLoginAt: users.lastLoginAt
    })
    .from(users)
    .orderBy(desc(users.createdAt));

  return NextResponse.json({
    users: rows.map((u) => ({ ...u, hasPassword: Boolean(u.hasPassword) }))
  });
}

// PATCH { userId, action: "status"|"rank"|"chat", value }
export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  let body: { userId?: string; action?: string; value?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Neispravan zahtjev." }, { status: 400 });
  }

  const { userId, action, value } = body;
  if (!userId || !action) {
    return NextResponse.json({ error: "Nedostaju podaci." }, { status: 400 });
  }

  const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const target = rows[0];
  if (!target) return NextResponse.json({ error: "Korisnik ne postoji." }, { status: 404 });

  if (action === "status") {
    if (!STATUSES.includes(String(value))) {
      return NextResponse.json({ error: "Neispravan status." }, { status: 400 });
    }
    if (target.id === auth.user.id && value === "blokiran") {
      return NextResponse.json({ error: "Ne mozes blokirati sam sebe." }, { status: 400 });
    }
    await db
      .update(users)
      .set({ status: String(value), whitelistedBy: auth.user.callsign })
      .where(eq(users.id, userId));
  } else if (action === "rank") {
    if (!RANKS.includes(String(value))) {
      return NextResponse.json({ error: "Neispravan rang." }, { status: 400 });
    }
    if (target.id === auth.user.id && value !== "admin") {
      return NextResponse.json(
        { error: "Ne mozes sebi maknuti admin rang." },
        { status: 400 }
      );
    }
    await db.update(users).set({ rank: String(value) }).where(eq(users.id, userId));
  } else if (action === "chat") {
    await db.update(users).set({ canChat: Boolean(value) }).where(eq(users.id, userId));
  } else {
    return NextResponse.json({ error: "Nepoznata akcija." }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

// DELETE ?userId=...
export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "Nedostaje userId." }, { status: 400 });
  if (userId === auth.user.id) {
    return NextResponse.json({ error: "Ne mozes obrisati sam sebe." }, { status: 400 });
  }

  await db.delete(users).where(eq(users.id, userId));
  return NextResponse.json({ ok: true });
}
