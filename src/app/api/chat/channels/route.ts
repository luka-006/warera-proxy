import { NextResponse } from "next/server";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { channels } from "@/db/schema";
import { requireActive } from "@/lib/guards";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireActive();
  if ("error" in auth) return auth.error;

  const rows = await db.select().from(channels).orderBy(asc(channels.createdAt));
  return NextResponse.json({ channels: rows });
}
