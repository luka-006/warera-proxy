// Katalog opreme s ikonama iz War Ere (app.warera.io/images/items/<key>.png)
export interface GearItem {
  key: string;
  label: string;
}

export const GEAR_CATALOG: GearItem[] = [
  { key: "knife", label: "Noz" },
  { key: "gun", label: "Pistolj" },
  { key: "rifle", label: "Puska" },
  { key: "sniper", label: "Snajper" },
  { key: "tank", label: "Tenk" },
  { key: "helmet", label: "Kaciga" },
  { key: "boots", label: "Cizme" },
  { key: "lightAmmo", label: "Laka municija" },
  { key: "heavyAmmo", label: "Teska municija" }
];

export const GEAR_KEYS = GEAR_CATALOG.map((g) => g.key);

export function gearIconUrl(key: string): string {
  return `https://app.warera.io/images/items/${key}.png`;
}

export function gearLabel(key: string): string {
  return GEAR_CATALOG.find((g) => g.key === key)?.label ?? key;
}
