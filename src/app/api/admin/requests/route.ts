import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { chatRequests, users } from "@/db/schema";
import { requireCommander } from "@/lib/guards";

export const runtime = "nodejs";

// Zahtjevi vojnika za pisanje u chat (vidljivo zapovjedniku i adminu)
export async function GET() {
  const auth = await requireCommander();
  if ("error" in auth) return auth.error;

  const rows = await db
    .select({
      id: chatRequests.id,
      status: chatRequests.status,
      createdAt: chatRequests.createdAt,
      userId: chatRequests.userId,
      callsign: users.callsign,
      rank: users.rank,
      canChat: users.canChat
    })
    .from(chatRequests)
    .innerJoin(users, eq(chatRequests.userId, users.id))
    .where(eq(chatRequests.status, "ceka"))
    .orderBy(desc(chatRequests.createdAt));

  return NextResponse.json({ requests: rows });
}

// POST { requestId, approve: boolean }
export async function POST(req: NextRequest) {
  const auth = await requireCommander();
  if ("error" in auth) return auth.error;

  let body: { requestId?: string; approve?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Neispravan zahtjev." }, { status: 400 });
  }

  const { requestId, approve } = body;
  if (!requestId) return NextResponse.json({ error: "Nedostaje id." }, { status: 400 });

  const rows = await db.select().from(chatRequests).where(eq(chatRequests.id, requestId)).limit(1);
  const request = rows[0];
  if (!request) return NextResponse.json({ error: "Ne postoji." }, { status: 404 });

  await db
    .update(chatRequests)
    .set({ status: approve ? "odobreno" : "odbijeno", resolvedBy: auth.user.callsign })
    .where(eq(chatRequests.id, requestId));

  if (approve) {
    await db.update(users).set({ canChat: true }).where(eq(users.id, request.userId));
  }

  return NextResponse.json({ ok: true });
}
