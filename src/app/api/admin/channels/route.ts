import { NextRequest, NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { channels } from "@/db/schema";
import { requireAdmin } from "@/lib/guards";
import { newId } from "@/lib/ids";

export const runtime = "nodejs";

function slugify(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[čć]/g, "c")
    .replace(/[š]/g, "s")
    .replace(/[ž]/g, "z")
    .replace(/[đ]/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const rows = await db.select().from(channels).orderBy(asc(channels.createdAt));
  return NextResponse.json({ channels: rows });
}

// POST { name, description }
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  let body: { name?: string; description?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Neispravan zahtjev." }, { status: 400 });
  }

  const name = (body.name ?? "").trim();
  const slug = slugify(name);
  if (!name || !slug) {
    return NextResponse.json({ error: "Naziv kanala je obavezan." }, { status: 400 });
  }

  const existing = await db.select({ id: channels.id }).from(channels).where(eq(channels.slug, slug)).limit(1);
  if (existing[0]) {
    return NextResponse.json({ error: "Kanal s tim nazivom vec postoji." }, { status: 409 });
  }

  const id = newId();
  await db.insert(channels).values({
    id,
    slug,
    name,
    description: body.description?.trim() || null
  });

  return NextResponse.json({ channel: { id, slug, name } });
}

// DELETE ?id=...
export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Nedostaje id." }, { status: 400 });

  await db.delete(channels).where(eq(channels.id, id));
  return NextResponse.json({ ok: true });
}
