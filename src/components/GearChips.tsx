"use client";

import GearIcon from "@/components/GearIcon";
import { RARITIES, gearLabel, gearMeta } from "@/lib/gear";

export function GearChip({ gearKey }: { gearKey: string }) {
  const meta = gearMeta(gearKey);
  const rarity = RARITIES.find((r) => r.value === meta?.rarity);
  return (
    <span
      className="gear-chip"
      title={gearLabel(gearKey)}
      style={rarity ? { borderColor: rarity.color } : undefined}
    >
      <GearIcon gearKey={gearKey} size={22} />
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