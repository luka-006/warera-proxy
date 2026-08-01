import { NextResponse } from "next/server";
import { requireActive } from "@/lib/guards";
import { getVapidPublicKey } from "@/lib/push";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireActive();
  if ("error" in auth) return auth.error;
  const publicKey = getVapidPublicKey();
  if (!publicKey) {
    return NextResponse.json({ configured: false, publicKey: null });
  }
  return NextResponse.json({ configured: true, publicKey });
}