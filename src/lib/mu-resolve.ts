import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getMilitaryUnit } from "@/lib/warera";

export const TEST_MU_ID = "__testmu__";

export async function resolveAppUserIdsForMu(
  muId: string,
  exceptUserId?: string
): Promise<string[]> {
  const appUsers = await db
    .select({ id: users.id, callsign: users.callsign })
    .from(users)
    .where(eq(users.status, "aktivan"));
  const byName = new Map(appUsers.map((u) => [u.callsign.toLowerCase(), u.id]));

  if (muId === TEST_MU_ID) {
    return appUsers.map((u) => u.id).filter((id) => id !== exceptUserId);
  }

  try {
    const unit = await getMilitaryUnit(muId);
    if (!unit) return [];
    const names = [...unit.commanders, ...unit.managers, ...unit.soldiers].map((m) =>
      m.username.toLowerCase()
    );
    return [
      ...new Set(
        names
          .map((n) => byName.get(n))
          .filter((id): id is string => Boolean(id) && id !== exceptUserId)
      )
    ];
  } catch {
    return [];
  }
}

export async function resolveAppUserIdsForMus(
  muIds: string[],
  exceptUserId?: string
): Promise<string[]> {
  const ids = [...new Set(muIds.filter(Boolean))];
  if (!ids.length) return [];
  const sets = await Promise.all(ids.map((id) => resolveAppUserIdsForMu(id, exceptUserId)));
  return [...new Set(sets.flat())];
}