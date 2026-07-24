import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { plans, users } from "@/db/schema";
import { requireActive, requireCommander } from "@/lib/guards";
import { newId } from "@/lib/ids";

export const runtime = "nodejs";

const TYPES = ["zapovijed", "plan", "program"];
const PRIORITIES = ["HITNO", "VISOKO", "NORMALNO", "NISKO"];

export async function GET() {
  const auth = await requireActive();
  if ("error" in auth) return auth.error;

  const rows = await db
    .select({
      id: plans.id,
      title: plans.title,
      body: plans.body,
      type: plans.type,
      priority: plans.priority,
      createdAt: plans.createdAt,
      updatedAt: plans.updatedAt,
      author: users.callsign,
      authorRank: users.rank
    })
    .from(plans)
    .innerJoin(users, eq(plans.userId, users.id))
    .orderBy(desc(plans.createdAt))
    .limit(100);

  return NextResponse.json({ plans: rows });
}

export async function POST(req: NextRequest) {
  const auth = await requireCommander();
  if ("error" in auth) return auth.error;

  let body: { title?: string; body?: string; type?: string; priority?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Neispravan zahtjev." }, { status: 400 });
  }

  const title = (body.title ?? "").trim();
  const text = (body.body ?? "").trim();
  const type = TYPES.includes(body.type ?? "") ? (body.type as string) : "zapovijed";
  const priority = PRIORITIES.includes(body.priority ?? "")
    ? (body.priority as string)
    : "NORMALNO";

  if (title.length < 2 || title.length > 120) {
    return NextResponse.json({ error: "Naslov 2-120 znakova." }, { status: 400 });
  }
  if (text.length < 1 || text.length > 8000) {
    return NextResponse.json({ error: "Tekst 1-8000 znakova." }, { status: 400 });
  }

  const id = newId();
  const now = new Date();
  await db.insert(plans).values({
    id,
    title,
    body: text,
    type,
    priority,
    userId: auth.user.id,
    createdAt: now,
    updatedAt: now
  });

  return NextResponse.json({
    plan: {
      id,
      title,
      body: text,
      type,
      priority,
      createdAt: now,
      updatedAt: now,
      author: auth.user.callsign,
      authorRank: auth.user.rank
    }
  });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireCommander();
  if ("error" in auth) return auth.error;

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Nedostaje id." }, { status: 400 });

  const rows = await db.select().from(plans).where(eq(plans.id, id)).limit(1);
  const plan = rows[0];
  if (!plan) return NextResponse.json({ error: "Ne postoji." }, { status: 404 });
  if (plan.userId !== auth.user.id && auth.user.rank !== "admin") {
    return NextResponse.json({ error: "Nemas ovlast." }, { status: 403 });
  }

  await db.delete(plans).where(eq(plans.id, id));
  return NextResponse.json({ ok: true });
}
