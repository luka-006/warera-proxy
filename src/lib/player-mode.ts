import { db } from "@/db";
import { playerStatus } from "@/db/schema";

export const PLAYER_MODES = ["spreman", "odsutan"] as const;
export type PlayerMode = (typeof PLAYER_MODES)[number];

export function normalizeMode(raw: string | null | undefined): PlayerMode {
  if (raw === "odsutan") return "odsutan";
  return "spreman";
}

export function modeLabel(mode: PlayerMode): string {
  return mode === "odsutan" ? "Eco mode" : "War mode";
}

export async function setPlayerMode(userId: string, mode: PlayerMode) {
  const now = new Date();
  await db
    .insert(playerStatus)
    .values({
      userId,
      health: mode,
      helpMsg: null,
      updatedAt: now
    })
    .onConflictDoUpdate({
      target: playerStatus.userId,
      set: { health: mode, helpMsg: null, updatedAt: now }
    });
}