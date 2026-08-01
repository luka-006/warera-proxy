"use client";

import { useState } from "react";
import { gearIconSources, gearLabel, gearMeta, RARITIES } from "@/lib/gear";

const SLOT_EMOJI: Record<string, string> = {
  weapon: "\u2694",
  helmet: "\u26D1",
  chest: "\uD83E\uDDEA",
  pants: "\uD83D\uDC56",
  gloves: "\uD83E\uDDE4",
  boots: "\uD83D\uDC62",
  ammo: "\uD83D\uDCE6"
};

function fallbackEmoji(key: string): string {
  const meta = gearMeta(key);
  if (!meta) return "\u2699";
  if (meta.slot === "weapon") {
    if (key === "knife") return "\uD83D\uDD2A";
    if (key === "gun") return "\uD83D\uDD2B";
    if (key === "tank") return "\uD83D\uDEE1";
    if (key === "jet") return "\u2708";
    return "\uD83C\uDFAF";
  }
  return SLOT_EMOJI[meta.slot] ?? "\u2699";
}

export default function GearIcon({
  gearKey,
  size = 28,
  showLabel = false,
  className = ""
}: {
  gearKey: string;
  size?: number;
  showLabel?: boolean;
  className?: string;
}) {
  const [srcIdx, setSrcIdx] = useState(0);
  const sources = gearIconSources(gearKey);
  const meta = gearMeta(gearKey);
  const rarity = RARITIES.find((r) => r.value === meta?.rarity);
  const src = sources[srcIdx];
  const failed = !src || srcIdx >= sources.length;

  return (
    <span
      className={`gear-icon-wrap ${className}`}
      title={gearLabel(gearKey)}
      style={rarity ? { borderColor: rarity.color } : undefined}
    >
      {!failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={gearLabel(gearKey)}
          width={size}
          height={size}
          className="gear-icon-img"
          onError={() => setSrcIdx((i) => i + 1)}
        />
      ) : (
        <span className="gear-icon-fallback" style={{ width: size, height: size, fontSize: size * 0.62 }}>
          {fallbackEmoji(gearKey)}
        </span>
      )}
      {showLabel && <span className="gear-icon-lbl">{gearLabel(gearKey)}</span>}
    </span>
  );
}