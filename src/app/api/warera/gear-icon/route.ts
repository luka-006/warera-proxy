import { NextRequest, NextResponse } from "next/server";
import { requireActive } from "@/lib/guards";
import { gearIconSources } from "@/lib/gear";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await requireActive();
  if ("error" in auth) return auth.error;

  const key = req.nextUrl.searchParams.get("key")?.trim();
  if (!key || !/^[a-zA-Z0-9]+$/.test(key)) {
    return NextResponse.json({ error: "Neispravan kljuc." }, { status: 400 });
  }

  for (const url of gearIconSources(key).filter((u) => u.startsWith("http"))) {
    try {
      const res = await fetch(url, { cache: "force-cache" });
      if (!res.ok) continue;
      const buf = await res.arrayBuffer();
      const type = res.headers.get("content-type") ?? "image/png";
      return new NextResponse(buf, {
        headers: {
          "content-type": type,
          "cache-control": "public, max-age=86400"
        }
      });
    } catch {
      /* try next */
    }
  }

  return NextResponse.json({ error: "Ikona nije pronadena." }, { status: 404 });
}