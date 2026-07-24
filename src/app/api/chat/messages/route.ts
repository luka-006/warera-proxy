import { NextRequest, NextResponse } from "next/server";
import { and, asc, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { channels, messages, users } from "@/db/schema";
import { requireCommander } from "@/lib/guards";
import { newId } from "@/lib/ids";
import { rateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";

// Chat je interni kanal zapovjednistva — vojnici nemaju pristup.
// GET /api/chat/messages?channelId=...&after=<isoOrEmpty>
export async function GET(req: NextRequest) {
  const auth = await requireCommander();
  if ("error" in auth) return auth.error;

  const channelId = req.nextUrl.searchParams.get("channelId");
  if (!channelId) {
    return NextResponse.json({ error: "Nedostaje kanal." }, { status: 400 });
  }
  const after = req.nextUrl.searchParams.get("after");
  const afterDate = after ? new Date(after) : null;

  const rows = await db
    .select({
      id: messages.id,
      body: messages.body,
      pinned: messages.pinned,
      createdAt: messages.createdAt,
      author: users.callsign,
      authorRank: users.rank
    })
    .from(messages)
    .innerJoin(users, eq(messages.userId, users.id))
    .where(
      afterDate
        ? and(eq(messages.channelId, channelId), gt(messages.createdAt, afterDate))
        : eq(messages.channelId, channelId)
    )
    .orderBy(asc(messages.createdAt))
    .limit(200);

  return NextResponse.json({ messages: rows });
}

// POST /api/chat/messages { channelId, body }
export async function POST(req: NextRequest) {
  const auth = await requireCommander();
  if ("error" in auth) return auth.error;

  const user = auth.user;
  const rl = rateLimit(`chat:${user.id}`, 20, 30_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Uspori malo." }, { status: 429 });
  }

  let payload: { channelId?: string; body?: string };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Neispravan zahtjev." }, { status: 400 });
  }

  const channelId = (payload.channelId ?? "").trim();
  const text = (payload.body ?? "").trim();
  if (!channelId) return NextResponse.json({ error: "Nedostaje kanal." }, { status: 400 });
  if (text.length < 1 || text.length > 1000) {
    return NextResponse.json({ error: "Poruka 1-1000 znakova." }, { status: 400 });
  }

  const ch = await db.select({ id: channels.id }).from(channels).where(eq(channels.id, channelId)).limit(1);
  if (!ch[0]) return NextResponse.json({ error: "Kanal ne postoji." }, { status: 404 });

  const id = newId();
  const createdAt = new Date();
  await db.insert(messages).values({ id, channelId, userId: user.id, body: text, createdAt });

  return NextResponse.json({
    message: {
      id,
      body: text,
      pinned: false,
      createdAt,
      author: user.callsign,
      authorRank: user.rank
    }
  });
}

// PATCH { messageId, pinned } — prikvaci/otkvaci poruku
export async function PATCH(req: NextRequest) {
  const auth = await requireCommander();
  if ("error" in auth) return auth.error;

  let payload: { messageId?: string; pinned?: boolean };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Neispravan zahtjev." }, { status: 400 });
  }

  const messageId = (payload.messageId ?? "").trim();
  if (!messageId) return NextResponse.json({ error: "Nedostaje poruka." }, { status: 400 });

  const rows = await db
    .select({ id: messages.id })
    .from(messages)
    .where(eq(messages.id, messageId))
    .limit(1);
  if (!rows[0]) return NextResponse.json({ error: "Poruka ne postoji." }, { status: 404 });

  await db
    .update(messages)
    .set({ pinned: Boolean(payload.pinned) })
    .where(eq(messages.id, messageId));

  return NextResponse.json({ ok: true });
}
