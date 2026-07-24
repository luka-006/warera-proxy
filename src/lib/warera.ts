// Server-side War Era proxy. API kljuc nikad ne izlazi na klijenta.
// War Era koristi tRPC preko HTTP GET: /trpc/<namespace>.<method>?input=<JSON>

const BASE = process.env.WARERA_API_BASE ?? "https://api2.warera.io/trpc";
const APP_BASE = process.env.WARERA_APP_BASE ?? "https://app.warera.io";
const API_KEY = process.env.WARERA_API_KEY;

export interface BattleSide {
  countryId?: string;
  name?: string;
  countryCode?: string; // ISO2 za zastavu
  damage?: number;
}

export interface Battle {
  id: string;
  label: string;
  attacker: BattleSide;
  defender: BattleSide;
  regionName?: string;
  round?: number;
  totalDamage?: number;
  status?: string;
  link: string;
  updatedAt: string;
}

interface CacheEntry {
  at: number;
  data: unknown;
}

const cache = new Map<string, CacheEntry>();
const TTL_MS = 45_000;

async function trpcGet<T>(path: string, input?: unknown): Promise<T> {
  const key = `${path}:${input ? JSON.stringify(input) : ""}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < TTL_MS) {
    return cached.data as T;
  }

  const url = new URL(`${BASE}/${path}`);
  if (input !== undefined) {
    url.searchParams.set("input", JSON.stringify(input));
  }

  const headers: Record<string, string> = { accept: "application/json" };
  if (API_KEY) headers["authorization"] = `Bearer ${API_KEY}`;

  const res = await fetch(url.toString(), {
    headers,
    // ne cache-amo na Next fetch sloju, imamo vlastiti cache
    cache: "no-store"
  });

  if (!res.ok) {
    throw new WareraError(`War Era API ${res.status}`, res.status);
  }

  const json = await res.json();
  // tRPC omotava rezultat u { result: { data: ... } }
  const data = json?.result?.data ?? json;
  cache.set(key, { at: Date.now(), data });
  return data as T;
}

export class WareraError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.status = status;
  }
}

export function battleLink(battleId: string): string {
  return `${APP_BASE}/battles/${battleId}`;
}

export function isConfigured(): boolean {
  return Boolean(API_KEY);
}

// Dohvat aktivnih bitaka. War Era shema nije sluzbeno dokumentirana pa
// mapiramo defenzivno preko vise mogucih naziva polja.
export async function getActiveBattles(): Promise<Battle[]> {
  // Pokusavamo nekoliko poznatih ruta; prva koja uspije se koristi.
  const raw = await trpcGet<any>("battle.getActiveBattles").catch(async () => {
    return trpcGet<any>("battle.getAll").catch(() => null);
  });

  const list: any[] = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.battles)
      ? raw.battles
      : Array.isArray(raw?.items)
        ? raw.items
        : [];

  return list.map(normalizeBattle);
}

function pick<T>(...vals: T[]): T | undefined {
  for (const v of vals) if (v !== undefined && v !== null) return v;
  return undefined;
}

function normalizeBattle(b: any): Battle {
  const id: string = String(pick(b?._id, b?.id, b?.battleId) ?? "");
  const attacker: BattleSide = {
    countryId: pick(b?.attacker?.countryId, b?.attackerCountryId),
    name: pick(b?.attacker?.name, b?.attackerName, b?.attacker?.country?.name),
    countryCode: pick(b?.attacker?.code, b?.attacker?.country?.code),
    damage: pick(b?.attacker?.damage, b?.attackerDamage)
  };
  const defender: BattleSide = {
    countryId: pick(b?.defender?.countryId, b?.defenderCountryId),
    name: pick(b?.defender?.name, b?.defenderName, b?.defender?.country?.name),
    countryCode: pick(b?.defender?.code, b?.defender?.country?.code),
    damage: pick(b?.defender?.damage, b?.defenderDamage)
  };
  const regionName = pick(b?.region?.name, b?.regionName, b?.region);
  const label =
    [attacker.name, defender.name].filter(Boolean).join(" vs ") ||
    regionName ||
    `Bitka ${id}`;

  return {
    id,
    label,
    attacker,
    defender,
    regionName,
    round: pick(b?.round, b?.currentRound),
    totalDamage: pick(b?.totalDamage, b?.damage),
    status: pick(b?.status, b?.state),
    link: battleLink(id),
    updatedAt: new Date().toISOString()
  };
}
