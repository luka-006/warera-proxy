import { NextResponse } from "next/server";
import { requireActive } from "@/lib/guards";
import { isConfigured, listRegions, WareraError } from "@/lib/warera";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireActive();
  if ("error" in auth) return auth.error;

  if (!isConfigured()) {
    return NextResponse.json({ regions: [], configured: false });
  }

  try {
    const regions = await listRegions();
    return NextResponse.json({ regions, configured: true });
  } catch (e) {
    const status = e instanceof WareraError ? e.status : 502;
    return NextResponse.json({ regions: [], error: "Ne mogu dohvatiti regije." }, { status });
  }
}