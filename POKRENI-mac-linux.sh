#!/usr/bin/env bash
# Zapovjedni centar — pokretanje (Mac / Linux)
cd "$(dirname "$0")" || exit 1

echo "============================================"
echo "  ZAPOVJEDNI CENTAR - pokretanje"
echo "============================================"
echo

otvori() {
  if command -v open >/dev/null 2>&1; then open "$1"
  elif command -v xdg-open >/dev/null 2>&1; then xdg-open "$1"
  else echo "Otvori rucno: $1"; fi
}

if ! command -v node >/dev/null 2>&1; then
  echo "[!] Node.js nije pronaden."
  echo "    Aplikacija ce se otvoriti, ali BEZ zivih podataka."
  echo "    Za zive podatke instaliraj Node.js: https://nodejs.org"
  echo
  otvori "vojna-jedinica.html"
  exit 0
fi

echo "[1/2] Pokrecem proxy na http://localhost:8787 ..."
node warera-proxy.mjs &
PROXY_PID=$!
trap 'kill $PROXY_PID 2>/dev/null' EXIT INT TERM
sleep 2

echo "[2/2] Otvaram aplikaciju ..."
otvori "vojna-jedinica.html"

echo
echo "Prijava:  Luka  /  admin"
echo
echo "Za zive podatke: Administracija > Zivi podaci"
echo "upisi  http://localhost:8787  pa klikni Test veze."
echo
echo "Proxy radi. Pritisni Ctrl+C za prekid."
wait $PROXY_PID
