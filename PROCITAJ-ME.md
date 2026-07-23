# ZAPOVJEDNI CENTAR — War Era

Aplikacija za hrvatske vojne jedinice: nadzorna ploča s planovima i naredbama,
zapovjedni kanal, bitke uživo iz igre i whitelist za članove.

---

## Najbrže pokretanje

**Windows:** dvoklik na `POKRENI-windows.bat`
**Mac / Linux:** u terminalu `chmod +x POKRENI-mac-linux.sh` pa `./POKRENI-mac-linux.sh`

Ako nemaš Node.js, aplikacija svejedno radi — samo bez živih podataka iz igre.

**Samo aplikacija, bez ičega:** dvoklik na `vojna-jedinica.html`. Otvorit će se u pregledniku.

---

## Testni računi

| Korisničko ime | Lozinka | Uloga |
|---|---|---|
| `Luka` | `admin` | Administrator — vidi sve |
| `Marko` | `marko` | Zapovjednik — objavljuje planove, vidi poruke i bitke |
| `Ivan` | `ivan` | Zapovjednik |
| `Ante` | `ante` | Vojnik — vidi samo ploču svoje jedinice |
| `Josip` | `josip` | Vojnik |
| `Petar` | — | **nije aktiviran** (za test „Prvi put se prijavljuješ?“) |

---

## Živi podaci iz igre

1. Pokreni proxy (pokretač to radi sam, ili ručno: `node warera-proxy.mjs`)
2. Prijavi se kao `Luka`
3. **Administracija › Živi podaci** → upiši `http://localhost:8787` → **Test veze**

Kad je spojeno:

- **Bitke uživo** — sve trenutne bitke, zastave i imena država, regija,
  izravan link na svaku bitku. Osvježava se sama svakih 30 s. Gumb **Plan**
  pretvara bitku u naredbu s već popunjenim nazivom i linkom.
- **Države** — popis svih država u igri sa zastavama.
- **Hrvatski MU-ovi** — u Administraciji, unutar jedinice: izlista prave MU-ove
  iz igre, klik na **Poveži** povuče cijeli roster u whitelist.

API key nije obavezan. Treba samo za rangiranja i preporuke.
Ako ga imaš: `WARERA_API_KEY=tvoj_key node warera-proxy.mjs`
Key ostaje na serveru i nikad ne završi u pregledniku.

---

## Kako radi whitelist

1. Admin u Administraciji doda ime i dodijeli ulogu (ili povuče cijeli roster)
2. Član stoji kao **Čeka**
3. Član na prijavi klikne **„Prvi put se prijavljuješ?“**, upiše svoje ime i
   dvaput lozinku
4. Postaje **Aktivan**; aplikacija pamti njegovo ime na tom uređaju

Admin može bilo kad promijeniti ulogu, resetirati lozinku ili obrisati člana.

---

## Uloge

| | Nadzorna ploča | Bitke uživo | Poruke | Administracija |
|---|---|---|---|---|
| **Vojnik** | samo svoja jedinica | — | — | — |
| **Zapovjednik** | + objavljuje | ✓ | ✓ | — |
| **Administrator** | sve jedinice | ✓ | ✓ | ✓ |

---

## Datoteke

- `vojna-jedinica.html` — cijela aplikacija u jednoj datoteci
- `warera-proxy.mjs` — proxy za žive podatke (Node 18+, bez instalacije paketa)
- `warera-live-test.html` — zaseban test proxyja
- `zastava-hrvatske.jpg` — zastava u punoj veličini
- `README-warera-proxy.md` — detalji o proxyju i rutama

---

## Važno znati

Podaci (planovi, poruke, članovi) spremaju se u pregledniku na tom računalu.
Znači svatko tko otvori datoteku na svom računalu ima svoju kopiju.
Da svi dijele iste planove i poruke preko interneta, podatke treba prebaciti
na server — to je sljedeći korak kad budeš spreman.

Aplikacija treba internet dok je otvorena (učitava React i fontove).

War Era API je neslužben, pa se rute mogu promijeniti kad igra dobije update.
