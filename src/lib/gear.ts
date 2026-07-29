// War Era item alt keys: weapons + armor1-6 (common→mythic)
export type GearRarity = "common" | "uncommon" | "rare" | "epic" | "legendary" | "mythic";

export interface GearItem {
  key: string;
  label: string;
  slot: "weapon" | "helmet" | "chest" | "pants" | "gloves" | "boots" | "ammo";
  rarity: GearRarity;
}

export const RARITIES: { value: GearRarity; label: string; color: string }[] = [
  { value: "common", label: "Basic", color: "#9a9a9a" },
  { value: "uncommon", label: "Reinforced", color: "#009E73" },
  { value: "rare", label: "Advanced", color: "#56B4E9" },
  { value: "epic", label: "Elite", color: "#CC79A7" },
  { value: "legendary", label: "Legendary", color: "#F0E442" },
  { value: "mythic", label: "Mythic", color: "#D55E00" }
];

const RARITY_INDEX: Record<GearRarity, number> = {
  common: 1,
  uncommon: 2,
  rare: 3,
  epic: 4,
  legendary: 5,
  mythic: 6
};

export const WEAPONS: GearItem[] = [
  { key: "knife", label: "Noz", slot: "weapon", rarity: "common" },
  { key: "gun", label: "Pistolj", slot: "weapon", rarity: "uncommon" },
  { key: "rifle", label: "Puska", slot: "weapon", rarity: "rare" },
  { key: "sniper", label: "Snajper", slot: "weapon", rarity: "epic" },
  { key: "tank", label: "Tenk", slot: "weapon", rarity: "legendary" },
  { key: "jet", label: "Jet", slot: "weapon", rarity: "mythic" }
];

const ARMOR_SLOTS: { slot: GearItem["slot"]; label: string; prefix: string }[] = [
  { slot: "helmet", label: "Kaciga", prefix: "helmet" },
  { slot: "chest", label: "Prsluk", prefix: "chest" },
  { slot: "pants", label: "Hlace", prefix: "pants" },
  { slot: "gloves", label: "Rukavice", prefix: "gloves" },
  { slot: "boots", label: "Cizme", prefix: "boots" }
];

export const ARMOR: GearItem[] = ARMOR_SLOTS.flatMap((s) =>
  RARITIES.map((r) => ({
    key: `${s.prefix}${RARITY_INDEX[r.value]}`,
    label: `${s.label} · ${r.label}`,
    slot: s.slot,
    rarity: r.value
  }))
);

export const AMMO: GearItem[] = [
  { key: "lightAmmo", label: "Laka municija", slot: "ammo", rarity: "common" },
  { key: "heavyAmmo", label: "Teska municija", slot: "ammo", rarity: "uncommon" }
];

export const GEAR_CATALOG: GearItem[] = [...WEAPONS, ...ARMOR, ...AMMO];
export const GEAR_KEYS = GEAR_CATALOG.map((g) => g.key);

export const GEAR_SLOTS = [
  { slot: "weapon" as const, label: "Oruzje", options: WEAPONS },
  ...ARMOR_SLOTS.map((s) => ({
    slot: s.slot,
    label: s.label,
    options: ARMOR.filter((a) => a.slot === s.slot)
  })),
  { slot: "ammo" as const, label: "Municija", options: AMMO }
];

export function gearIconUrl(key: string): string {
  return `https://app.warera.io/images/items/${key}.png`;
}

export function gearLabel(key: string): string {
  return GEAR_CATALOG.find((g) => g.key === key)?.label ?? key;
}

export function gearMeta(key: string): GearItem | undefined {
  return GEAR_CATALOG.find((g) => g.key === key);
}