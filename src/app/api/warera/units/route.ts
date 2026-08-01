import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { trackedMus, users } from "@/db/schema";
import { requireActive, requireAdmin } from "@/lib/guards";
import {
  discoverCroatianMus,
  getMilitaryUnits,
  isConfigured,
  parseMuId,
  placeholderMilitaryUnit,
  userLink,
  type MilitaryUnit
} from "@/lib/warera";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TEST_MU_ID = "__testmu__";

async function buildTestMu(): Promise<MilitaryUnit> {
  const appUsers = await db
    .select({
      id: users.id,
      callsign: users.callsign,
      rank: users.rank
    })
    .from(users)
    .where(eq(users.status, "aktivan"));

  const commanders = appUsers
    .filter((u) => u.rank === "admin" || u.rank === "visoki")
    .map((u) => ({
      id: u.id,
      username: u.callsign,
      link: userLink(u.id),
      isCommander: true,
      isManager: false
    }));
  const managers = appUsers
    .filter((u) => u.rank === "zapovjednik")
    .map((u) => ({
      id: u.id,
      username: u.callsign,
      link: userLink(u.id),
      isCommander: false,
      isManager: true
    }));
  const soldiers = appUsers
    .filter((u) => u.rank === "vojnik" || (!["admin", "visoki", "zapovjednik"].includes(u.rank)))
    .map((u) => ({
      id: u.id,
      username: u.callsign,
      link: userLink(u.id),
      isCommander: false,
      isManager: false
    }));

  // Ako nema vojnika, stavi sve aktivne kao vojnike (osim vec u zapovjednistvu)
  const taken = new Set([...commanders, ...managers].map((m) => m.id));
  const rest = appUsers
    .filter((u) => !taken.has(u.id))
    .map((u) => ({
      id: u.id,
      username: u.callsign,
      link: userLink(u.id),
      isCommander: false,
      isManager: false
    }));

  return {
    id: TEST_MU_ID,
    name: "TestMU",
    link: "/jedinice",
    countryCode: "hr",
    countryName: "Hrvatska",
    memberCount: appUsers.length,
    commanders: commanders.length ? commanders : appUsers.slice(0, 1).map((u) => ({
      id: u.id,
      username: u.callsign,
      link: userLink(u.id),
      isCommander: true,
      isManager: false
    })),
    managers,
    soldiers: soldiers.length ? soldiers : rest
  };
}

async function syncDiscoveredMus(force = false): Promise<{ id: string; name: string }[]> {
  if (!isConfigured()) {
    const tracked = await db.select().from(trackedMus);
    return tracked.map((t) => ({ id: t.muId, name: t.label ?? "Jedinica" }));
  }

  const found = await discoverCroatianMus(force);
  for (const mu of found) {
    await db
      .insert(trackedMus)
      .values({ muId: mu.id, label: mu.name, addedBy: "auto" })
      .onConflictDoUpdate({
        target: trackedMus.muId,
        set: { label: mu.name }
      });
  }
  return found;
}

async function loadCatalog(): Promise<{ id: string; name: string }[]> {
  const tracked = await db.select().from(trackedMus);
  if (tracked.length > 0) {
    return tracked.map((t) => ({ id: t.muId, name: t.label ?? "Jedinica" }));
  }
  if (!isConfigured()) return [];
  return syncDiscoveredMus(true);
}

export async function GET() {
  const auth = await requireActive();
  if ("error" in auth) return auth.error;

  let catalog: { id: string; name: string }[] = [];
  try {
    catalog = await loadCatalog();
  } catch {
    catalog = [];
  }

  const fromEnv = (process.env.WARERA_MU_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const catalogIds = catalog.map((c) => c.id);
  const allIds = [...new Set([...catalogIds, ...fromEnv])];
  const nameById = new Map(catalog.map((c) => [c.id, c.name]));

  const hasTest = allIds.includes(TEST_MU_ID);
  const wareraIds = allIds.filter((id) => id !== TEST_MU_ID);

  if (!allIds.length) {
    return NextResponse.json({
      units: [],
      configured: isConfigured(),
      message: "Nema pracenih jedinica. Admin ih dodaje u Sucelju."
    });
  }

  const units: MilitaryUnit[] = [];
  if (hasTest) {
    units.push(await buildTestMu());
  }

  if (wareraIds.length) {
    if (!isConfigured()) {
      return NextResponse.json({
        units,
        configured: false,
        message: units.length ? null : "War Era API kljuc nije postavljen."
      });
    }
    try {
      const remote = await getMilitaryUnits(wareraIds);
      const got = new Set(remote.map((u) => u.id));
      for (const id of wareraIds) {
        if (!got.has(id)) {
          remote.push(placeholderMilitaryUnit(id, nameById.get(id) ?? "Jedinica"));
        }
      }
      units.push(...remote);
    } catch {
      for (const id of wareraIds) {
        units.push(placeholderMilitaryUnit(id, nameById.get(id) ?? "Jedinica"));
      }
      if (!units.length) {
        return NextResponse.json(
          { units: [], configured: true, error: "Greska u dohvatu jedinica." },
          { status: 502 }
        );
      }
    }
  }

  units.sort((a, b) => (b.weeklyDamage ?? 0) - (a.weeklyDamage ?? 0));
  return NextResponse.json({
    units,
    configured: true,
    total: units.length,
    catalog: catalog.length,
    fetchedAt: new Date().toISOString()
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  let body: { muIdOrUrl?: string; label?: string; discover?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Neispravan zahtjev." }, { status: 400 });
  }

  if (body.discover) {
    if (!isConfigured()) {
      return NextResponse.json({ error: "API kljuc nije postavljen." }, { status: 400 });
    }
    try {
      const found = await syncDiscoveredMus(true);
      return NextResponse.json({
        found: found.length,
        names: found.map((f) => f.name).sort((a, b) => a.localeCompare(b, "hr"))
      });
    } catch {
      return NextResponse.json({ error: "Otkrivanje nije uspjelo." }, { status: 502 });
    }
  }

  const raw = (body.muIdOrUrl ?? "").trim();
  if (raw.toLowerCase() === "testmu" || raw === TEST_MU_ID) {
    await db
      .insert(trackedMus)
      .values({ muId: TEST_MU_ID, label: "TestMU", addedBy: auth.user.callsign })
      .onConflictDoUpdate({
        target: trackedMus.muId,
        set: { label: "TestMU" }
      });
    return NextResponse.json({ muId: TEST_MU_ID, label: "TestMU" });
  }

  const muId = parseMuId(raw);
  if (!muId) {
    return NextResponse.json({ error: "Neispravan MU ID ili link." }, { status: 400 });
  }

  await db
    .insert(trackedMus)
    .values({
      muId,
      label: body.label?.trim() || null,
      addedBy: auth.user.callsign
    })
    .onConflictDoNothing();

  return NextResponse.json({ muId });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const muId = req.nextUrl.searchParams.get("muId");
  if (!muId) return NextResponse.json({ error: "Nedostaje muId." }, { status: 400 });
  await db.delete(trackedMus).where(eq(trackedMus.muId, muId));
  return NextResponse.json({ ok: true });
}
