import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { planReactions, plans } from "@/db/schema";
import { requireActive } from "@/lib/guards";
import { newId } from "@/lib/ids";

export const runtime = "nodejs";

const ALLOWED = ["❤️", "👍", "🫡"];

// POST { planId, emoji } — toggle reakcije
export async function POST(req: NextRequest) {
  const auth = await requireActive();
  if ("error" in auth) return auth.error;

  let body: { planId?: string; emoji?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Neispravan zahtjev." }, { status: 400 });
  }

  const planId = (body.planId ?? "").trim();
  const emoji = body.emoji ?? "";
  if (!planId || !ALLOWED.includes(emoji)) {
    return NextResponse.json({ error: "Neispravna reakcija." }, { status: 400 });
  }

  const exists = await db.select({ id: plans.id }).from(plans).where(eq(plans.id, planId)).limit(1);
  if (!exists.length) {
    return NextResponse.json({ error: "Plan ne postoji." }, { status: 404 });
  }

  const current = await db
    .select({ id: planReactions.id })
    .from(planReactions)
    .where(
      and(
        eq(planReactions.planId, planId),
        eq(planReactions.userId, auth.user.id),
        eq(planReactions.emoji, emoji)
      )
    )
    .limit(1);

  if (current.length) {
    await db.delete(planReactions).where(eq(planReactions.id, current[0].id));
    return NextResponse.json({ ok: true, reacted: false });
  }

  await db.insert(planReactions).values({
    id: newId(),
    planId,
    userId: auth.user.id,
    emoji
  });
  return NextResponse.json({ ok: true, reacted: true });
}
