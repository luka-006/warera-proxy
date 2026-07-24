import { randomInt } from "crypto";

// Hrvatske rijeci za jednokratnu zapovjednu frazu.
// Fraza je citljiva, ali dovoljno duga i nasumicna da se ne moze pogoditi.
const WORDS = [
  "most", "oruzje", "tiho", "vuk", "sokol", "celik", "granica", "straza",
  "brdo", "rijeka", "oluja", "sjever", "jug", "istok", "zapad", "kamen",
  "hrast", "vatra", "led", "grom", "munja", "vjetar", "magla", "zora",
  "sumrak", "stijena", "dolina", "vrh", "polje", "sanjac", "kopna", "more",
  "val", "bura", "jugo", "ris", "medvjed", "orao", "jastreb", "zmaj",
  "koplje", "stit", "luk", "strijela", "topola", "jela", "bor", "breza",
  "utvrda", "bedem", "kula", "vrata", "sidro", "kompas", "karta", "signal",
  "baklja", "fenjer", "sjena", "svjetlo", "tama", "prah", "iskra", "plamen"
];

export interface GeneratedPhrase {
  phrase: string; // npr. "most-oruzje-tiho-k7p2"
}

export function generatePhrase(): GeneratedPhrase {
  const picks: string[] = [];
  for (let i = 0; i < 3; i++) {
    picks.push(WORDS[randomInt(WORDS.length)]);
  }
  // 4-znamenkasti alfanumericki sufiks (bez lako zamjenjivih znakova)
  const alphabet = "abcdefghijkmnpqrstuvwxyz23456789";
  let suffix = "";
  for (let i = 0; i < 4; i++) {
    suffix += alphabet[randomInt(alphabet.length)];
  }
  picks.push(suffix);
  return { phrase: picks.join("-") };
}

// Normalizacija pozivnog znaka (callsign)
export function normalizeCallsign(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, "");
}
