import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users, type User } from "@/db/schema";
import { newId, newToken } from "./ids";

const COOKIE_NAME = "warera_session";
const SESSION_DAYS = 90;
const MAX_AGE_SEC = SESSION_DAYS * 24 * 60 * 60;

export async function createSession(userId: string): Promise<void> {
  const token = newToken();
  const expiresAt = new Date(Date.now() + MAX_AGE_SEC * 1000);

  await db.insert(sessions).values({
    id: token,
    userId,
    expiresAt
  });

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SEC
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (token) {
    await db.delete(sessions).where(eq(sessions.id, token));
    store.delete(COOKIE_NAME);
  }
}

export interface SessionUser {
  id: string;
  callsign: string;
  rank: string;
  status: string;
  canChat: boolean;
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const rows = await db
    .select({
      sessionExpires: sessions.expiresAt,
      id: users.id,
      callsign: users.callsign,
      rank: users.rank,
      status: users.status,
      canChat: users.canChat
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.id, token))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  if (row.sessionExpires.getTime() < Date.now()) {
    await db.delete(sessions).where(eq(sessions.id, token));
    return null;
  }

  return {
    id: row.id,
    callsign: row.callsign,
    rank: row.rank,
    status: row.status,
    canChat: row.canChat
  };
}

export function isAdmin(u: { rank: string } | null): boolean {
  return u?.rank === "admin";
}

export function isCommander(u: { rank: string } | null): boolean {
  return u?.rank === "admin" || u?.rank === "zapovjednik";
}

export type { User };
