// warera-proxy.mjs
// Backend/proxy za War Era API. Bez vanjskih biblioteka (Node 18+).
// Drži API key na serveru; app zove ovaj proxy, ne api2.warera.io direktno.
//
//   node warera-proxy.mjs
//   PORT=8787 WARERA_API_KEY=tvoj_key node warera-proxy.mjs
//
// Rute:
//   /health
//   /api/battles?limit=100          sve trenutne bitke (+ države, zastave, regija)
//   /api/battle/:id
//   /api/countries                  sve države (+ zastave)
//   /api/mus?country=Croatia        MU-ovi države (zadano Hrvatska)
//   /api/mu/:id  •  /api/mu/:id/roster
//   /api/search?q=

import http from "node:http";

const PORT = Number(process.env.PORT || 8787);
const BASE = process.env.WARERA_BASE || "https://api2.warera.io/trpc";
const API_KEY = (process.env.WARERA_API_KEY || "").trim();
const JWT = (process.env.WARERA_JWT || "").trim();
const ALLOW_ORIGIN = process.env.ALLOW_ORIGIN || "*";
const ROSTER_MAX = Number(process.env.ROSTER_MAX || 100);
const MU_SCAN_USERS = Number(process.env.MU_SCAN_USERS || 300); // koliko korisnika skenirati za popis MU-ova

// --- ISO kodovi za zastave -----------------------------------------------------
const ISO = {
  "afghanistan":"AF","albania":"AL","algeria":"DZ","angola":"AO","argentina":"AR","armenia":"AM","australia":"AU",
  "austria":"AT","azerbaijan":"AZ","bahrain":"BH","bangladesh":"BD","belarus":"BY","belgium":"BE","benin":"BJ",
  "bolivia":"BO","bosnia":"BA","bosnia and herzegovina":"BA","botswana":"BW","brazil":"BR","bulgaria":"BG",
  "burkina faso":"BF","burundi":"BI","cambodia":"KH","cameroon":"CM","canada":"CA","chad":"TD","chile":"CL",
  "china":"CN","colombia":"CO","congo":"CG","costa rica":"CR","croatia":"HR","cuba":"CU","cyprus":"CY",
  "czechia":"CZ","czech republic":"CZ","denmark":"DK","dominican republic":"DO","ecuador":"EC","egypt":"EG",
  "el salvador":"SV","estonia":"EE","ethiopia":"ET","finland":"FI","france":"FR","georgia":"GE","germany":"DE",
  "ghana":"GH","greece":"GR","guatemala":"GT","guinea":"GN","haiti":"HT","honduras":"HN","hungary":"HU",
  "iceland":"IS","india":"IN","indonesia":"ID","iran":"IR","iraq":"IQ","ireland":"IE","israel":"IL","italy":"IT",
  "ivory coast":"CI","jamaica":"JM","japan":"JP","jordan":"JO","kazakhstan":"KZ","kenya":"KE","kosovo":"XK",
  "kuwait":"KW","kyrgyzstan":"KG","laos":"LA","latvia":"LV","lebanon":"LB","libya":"LY","lithuania":"LT",
  "luxembourg":"LU","madagascar":"MG","malaysia":"MY","mali":"ML","malta":"MT","mexico":"MX","moldova":"MD",
  "mongolia":"MN","montenegro":"ME","morocco":"MA","mozambique":"MZ","myanmar":"MM","namibia":"NA","nepal":"NP",
  "netherlands":"NL","new zealand":"NZ","nicaragua":"NI","niger":"NE","nigeria":"NG","north korea":"KP",
  "north macedonia":"MK","macedonia":"MK","norway":"NO","oman":"OM","pakistan":"PK","palestine":"PS","panama":"PA",
  "papua new guinea":"PG","paraguay":"PY","peru":"PE","philippines":"PH","poland":"PL","portugal":"PT","qatar":"QA",
  "romania":"RO","russia":"RU","rwanda":"RW","saudi arabia":"SA","senegal":"SN","serbia":"RS","sierra leone":"SL",
  "singapore":"SG","slovakia":"SK","slovenia":"SI","somalia":"SO","south africa":"ZA","south korea":"KR",
  "south sudan":"SS","spain":"ES","sri lanka":"LK","sudan":"SD","sweden":"SE","switzerland":"CH","syria":"SY",
  "taiwan":"TW","tajikistan":"TJ","tanzania":"TZ","thailand":"TH","togo":"TG","tunisia":"TN","turkey":"TR",
  "turkmenistan":"TM","uganda":"UG","ukraine":"UA","united arab emirates":"AE","united kingdom":"GB",
  "great britain":"GB","england":"GB","united states":"US","united states of america":"US","usa":"US",
  "uruguay":"UY","uzbekistan":"UZ","venezuela":"VE","vietnam":"VN","yemen":"YE","zambia":"ZM","zimbabwe":"ZW",
};
function isoOf(name) {
  const n = String(name || "").trim().toLowerCase();
  if (!n) return null;
  if (ISO[n]) return ISO[n];
  for (const k of Object.keys(ISO)) if (n.includes(k)) return ISO[k];
  return null;
}
function flagOf(code) {
  if (!code || code.length !== 2) return "";
  return String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

// --- poziv na War Era ----------------------------------------------------------
async function trpc(endpoint, params = {}) {
  const url = `${BASE}/${endpoint}?input=${encodeURIComponent(JSON.stringify(params))}`;
  const headers = {
    "Origin": "https://app.warera.io",
    "Referer": "https://app.warera.io/",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  };
  if (JWT) headers["Cookie"] = `jwt=${JWT}`;
  else if (API_KEY) headers["X-API-Key"] = API_KEY;

  const res = await fetch(url, { headers });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { throw new Error(`Neispravan JSON s API-ja (HTTP ${res.status})`); }
  if (data && data.error && !data.result) {
    const e = data.error;
    throw new Error(`tRPC greška: ${(e.json && e.json.message) || e.message || JSON.stringify(e)}`);
  }
  if (!res.ok) throw new Error(`API HTTP ${res.status}`);
  return data?.result?.data;
}

const asList = (x) => Array.isArray(x) ? x : (x && Array.isArray(x.items) ? x.items : []);

// --- keš ----------------------------------------------------------------------
const cache = new Map();
async function cached(key, ttlMs, fn) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.t < ttlMs) return hit.v;
  const v = await fn();
  cache.set(key, { t: Date.now(), v });
  return v;
}

// --- države --------------------------------------------------------------------
async function countriesRaw() {
  return cached("countries", 10 * 60000, async () => asList(await trpc("country.getAllCountries", {})));
}
async function countryIndex() {
  const list = await countriesRaw();
  const byId = new Map();
  for (const c of list) {
    const code = c.code || c.iso || isoOf(c.name);
    byId.set(c._id, { id: c._id, name: c.name, code: code || null, flag: flagOf(code) });
  }
  return byId;
}
async function countriesPublic() {
  const idx = await countryIndex();
  return [...idx.values()].sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

// --- regije ---------------------------------------------------------------------
async function regionIndex() {
  return cached("regions", 10 * 60000, async () => {
    try {
      const obj = await trpc("region.getRegionsObject", {});
      const m = new Map();
      if (obj && typeof obj === "object") {
        for (const [k, v] of Object.entries(obj)) m.set(k, (v && (v.name || v.title)) || k);
      }
      return m;
    } catch { return new Map(); }
  });
}

// --- bitke ----------------------------------------------------------------------
async function getBattles(q) {
  const params = { limit: Number(q.get("limit") || 100) };
  if (q.get("active") !== "0") params.isActive = true;
  if (q.get("countryId")) params.countryId = q.get("countryId");

  const [raw, cIdx, rIdx] = await Promise.all([trpc("battle.getBattles", params), countryIndex(), regionIndex()]);
  const nazivDrzave = (id) => cIdx.get(id) || (id ? { id, name: null, code: null, flag: "" } : null);

  return asList(raw).map((b) => {
    const attId = b.attackerCountry || (b.attacker && (b.attacker.country || b.attacker._id)) || null;
    const defId = b.defenderCountry || (b.defender && (b.defender.country || b.defender._id)) || null;
    const regId = b.defenderRegion || b.region || b.regionId || null;
    return {
      id: b._id,
      url: b._id ? `https://app.warera.io/battle/${b._id}` : null,
      isActive: b.isActive !== false,
      napadac: attId ? nazivDrzave(attId) : null,
      branitelj: defId ? nazivDrzave(defId) : null,
      regija: regId ? { id: regId, name: rIdx.get(regId) || null } : null,
      naziv: b.name || null,
      raw: b,
    };
  });
}

// --- MU-ovi ---------------------------------------------------------------------
async function findCountryId(nameOrId) {
  const list = await countriesRaw();
  const byId = list.find((c) => c._id === nameOrId);
  if (byId) return byId._id;
  const n = String(nameOrId || "croatia").toLowerCase();
  const hit = list.find((c) => String(c.name || "").toLowerCase() === n)
    || list.find((c) => String(c.name || "").toLowerCase().includes(n));
  return hit ? hit._id : null;
}

// Popis MU-ova države: skenira korisnike te države i skuplja njihove MU-ove.
async function getMusForCountry(nameOrId) {
  const countryId = await findCountryId(nameOrId);
  if (!countryId) throw new Error(`Država nije pronađena: ${nameOrId}`);

  return cached("mus:" + countryId, 5 * 60000, async () => {
    const users = asList(await trpc("user.getUsersByCountry", { countryId, limit: MU_SCAN_USERS }));
    const ids = new Set();
    for (const u of users) {
      const mid = u.mu || u.muId || (u.militaryUnit && (u.militaryUnit._id || u.militaryUnit));
      if (mid && typeof mid === "string") ids.add(mid);
    }
    const out = await Promise.all([...ids].map(async (id) => {
      try {
        const mu = await trpc("mu.getById", { muId: id });
        return {
          id,
          name: mu?.name || null,
          membersCount: mu?.membersCount ?? (Array.isArray(mu?.members) ? mu.members.length : null),
          url: `https://app.warera.io/mu/${id}`,
        };
      } catch { return { id, name: null, membersCount: null, url: `https://app.warera.io/mu/${id}` }; }
    }));
    out.sort((a, b) => (b.membersCount || 0) - (a.membersCount || 0) || String(a.name).localeCompare(String(b.name)));
    return { countryId, scannedUsers: users.length, mus: out };
  });
}

async function getMuRoster(muId) {
  const mu = await trpc("mu.getById", { muId });
  const raw = Array.isArray(mu?.members) ? mu.members : [];
  const ids = raw.map((m) => (typeof m === "string" ? m : (m && (m.user || m._id || m.userId)))).filter(Boolean).slice(0, ROSTER_MAX);
  const members = await Promise.all(ids.map(async (id) => {
    try { const u = await trpc("user.getUserLite", { userId: id }); return { userId: id, username: u?.username || u?.name || null }; }
    catch { return { userId: id, username: null }; }
  }));
  return { mu: { id: mu?._id, name: mu?.name, membersCount: mu?.membersCount ?? members.length }, members };
}

// --- HTTP ------------------------------------------------------------------------
function send(res, code, body) {
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": ALLOW_ORIGIN,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(body));
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") return send(res, 204, {});
  const u = new URL(req.url, `http://localhost:${PORT}`);
  const path = u.pathname.replace(/\/+$/, "") || "/";
  const q = u.searchParams;
  try {
    if (path === "/health") return send(res, 200, { ok: true, base: BASE, auth: JWT ? "jwt" : (API_KEY ? "apikey" : "none") });
    if (path === "/api/battles") return send(res, 200, { battles: await getBattles(q), ts: Date.now() });
    if (path === "/api/countries") return send(res, 200, { countries: await countriesPublic() });
    if (path === "/api/mus") return send(res, 200, await getMusForCountry(q.get("country") || "Croatia"));

    let m;
    if ((m = path.match(/^\/api\/battle\/([^/]+)$/))) return send(res, 200, await trpc("battle.getById", { battleId: m[1] }));
    if ((m = path.match(/^\/api\/mu\/([^/]+)\/roster$/))) return send(res, 200, await getMuRoster(m[1]));
    if ((m = path.match(/^\/api\/mu\/([^/]+)$/))) return send(res, 200, await trpc("mu.getById", { muId: m[1] }));
    if (path === "/api/search") return send(res, 200, await trpc("search.searchAnything", { searchText: q.get("q") || "" }));

    return send(res, 404, { error: "Nepoznata ruta", routes: ["/health", "/api/battles", "/api/battle/:id", "/api/countries", "/api/mus?country=Croatia", "/api/mu/:id", "/api/mu/:id/roster", "/api/search?q="] });
  } catch (err) {
    console.error("[greška]", path, err.message);
    return send(res, 502, { error: String(err.message || err) });
  }
});

server.listen(PORT, () => {
  console.log(`WarEra proxy sluša na http://localhost:${PORT}`);
  console.log(`  API baza : ${BASE}`);
  console.log(`  Auth     : ${JWT ? "Cookie jwt" : (API_KEY ? "X-API-Key" : "nema (dovoljno za bitke, države i MU-ove)")}`);
  console.log(`  Test     : curl "http://localhost:${PORT}/api/battles?limit=5"`);
});
