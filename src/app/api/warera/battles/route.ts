import { NextResponse } from "next/server";
import { requireActive } from "@/lib/guards";
import { getActiveBattles, isConfigured, WareraError } from "@/lib/warera";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireActive();
  if ("error" in auth) return auth.error;

  if (!isConfigured()) {
    return NextResponse.json(
      {
        battles: [],
        configured: false,
        message: "War Era API kljuc nije postavljen (WARERA_API_KEY)."
      },
      { status: 200 }
    );
  }

  try {
    const battles = await getActiveBattles();
    return NextResponse.json({ battles, configured: true, fetchedAt: new Date().toISOString() });
  } catch (e) {
    const status = e instanceof WareraError ? e.status : 502;
    return NextResponse.json(
      {
        battles: [],
        configured: true,
        error: "Ne mogu dohvatiti podatke s War Era API-ja."
      },
      { status }
    );
  }
}
