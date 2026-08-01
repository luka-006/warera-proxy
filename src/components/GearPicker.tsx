"use client";

import GearIcon from "@/components/GearIcon";
import { GEAR_SLOTS, RARITIES, type GearItem } from "@/lib/gear";

export default function GearPicker({
  value,
  onChange
}: {
  value: string[];
  onChange: (keys: string[]) => void;
}) {
  function slotValue(slot: string) {
    return value.find((k) => GEAR_SLOTS.some((s) => s.slot === slot && s.options.some((o) => o.key === k))) ?? "";
  }

  function setSlot(slot: string, key: string) {
    const without = value.filter(
      (k) => !GEAR_SLOTS.find((s) => s.slot === slot)?.options.some((o) => o.key === k)
    );
    onChange(key ? [...without, key] : without);
  }

  return (
    <div className="gear-picker">
      {GEAR_SLOTS.map((slot) => (
        <div key={slot.slot} className="gear-picker-slot">
          <div className="gear-picker-slot-lbl">{slot.label}</div>
          <div className="gear-picker-grid">
            <button
              type="button"
              className={`gear-pick ${!slotValue(slot.slot) ? "on" : ""}`}
              onClick={() => setSlot(slot.slot, "")}
              title="Bez opreme"
            >
              <span className="gear-pick-none">-</span>
            </button>
            {slot.options.map((item: GearItem) => {
              const on = slotValue(slot.slot) === item.key;
              const color = RARITIES.find((r) => r.value === item.rarity)?.color;
              return (
                <button
                  key={item.key}
                  type="button"
                  className={`gear-pick ${on ? "on" : ""}`}
                  style={color ? { borderColor: on ? color : undefined } : undefined}
                  onClick={() => setSlot(slot.slot, item.key)}
                  title={item.label}
                >
                  <GearIcon gearKey={item.key} size={32} />
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}