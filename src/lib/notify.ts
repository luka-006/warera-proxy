import { db } from "@/db";
import { notifications, users } from "@/db/schema";
import { newId } from "@/lib/ids";
import { eq } from "drizzle-orm";

export async function notifyUsers(
  userIds: string[],
  payload: {
    kind: string;
    title: string;
    body?: string;
    link?: string;
    battleId?: string;
  }
) {
  const uniq = [...new Set(userIds.filter(Boolean))];
  if (!uniq.length) return;
  const now = new Date();
  await db.insert(notifications).values(
    uniq.map((userId) => ({
      id: newId(),
      userId,
      kind: payload.kind,
      title: payload.title,
      body: payload.body ?? null,
      link: payload.link ?? null,
      battleId: payload.battleId ?? null,
      read: false,
      createdAt: now
    }))
  );
}

export async function notifyAllActive(
  payload: {
    kind: string;
    title: string;
    body?: string;
    link?: string;
    battleId?: string;
  },
  exceptUserId?: string
) {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.status, "aktivan"));
  const ids = rows.map((r) => r.id).filter((id) => id !== exceptUserId);
  await notifyUsers(ids, payload);
}