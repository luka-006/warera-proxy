import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { chatRequests } from "@/db/schema";
import { requireActive } from "@/lib/guards";
import { newId } from "@/lib/ids";

export const runtime = "nodejs";

// Vojnik trazi pravo pisanja u chat
export async function POST() {
  const auth = await requireActive();
  if ("error" in auth) return auth.error;

  const user = auth.user;
  if (user.rank !== "vojnik") {
    return NextResponse.json({ error: "Vec mozes pisati." }, { status: 400 });
  }
  if (user.canChat) {
    return NextResponse.json({ error: "Vec imas dopustenje." }, { status: 400 });
  }

  const existing = await db
    .select({ id: chatRequests.id })
    .from(chatRequests)
    .where(and(eq(chatRequests.userId, user.id), eq(chatRequests.status, "ceka")))
    .limit(1);

  if (existing[0]) {
    return NextResponse.json({ ok: true, already: true });
  }

  await db.insert(chatRequests).values({ id: newId(), userId: user.id, status: "ceka" });
  return NextResponse.json({ ok: true });
}
