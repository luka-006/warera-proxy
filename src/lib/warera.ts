// Server-side War Era proxy. API kljuc nikad ne izlazi na klijenta.
// Deep linkovi (app.warera.io): /battle/<id> /country/<id> /region/<id>

const BASE = process.env.WARERA_API_BASE ?? "https://api2.warera.io/trpc";
const APP_BASE = process.env.WARERA_APP_BASE ?? "https://app.warera.io";
const API_KEY = process.env.WARERA_API_KEY;

export interface MuContract {
  id: string;
  name: string;
  avatarUrl?: string;
  link: string;
}

export interface BattleSide {
  countryId?: string;
  name?: string;
  countryCode?: string;
  damage?: number;
  points?: number;
  wonRounds?: number;
  link?: string; // app.warera.io/country/<id>
  // bounty (ako postoji nagrada za stetu)
  bountyPer1k?: number;
  bountyPool?: number;
  // jedinice s aktivnim ugovorom na ovoj strani
  contracts?: MuContract[];
}

export interface Battle {
  id: string;
  label: string;
  attacker: BattleSide;
  defender: BattleSide;
  regionId?: string;
  regionName?: string;
  regionLink?: string;
  warId?: string;
  warLink?: string;
  round?: number;
  roundsToWin?: number;
  totalDamage?: number;
  type?: string;
  link: string; // app.warera.io/battle/<id>
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
export function countryLink(countryId: string): string {
  return `${APP_BASE}/country/${countryId}`;
}
export function regionLink(regionId: string): string {
  return `${APP_BASE}/region/${regionId}`;
}
export function warLink(warId: string): string {
  return `${APP_BASE}/war/${warId}`;
}
export function muLink(muId: string): string {
  return `${APP_BASE}/mu/${muId}`;
}
export function userLink(userId: string): string {
  return `${APP_BASE}/user/${userId}`;
}

export function isConfigured(): boolean {
  return Boolean(API_KEY);
}

export const CROATIA_COUNTRY_ID =
  process.env.WARERA_CROATIA_COUNTRY_ID ?? "6813b6d446e731854c7ac7bc";
// Kirgistan = proxy drzava za Hrvatsku
export const KYRGYZSTAN_COUNTRY_ID =
  process.env.WARERA_KYRGYZSTAN_COUNTRY_ID ?? "6813b6d546e731854c7ac8c4";

/** Paralelno mapiranje s ogranicenjem istovremenih zahtjeva */
async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  });
  await Promise.all(workers);
  return out;
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
  battles.sort((a, b) => (b.totalDamage ?? 0) - (a.totalDamage ?? 0));

  await attachContracts(items, battles).catch(() => {});
  return battles;
}

/** muOrders na bitci su direktno MU id-evi -> logo jedinice pod ugovorom */
async function attachContracts(rawItems: any[], battles: Battle[]): Promise<void> {
  const ids = new Set<string>();
  for (const b of rawItems) {
    for (const id of b?.attacker?.muOrders ?? []) ids.add(String(id));
    for (const id of b?.defender?.muOrders ?? []) ids.add(String(id));
  }
  if (ids.size === 0) return;

  const list = [...ids].slice(0, 80);
  const resolved = await mapLimit(list, 8, async (id) => {
    const mu = await getMuById(id);
    return mu
      ? ({ id, name: mu.name ?? "Jedinica", avatarUrl: mu.avatarUrl, link: muLink(id) } as MuContract)
      : null;
  });
  const muMap = new Map<string, MuContract>();
  for (const c of resolved) if (c) muMap.set(c.id, c);

  const byId = new Map(battles.map((b) => [b.id, b]));
  for (const raw of rawItems) {
    const battle = byId.get(String(raw?._id ?? ""));
    if (!battle) continue;
    const att = (raw?.attacker?.muOrders ?? [])
      .map((id: string) => muMap.get(String(id)))
      .filter(Boolean) as MuContract[];
    const def = (raw?.defender?.muOrders ?? [])
      .map((id: string) => muMap.get(String(id)))
      .filter(Boolean) as MuContract[];
    if (att.length) battle.attacker.contracts = att;
    if (def.length) battle.defender.contracts = def;
  }
}

function side(
  raw: any,
  round: any,
  countries: Map<string, CountryInfo>
): BattleSide {
  const countryId = raw?.country as string | undefined;
  const info = countryId ? countries.get(countryId) : undefined;
  const per1k = num(raw?.moneyPer1kDamages);
  const pool = num(raw?.moneyPool);
  return {
    countryId,
    name: info?.name,
    countryCode: info?.code,
    damage: num(round?.damages, raw?.damages),
    points: num(round?.points),
    wonRounds: num(raw?.wonRoundsCount),
    link: countryId ? countryLink(countryId) : undefined,
    bountyPer1k: per1k && per1k > 0 ? per1k : undefined,
    bountyPool: pool && pool > 0 ? pool : undefined
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

  const regionId: string | undefined = b?.defender?.region || b?.attacker?.region || undefined;
  const regionName = regionId ? regions.get(regionId) : undefined;
  const warId: string | undefined = b?.war || undefined;

  const label =
    [attacker.name, defender.name].filter(Boolean).join(" vs ") ||
    regionName ||
    `Bitka ${id.slice(-5)}`;

  return {
    id,
    label,
    attacker,
    defender,
    regionId,
    regionName,
    regionLink: regionId ? regionLink(regionId) : undefined,
    warId,
    warLink: warId ? warLink(warId) : undefined,
    round: num(cr?.number),
    roundsToWin: num(b?.roundsToWin),
    totalDamage: (attacker.damage ?? 0) + (defender.damage ?? 0),
    type: b?.type,
    link: battleLink(id),
    updatedAt: new Date().toISOString()
  };
}

// --- Military units ---

export interface MuMember {
  id: string;
  username: string;
  avatarUrl?: string;
  link: string;
  isCommander: boolean;
  isManager: boolean;
  militaryRank?: number;
  level?: number;
}

export interface MilitaryUnit {
  id: string;
  name: string;
  avatarUrl?: string;
  link: string;
  countryId?: string;
  countryCode?: string;
  countryName?: string;
  regionId?: string;
  memberCount: number;
  commanders: MuMember[];
  managers: MuMember[];
  soldiers: MuMember[];
  weeklyDamage?: number;
  weeklyRank?: number;
}

export async function getUserLite(userId: string): Promise<any | null> {
  try {
    return await trpcGet<any>("user.getUserLite", { userId }, 3 * 60_000);
  } catch {
    return null;
  }
}

export async function getMuById(muId: string): Promise<any | null> {
  try {
    return await trpcGet<any>("mu.getById", { muId }, 10 * 60_000);
  } catch {
    return null;
  }
}

function toMember(
  u: any,
  id: string,
  flags: { commander: boolean; manager: boolean }
): MuMember {
  return {
    id,
    username: u?.username ?? id.slice(-6),
    avatarUrl: u?.avatarUrl,
    link: userLink(id),
    isCommander: flags.commander,
    isManager: flags.manager,
    militaryRank: u?.militaryRank,
    level: u?.leveling?.level
  };
}

export async function getMilitaryUnit(muId: string): Promise<MilitaryUnit | null> {
  const raw = await getMuById(muId);
  if (!raw) return null;
  const countries = await getCountryMap().catch(() => new Map<string, CountryInfo>());
  const cinfo = raw.country ? countries.get(raw.country) : undefined;

  const commanderIds: string[] = raw?.roles?.commanders ?? [];
  const managerIds: string[] = raw?.roles?.managers ?? [];
  const memberIds: string[] = raw?.members ?? [];

  // Resolve up to 40 members for display (commanders first)
  const priority = [
    ...new Set([...commanderIds, ...managerIds, ...memberIds])
  ].slice(0, 40);

  const resolved = await Promise.all(
    priority.map(async (id) => {
      const u = await getUserLite(id);
      return toMember(u, id, {
        commander: commanderIds.includes(id),
        manager: managerIds.includes(id)
      });
    })
  );

  const commanders = resolved.filter((m) => m.isCommander);
  const managers = resolved.filter((m) => m.isManager && !m.isCommander);
  const soldiers = resolved.filter((m) => !m.isCommander && !m.isManager);

  return {
    id: raw._id,
    name: raw.name ?? "Jedinica",
    avatarUrl: raw.avatarUrl,
    link: muLink(raw._id),
    countryId: raw.country,
    countryCode: cinfo?.code,
    countryName: cinfo?.name,
    regionId: raw.region,
    memberCount: memberIds.length,
    commanders,
    managers,
    soldiers,
    weeklyDamage: raw?.rankings?.muWeeklyDamages?.value,
    weeklyRank: raw?.rankings?.muWeeklyDamages?.rank
  };
}

export async function getMilitaryUnits(muIds: string[]): Promise<MilitaryUnit[]> {
  const units = await Promise.all(muIds.map((id) => getMilitaryUnit(id)));
  return units.filter((u): u is MilitaryUnit => Boolean(u));
}

/**
 * Otkrij jedinice iz Hrvatske i Kirgistana (proxy drzava).
 * Skenira top ljestvicu tjedne stete i filtrira po drzavi.
 */
export async function discoverCroatianMus(): Promise<{ id: string; name: string }[]> {
  const ranking = await trpcGet<any>(
    "ranking.getRanking",
    { rankingType: "muWeeklyDamages", limit: 300 },
    5 * 60_000
  );
  const items: any[] = Array.isArray(ranking?.items) ? ranking.items : [];
  const muIds = [...new Set(items.map((i) => String(i?.mu ?? i?._id ?? "")).filter(Boolean))];

  const wanted = new Set([CROATIA_COUNTRY_ID, KYRGYZSTAN_COUNTRY_ID]);
  const found: { id: string; name: string }[] = [];
  await mapLimit(muIds, 12, async (id) => {
    const mu = await getMuById(id);
    if (mu && wanted.has(String(mu.country))) {
      found.push({ id, name: mu.name ?? "Jedinica" });
    }
  });
  return found;
}

/** Izvuci MU id iz URL-a ili cistog id-a */
export function parseMuId(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  const m = t.match(/\/mu\/([a-f0-9]{20,})/i) || t.match(/^([a-f0-9]{20,})$/i);
  return m ? m[1] : null;
}
