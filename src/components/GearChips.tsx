"use client";

import { RARITIES, gearLabel, gearMeta } from "@/lib/gear";

const SLOT_ICON: Record<string, string> = {
  weapon: "\u2694",
  helmet: "\u26D1",
  chest: "\uD83E\uDDEA",
  pants: "\uD83D\uDC56",
  gloves: "\uD83E\uDDE4",
  boots: "\uD83D\uDC62",
  ammo: "\uD83D\uDCE6"
};

const KEY_ICON: Record<string, string> = {
  knife: "\uD83D\uDD2A",
  gun: "\uD83D\uDD2B",
  rifle: "\uD83C\uDFAF",
  sniper: "\uD83C\uDFAF",
  tank: "\uD83D\uDEE1",
  jet: "\u2708",
  lightAmmo: "\uD83D\uDCE6",
  heavyAmmo: "\uD83D\uDCE6"
};

function iconFor(key: string): string {
  if (KEY_ICON[key]) return KEY_ICON[key];
  const meta = gearMeta(key);
  if (meta) return SLOT_ICON[meta.slot] ?? "\u2699";
  return "\u2699";
}

export function GearChip({ gearKey }: { gearKey: string }) {
  const meta = gearMeta(gearKey);
  const rarity = RARITIES.find((r) => r.value === meta?.rarity);
  return (
    <span
      className="gear-chip"
      title={gearLabel(gearKey)}
      style={rarity ? { borderColor: rarity.color } : undefined}
    >
      <span className="gear-icon" aria-hidden>
        {iconFor(gearKey)}
      </span>
      <span className="gear-name">{gearLabel(gearKey)}</span>
    </span>
  );
}

export function GearChipRow({ gear }: { gear: string[] }) {
  if (!gear.length) return null;
  return (
    <div className="gear-row">
      <span className="contracts-lbl">Preporucena oprema</span>
      {gear.map((k) => (
        <GearChip key={k} gearKey={k} />
      ))}
    </div>
  );
}