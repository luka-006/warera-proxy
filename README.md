# Warera HR Ops — beta

Zapovjedni centar za hrvatske igrace igre **War Era**: nadzorna ploca uzivo,
biljeske zapovjednika ispod svake bitke, moderirani chat po kanalima i
administratorsko sucelje. Pristup je iskljucivo za rucno odobrene (whitelist)
igrace.

## Znacajke (beta)

- **Prijava/registracija** bez vanjskih servisa (bez Supabasea)
  - Registracija generira **jednokratnu zapovjednu frazu** (prikaz samo jednom)
  - Racun mora odobriti administrator (whitelist)
  - Prva prijava frazom -> postavljanje **trajne lozinke**
  - Sesija traje 90 dana (httpOnly cookie), bez svakodnevne prijave
- **Nadzorna ploca** — bitke uzivo s War Era API-ja: zastave, steta, runda,
  klikabilni linkovi na bitku
- **Biljeske zapovjednika (`+`)** ispod svake bitke s prioritetom
  (HITNO / VISOKO / NORMALNO / NISKO)
- **Chat** po kanalima: zapovjednik i admin pisu odmah; vojnik cita i moze
  zatraziti pravo pisanja koje odobrava zapovjednik/admin
- **Rangovi:** `admin`, `zapovjednik`, `vojnik`
- **Admin sucelje:** whitelist, promjena ranga, blokiranje, brisanje,
  odobravanje chat zahtjeva, upravljanje kanalima

## Tehnologija

- Next.js 15 (App Router) + TypeScript
- libSQL / Turso + Drizzle ORM
- bcryptjs (lozinke), httpOnly cookie sesije
- Server-side War Era proxy (API kljuc nikad ne izlazi na klijenta)

## Pokretanje lokalno

```bash
npm install
cp .env.example .env        # uredi vrijednosti (Windows: copy .env.example .env)
npm run db:push             # kreira tablice u local.db
npm run db:seed             # kreira admina + kanal #zapovjednistvo (ispisuje frazu)
npm run dev                 # http://localhost:3000
```

Prvi admin: pozivni znak iz `BOOTSTRAP_ADMIN_CALLSIGN`, jednokratna fraza se
ispise u konzoli pri `db:seed`. Prijavi se frazom i postavi lozinku.

## Varijable okruzenja

| Varijabla | Opis |
|-----------|------|
| `DATABASE_URL` | `file:local.db` lokalno; `libsql://...turso.io` u produkciji |
| `DATABASE_AUTH_TOKEN` | Turso token (samo produkcija) |
| `SESSION_SECRET` | dugi slucajni niz (>= 32 znaka) |
| `WARERA_API_KEY` | War Era API kljuc za nadzornu plocu |
| `WARERA_API_BASE` | zadano `https://api2.warera.io/trpc` |
| `WARERA_APP_BASE` | zadano `https://app.warera.io` (deep linkovi) |
| `BOOTSTRAP_ADMIN_CALLSIGN` | pozivni znak prvog admina |

## Deploy na Vercel

1. Poveži GitHub repo `Warera-proxy` s Vercelom.
2. Kreiraj Turso bazu i postavi `DATABASE_URL` + `DATABASE_AUTH_TOKEN`.
3. Postavi `SESSION_SECRET`, `WARERA_API_KEY`, `BOOTSTRAP_ADMIN_CALLSIGN`.
4. Nakon prvog deploya pokreni `npm run db:push` i `npm run db:seed`
   (lokalno prema Turso bazi, ili preko Vercel CLI-a).

## Napomena o War Era API-ju

War Era koristi tRPC preko HTTP GET-a. Sluzbena shema odgovora nije
dokumentirana pa proxy (`src/lib/warera.ts`) defenzivno mapira polja preko vise
mogucih naziva. Ako se struktura promijeni, prilagodi `normalizeBattle`.
