import { NextRequest, NextResponse } from "next/server";
import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { planReactions, plans, users } from "@/db/schema";
import { requireActive, requireCommander } from "@/lib/guards";
import { newId } from "@/lib/ids";
import { battleLink } from "@/lib/warera";
import { GEAR_KEYS } from "@/lib/gear";

export const runtime = "nodejs";

const TYPES = ["trenutni", "buduci", "zapovijed", "plan"];
const PRIORITIES = ["HITNO", "VISOKO", "NORMALNO", "NISKO"];

export interface PlanPhase {
  title: string;
  when: string;
  body: string;
}

export interface AttackTime {
  at: string;
  label: string;
}

function normalizeType(t: string): "trenutni" | "buduci" {
  if (t === "trenutni" || t === "zapovijed") return "trenutni";
  return "buduci";
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

function parseGear(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((k) => GEAR_KEYS.includes(k)) : [];
  } catch {
    return [];
  }
}

function parseAttackTimes(raw: string | null): AttackTime[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .map((x) => ({
        at: String(x?.at ?? "").trim().slice(0, 40),
        label: String(x?.label ?? "").trim().slice(0, 80)
      }))
      .filter((x) => x.at);
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

function sanitizeAttackTimes(input: unknown): AttackTime[] | null {
  if (input === undefined || input === null) return [];
  if (!Array.isArray(input) || input.length > 12) return null;
  const out: AttackTime[] = [];
  for (const p of input) {
    const at = String(p?.at ?? "").trim().slice(0, 40);
    const label = String(p?.label ?? "").trim().slice(0, 80);
    if (!at) continue;
    out.push({ at, label });
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
      expect: plans.expect,
      attackTimes: plans.attackTimes,
      battleId: plans.battleId,
      battleLabel: plans.battleLabel,
      followsPlanId: plans.followsPlanId,
      gear: plans.gear,
      createdAt: plans.createdAt,
      updatedAt: plans.updatedAt,
      author: users.callsign,
      authorRank: users.rank
    })
    .from(plans)
    .innerJoin(users, eq(plans.userId, users.id))
    .orderBy(desc(plans.createdAt))
    .limit(100);

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
    type: normalizeType(r.type),
    expect: r.expect ?? "",
    attackTimes: parseAttackTimes(r.attackTimes),
    phases: parsePhases(r.phases),
    gear: parseGear(r.gear),
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
    expect?: string;
    attackTimes?: unknown;
    battleId?: string;
    battleLabel?: string;
    followsPlanId?: string;
    gear?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Neispravan zahtjev." }, { status: 400 });
  }

  const title = (body.title ?? "").trim();
  const text = (body.body ?? "").trim();
  const type = normalizeType(TYPES.includes(body.type ?? "") ? (body.type as string) : "buduci");
  const priority = PRIORITIES.includes(body.priority ?? "")
    ? (body.priority as string)
    : "NORMALNO";
  const expect = (body.expect ?? "").trim().slice(0, 4000) || null;

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
  const attackTimes = sanitizeAttackTimes(body.attackTimes);
  if (attackTimes === null) {
    return NextResponse.json({ error: "Najvise 12 vremena napada." }, { status: 400 });
  }

  const battleId = (body.battleId ?? "").trim().slice(0, 40) || null;
  const battleLabel = (body.battleLabel ?? "").trim().slice(0, 120) || null;

  let followsPlanId = (body.followsPlanId ?? "").trim() || null;
  if (followsPlanId) {
    const prev = await db
      .select({ id: plans.id })
      .from(plans)
      .where(eq(plans.id, followsPlanId))
      .limit(1);
    if (!prev.length) followsPlanId = null;
  }

  const gear = Array.isArray(body.gear)
    ? (body.gear as unknown[]).map(String).filter((k) => GEAR_KEYS.includes(k)).slice(0, 9)
    : [];

  const id = newId();
  const now = new Date();

  if (type === "trenutni") {
    await db.update(plans).set({ type: "buduci" }).where(eq(plans.type, "trenutni"));
    await db.update(plans).set({ type: "buduci" }).where(eq(plans.type, "zapovijed"));
  }

  await db.insert(plans).values({
    id,
    title,
    body: text,
    type,
    priority,
    expect,
    attackTimes: attackTimes.length ? JSON.stringify(attackTimes) : null,
    phases: phases.length ? JSON.stringify(phases) : null,
    battleId,
    battleLabel,
    followsPlanId,
    gear: gear.length ? JSON.stringify(gear) : null,
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
      expect: expect ?? "",
      attackTimes,
      phases,
      battleId,
      battleLabel,
      followsPlanId,
      gear,
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

/** Dodaj poruku u trenutni plan (iz chata) */
export async function PATCH(req: NextRequest) {
  const auth = await requireCommander();
  if ("error" in auth) return auth.error;

  let body: { appendBody?: string; messageAuthor?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Neispravan zahtjev." }, { status: 400 });
  }

  const append = (body.appendBody ?? "").trim().slice(0, 2000);
  if (!append) {
    return NextResponse.json({ error: "Prazna poruka." }, { status: 400 });
  }

  const author = (body.messageAuthor ?? "").trim().slice(0, 40);
  const stamp = new Date().toLocaleString("hr-HR", { dateStyle: "short", timeStyle: "short" });
  const chunk = `\n\n— ${author || auth.user.callsign} (${stamp}):\n${append}`;

  let rows = await db.select().from(plans).where(eq(plans.type, "trenutni")).limit(1);
  if (!rows[0]) {
    rows = await db.select().from(plans).where(eq(plans.type, "zapovijed")).limit(1);
  }

  const now = new Date();
  if (!rows[0]) {
    const id = newId();
    await db.insert(plans).values({
      id,
      title: "Trenutni plan",
      body: chunk.trim(),
      type: "trenutni",
      priority: "NORMALNO",
      userId: auth.user.id,
      createdAt: now,
      updatedAt: now
    });
    return NextResponse.json({ ok: true, planId: id, created: true });
  }

  const plan = rows[0];
  const nextBody = (plan.body + chunk).slice(0, 8000);
  await db
    .update(plans)
    .set({ body: nextBody, type: "trenutni", updatedAt: now })
    .where(eq(plans.id, plan.id));

  return NextResponse.json({ ok: true, planId: plan.id, created: false });
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