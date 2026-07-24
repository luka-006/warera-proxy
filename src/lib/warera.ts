// Server-side War Era proxy. API kljuc nikad ne izlazi na klijenta.
// War Era koristi tRPC preko HTTP GET: /trpc/<namespace>.<method>?input=<JSON>
//
// Stvarni endpointi (community docs):
//   battle.getBattles?input={"isActive":true}  -> { items: [...] }
//   country.getAllCountries                     -> [ { _id, name, code } ]
//   region.getRegionsObject                     -> { <id>: { name, countryCode } }
// U bitkama su country/region samo ID-evi pa ih razrjesavamo u imena i zastave.

const BASE = process.env.WARERA_API_BASE ?? "https://api2.warera.io/trpc";
const APP_BASE = process.env.WARERA_APP_BASE ?? "https://app.warera.io";
const API_KEY = process.env.WARERA_API_KEY;

export interface BattleSide {
  countryId?: string;
  name?: string;
  countryCode?: string; // ISO2 za zastavu (npr. "hr")
  damage?: number;
  points?: number;
}

export interface Battle {
  id: string;
  label: string;
  attacker: BattleSide;
  defender: BattleSide;
  regionName?: string;
  round?: number;
  roundsToWin?: number;
  totalDamage?: number;
  type?: string;
  link: string;
  updatedAt: string;
}

export class WareraError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.status = status;
  }
}

interface CacheEntry {
  at: number;
  data: unknown;
}
const cache = new Map<string, CacheEntry>();

async function trpcGet<T>(path: string, input: unknown, ttlMs: number): Promise<T> {
  const key = `${path}:${input ? JSON.stringify(input) : ""}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < ttlMs) {
    return cached.data as T;
  }

  const url = new URL(`${BASE}/${path}`);
  if (input !== undefined) url.searchParams.set("input", JSON.stringify(input));

  const headers: Record<string, string> = { accept: "application/json" };
  if (API_KEY) headers["authorization"] = `Bearer ${API_KEY}`;

  const res = await fetch(url.toString(), { headers, cache: "no-store" });
  if (!res.ok) throw new WareraError(`War Era API ${res.status}`, res.status);

  const json = await res.json();
  const data = json?.result?.data ?? json;
  cache.set(key, { at: Date.now(), data });
  return data as T;
}

export function battleLink(battleId: string): string {
  return `${APP_BASE}/battle/${battleId}`;
}

export function isConfigured(): boolean {
  return Boolean(API_KEY);
}

interface CountryInfo {
  name: string;
  code?: string;
}

async function getCountryMap(): Promise<Map<string, CountryInfo>> {
  const list = await trpcGet<any[]>("country.getAllCountries", undefined, 5 * 60_000);
  const map = new Map<string, CountryInfo>();
  for (const c of list ?? []) {
    if (c?._id) map.set(c._id, { name: c.name ?? "?", code: c.code });
  }
  return map;
}

async function getRegionMap(): Promise<Map<string, string>> {
  const obj = await trpcGet<Record<string, any>>(
    "region.getRegionsObject",
    undefined,
    5 * 60_000
  );
  const map = new Map<string, string>();
  for (const [id, r] of Object.entries(obj ?? {})) {
    if (r?.name) map.set(id, r.name);
  }
  return map;
}

function num(...vals: any[]): number | undefined {
  for (const v of vals) if (typeof v === "number") return v;
  return undefined;
}

export async function getActiveBattles(): Promise<Battle[]> {
  const [countries, regions, raw] = await Promise.all([
    getCountryMap().catch(() => new Map<string, CountryInfo>()),
    getRegionMap().catch(() => new Map<string, string>()),
    trpcGet<any>("battle.getBattles", { isActive: true, limit: 60 }, 45_000)
  ]);

  const items: any[] = Array.isArray(raw?.items)
    ? raw.items
    : Array.isArray(raw)
      ? raw
      : [];

  const battles = items.map((b) => normalizeBattle(b, countries, regions));

  // Sortiraj po ukupnoj steti u trenutnoj rundi (najzesce bitke gore)
  battles.sort((a, b) => (b.totalDamage ?? 0) - (a.totalDamage ?? 0));
  return battles;
}

function side(
  raw: any,
  round: any,
  countries: Map<string, CountryInfo>
): BattleSide {
  const info = raw?.country ? countries.get(raw.country) : undefined;
  return {
    countryId: raw?.country,
    name: info?.name,
    countryCode: info?.code,
    damage: num(round?.damages, raw?.damages),
    points: num(round?.points)
  };
}

function normalizeBattle(
  b: any,
  countries: Map<string, CountryInfo>,
  regions: Map<string, string>
): Battle {
  const id = String(b?._id ?? "");
  const cr = b?.currentRound ?? {};
  const attacker = side(b?.attacker, cr?.attacker, countries);
  const defender = side(b?.defender, cr?.defender, countries);

  // Bitka se vodi za obrambenu regiju
  const regionName =
    (b?.defender?.region && regions.get(b.defender.region)) ||
    (b?.attacker?.region && regions.get(b.attacker.region)) ||
    undefined;

  const label =
    [attacker.name, defender.name].filter(Boolean).join(" vs ") ||
    regionName ||
    `Bitka ${id.slice(-5)}`;

  const totalDamage = (attacker.damage ?? 0) + (defender.damage ?? 0);

  return {
    id,
    label,
    attacker,
    defender,
    regionName,
    round: num(cr?.number),
    roundsToWin: num(b?.roundsToWin),
    totalDamage,
    type: b?.type,
    link: battleLink(id),
    updatedAt: new Date().toISOString()
  };
}
