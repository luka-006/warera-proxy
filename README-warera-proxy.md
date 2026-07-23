# WarEra proxy — živi podaci za MU app

Mali backend koji čita s War Era API-ja (api2.warera.io) i servira ih tvojoj aplikaciji.
API key (ako ga koristiš) ostaje na serveru, nikad u pregledniku.

## Što treba
- Node 18+ (koristi ugrađeni `fetch`). Nema `npm install`, nema vanjskih biblioteka.

## Pokretanje
```
node warera-proxy.mjs
```
S opcijama:
```
PORT=8787 WARERA_API_KEY=tvoj_key node warera-proxy.mjs
```

Varijable okoline (sve opcionalne):
- `PORT` — port (zadano 8787)
- `WARERA_API_KEY` — tvoj API key (šalje se kao `X-API-Key`)
- `WARERA_JWT` — jwt sesija umjesto keya (šalje se kao `Cookie: jwt=...`)
- `WARERA_BASE` — zadano `https://api2.warera.io/trpc` (možeš staviti community gateway `https://gateway.warerastats.io/trpc`)
- `ALLOW_ORIGIN` — CORS origin (zadano `*`; u produkciji stavi domenu svoje app)
- `ROSTER_MAX` — koliko članova max dohvatiti za roster (zadano 80)

**Bitno:** aktivne bitke i roster rade **bez keya**. Key/JWT treba samo za neke endpointe (rankings, referrals).

## Rute
- `GET /health` — provjera
- `GET /api/battles?limit=200&active=1` — sve trenutne bitke, obogaćene: napadač i branitelj
  (ime države + ISO kod + zastava), regija i izravni `url` na bitku
- `GET /api/battle/:id` — detalji jedne bitke
- `GET /api/countries` — sve države u igri s imenima i zastavama
- `GET /api/mus?country=Croatia` — MU-ovi države (zadano Hrvatska), s brojem članova
- `GET /api/mu/:id` — sirovi podaci vojne jedinice
- `GET /api/mu/:id/roster` — jedinica + članovi s imenima
- `GET /api/search?q=<tekst>` — traži i vraća ID-eve po tipu

Države i regije se kešitraju 10 minuta, popis MU-ova 5 minuta, pa je osvježavanje brzo.

## Brzi test
```
curl "http://localhost:8787/health"
curl "http://localhost:8787/api/battles?limit=5"
curl "http://localhost:8787/api/mu/<muId>/roster"
```
Ili otvori `warera-live-test.html`, upiši URL proxyja i klikni „Dohvati aktivne bitke“.

## Deploy
Bilo gdje gdje ide Node (Render, Railway, Fly.io, VPS). Stavi `WARERA_API_KEY` u env varijable servisa,
nikad u kod ni u git. Stavi `ALLOW_ORIGIN` na domenu svoje app.

## Napomene
- API je neslužben (community reverse-engineering), rute se mogu promijeniti kad igra dobije update.
  Rute i format preuzeti iz otvorenog alata `warera-fetch` (github.com/majimawrks/warera-fetch) i community docsa.
- Ako koristiš gateway (`gateway.warerastats.io`), oni traže atribuciju „Supported by warerastats.io“.
- Ovo je read-only; proxy ništa ne upisuje natrag u igru.

## Spajanje s app (vojna-jedinica.html)

Već je spojeno. Redoslijed:

1. Pokreni proxy: `node warera-proxy.mjs`
2. Otvori `vojna-jedinica.html`, prijavi se kao admin (`Luka` / `admin`)
3. Administracija › **Živi podaci (proxy)** → upiši `http://localhost:8787` → **Test veze**
   (zelena kvačica znači da radi; adresa se sprema)

Nakon toga:

- **Bitke uživo.** Zasebna kartica: sve trenutne bitke, zastave i imena država, regija,
  izravni link na svaku bitku. Osvježava se sama svakih 30 s (može se isključiti),
  ima filter po državi/regiji i gumb **Države** za popis svih država sa zastavama.
  Gumb **Plan** pretvara bitku u plan s već popunjenim nazivom i linkom.
- **Hrvatski MU-ovi → whitelist.** U Administraciji otvori jedinicu i klikni
  **Hrvatski MU-ovi**: proxy skenira hrvatske igrače i izlista njihove MU-ove.
  Klik na **Poveži** veže tvoju jedinicu s pravim MU-om iz igre i odmah povuče roster.
  Svi članovi padnu na whitelist sa statusom „Čeka“, pa svatko sam postavi lozinku.
  Postojeći se ne dupliciraju, uloge se ne diraju.

Ako proxy nije postavljen ili ne radi, app to uredno javi i sve ostalo radi normalno.
