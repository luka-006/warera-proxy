import { NextRequest, NextResponse } from "next/server";
import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { planReactions, plans, users } from "@/db/schema";
import { requireActive, requireCommander } from "@/lib/guards";
import { newId } from "@/lib/ids";
import { battleLink } from "@/lib/warera";

export const runtime = "nodejs";

const TYPES = ["zapovijed", "plan", "program"];
const PRIORITIES = ["HITNO", "VISOKO", "NORMALNO", "NISKO"];

export interface PlanPhase {
  title: string;
  when: string;
  body: string;
}

function parsePhases(raw: string | null): PlanPhase[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function sanitizePhases(input: unknown): PlanPhase[] | null {
  if (input === undefined || input === null) return [];
  if (!Array.isArray(input) || input.length > 12) return null;
  const out: PlanPhase[] = [];
  for (const p of input) {
    const title = String(p?.title ?? "").trim().slice(0, 80);
    const when = String(p?.when ?? "").trim().slice(0, 60);
    const body = String(p?.body ?? "").trim().slice(0, 1500);
    if (!title && !body) continue;
    out.push({ title, when, body });
  }
  return out;
}

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
      phases: plans.phases,
      battleId: plans.battleId,
      battleLabel: plans.battleLabel,
      createdAt: plans.createdAt,
      updatedAt: plans.updatedAt,
      author: users.callsign,
      authorRank: users.rank
    })
    .from(plans)
    .innerJoin(users, eq(plans.userId, users.id))
    .orderBy(desc(plans.createdAt))
    .limit(100);

  // Reakcije za prikazane planove
  const ids = rows.map((r) => r.id);
  const reactions = ids.length
    ? await db
        .select({
          planId: planReactions.planId,
          userId: planReactions.userId,
          emoji: planReactions.emoji
        })
        .from(planReactions)
        .where(inArray(planReactions.planId, ids))
    : [];

  const byPlan = new Map<string, { counts: Record<string, number>; mine: string[] }>();
  for (const r of reactions) {
    let entry = byPlan.get(r.planId);
    if (!entry) {
      entry = { counts: {}, mine: [] };
      byPlan.set(r.planId, entry);
    }
    entry.counts[r.emoji] = (entry.counts[r.emoji] ?? 0) + 1;
    if (r.userId === auth.user.id) entry.mine.push(r.emoji);
  }

  const out = rows.map((r) => ({
    ...r,
    phases: parsePhases(r.phases),
    battleLink: r.battleId ? battleLink(r.battleId) : null,
    reactions: byPlan.get(r.id)?.counts ?? {},
    myReactions: byPlan.get(r.id)?.mine ?? []
  }));

  return NextResponse.json({ plans: out });
}

export async function POST(req: NextRequest) {
  const auth = await requireCommander();
  if ("error" in auth) return auth.error;

  let body: {
    title?: string;
    body?: string;
    type?: string;
    priority?: string;
    phases?: unknown;
    battleId?: string;
    battleLabel?: string;
  };
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

  const phases = sanitizePhases(body.phases);
  if (phases === null) {
    return NextResponse.json({ error: "Najvise 12 faza." }, { status: 400 });
  }

  const battleId = (body.battleId ?? "").trim().slice(0, 40) || null;
  const battleLabel = (body.battleLabel ?? "").trim().slice(0, 120) || null;

  const id = newId();
  const now = new Date();
  await db.insert(plans).values({
    id,
    title,
    body: text,
    type,
    priority,
    phases: phases.length ? JSON.stringify(phases) : null,
    battleId,
    battleLabel,
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
      phases,
      battleId,
      battleLabel,
      battleLink: battleId ? battleLink(battleId) : null,
      reactions: {},
      myReactions: [],
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
