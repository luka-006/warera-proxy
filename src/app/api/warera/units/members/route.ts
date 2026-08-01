import { NextRequest, NextResponse } from "next/server";
import { requireActive } from "@/lib/guards";
import { getMilitaryUnitMembers, isConfigured } from "@/lib/warera";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const auth = await requireActive();
  if ("error" in auth) return auth.error;

  const muId = req.nextUrl.searchParams.get("muId");
  if (!muId) {
    return NextResponse.json({ error: "Nedostaje muId." }, { status: 400 });
  }

  if (!isConfigured()) {
    return NextResponse.json({ error: "War Era API kljuc nije postavljen." }, { status: 400 });
  }

  try {
    const members = await getMilitaryUnitMembers(muId);
    if (!members) {
      return NextResponse.json({ error: "Jedinica nije pronadena." }, { status: 404 });
    }
    return NextResponse.json(members);
  } catch {
    return NextResponse.json({ error: "Greska u dohvatu clanova." }, { status: 502 });
  }
}