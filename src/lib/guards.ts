import { NextResponse } from "next/server";
import { getCurrentUser, type SessionUser } from "./session";

// Vraca korisnika ako je aktivan, inace baca Response gresku.
export async function requireActive(): Promise<
  { user: SessionUser } | { error: NextResponse }
> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: NextResponse.json({ error: "Niste prijavljeni." }, { status: 401 }) };
  }
  if (user.status !== "aktivan") {
    return {
      error: NextResponse.json(
        { error: "Racun ceka odobrenje administratora." },
        { status: 403 }
      )
    };
  }
  return { user };
}

// Zapovjedni lanac: admin > visoki zapovjednik > zapovjednik > vojnik
export const COMMAND_RANKS = ["admin", "visoki", "zapovjednik"];

export function isCommander(rank: string): boolean {
  return COMMAND_RANKS.includes(rank);
}

export async function requireCommander(): Promise<
  { user: SessionUser } | { error: NextResponse }
> {
  const res = await requireActive();
  if ("error" in res) return res;
  if (!isCommander(res.user.rank)) {
    return {
      error: NextResponse.json({ error: "Samo zapovjednistvo." }, { status: 403 })
    };
  }
  return res;
}

export async function requireAdmin(): Promise<
  { user: SessionUser } | { error: NextResponse }
> {
  const res = await requireActive();
  if ("error" in res) return res;
  if (res.user.rank !== "admin") {
    return { error: NextResponse.json({ error: "Samo administrator." }, { status: 403 }) };
  }
  return res;
}
