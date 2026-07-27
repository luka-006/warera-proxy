import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { requireActive } from "@/lib/guards";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireActive();
  if ("error" in auth) return auth.error;

  const rows = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, auth.user.id))
    .orderBy(desc(notifications.createdAt))
    .limit(40);

  const unread = rows.filter((r) => !r.read).length;
  return NextResponse.json({ notifications: rows, unread });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireActive();
  if ("error" in auth) return auth.error;

  let body: { id?: string; all?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    /* empty */
  }

  if (body.all) {
    await db
      .update(notifications)
      .set({ read: true })
      .where(eq(notifications.userId, auth.user.id));
  } else if (body.id) {
    await db
      .update(notifications)
      .set({ read: true })
      .where(
        and(eq(notifications.id, body.id), eq(notifications.userId, auth.user.id))
      );
  }

  return NextResponse.json({ ok: true });
}