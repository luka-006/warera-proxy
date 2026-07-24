"use client";

import { ReactNode, useEffect, useRef, useState } from "react";

export interface DdOption {
  value: string;
  label: ReactNode;
  hint?: string;
  color?: string;
}

/**
 * Vojni animirani padajuci izbornik — zamjena za <select>.
 * Isti stil koristi i pin meni na nadzornoj ploci.
 */
export default function Dropdown({
  value,
  options,
  onChange,
  placeholder,
  className,
  align = "left"
}: {
  value: string;
  options: DdOption[];
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const current = options.find((o) => o.value === value);

  return (
    <div className={`dd ${className ?? ""}`} ref={ref}>
      <button
        type="button"
        className={`dd-btn ${open ? "open" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="dd-value" style={current?.color ? { color: current.color } : undefined}>
          {current?.label ?? placeholder ?? "Odaberi"}
        </span>
        <span className={`dd-caret ${open ? "up" : ""}`}>▾</span>
      </button>
      {open && (
        <div className={`dd-menu ${align === "right" ? "right" : ""}`} role="listbox">
          {options.map((o) => (
            <button
              type="button"
              key={o.value}
              role="option"
              aria-selected={o.value === value}
              className={`dd-item ${o.value === value ? "sel" : ""}`}
              style={o.color ? { color: o.color } : undefined}
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
            >
              <span>{o.label}</span>
              {o.hint && <span className="dd-hint">{o.hint}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
