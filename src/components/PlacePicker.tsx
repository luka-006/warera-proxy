"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export interface RegionOpt {
  id: string;
  name: string;
  link: string;
}

/** Tražilica regija War Ere — klik ubacuje tag ili callback */
export default function PlacePicker({
  onPick,
  buttonLabel = "Mjesto"
}: {
  onPick: (r: RegionOpt) => void;
  buttonLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [regions, setRegions] = useState<RegionOpt[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    if (!open || regions.length) return;
    setLoading(true);
    fetch("/api/warera/regions")
      .then((r) => r.json())
      .then((d) => setRegions(d.regions ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open, regions.length]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return regions.slice(0, 40);
    return regions.filter((r) => r.name.toLowerCase().includes(s)).slice(0, 40);
  }, [q, regions]);

  return (
    <div className="dd place-picker" ref={ref}>
      <button
        type="button"
        className="btn btn-sm chat-tool"
        onClick={() => setOpen((v) => !v)}
        title="Ubaci mjesto / regiju"
      >
        ◎ {buttonLabel}
      </button>
      {open && (
        <div className="dd-menu place-menu reveal">
          <div className="dd-title">Mjesta (War Era)</div>
          <input
            className="place-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Trazi (npr. Bosna, Zagreb)..."
            autoFocus
          />
          {loading && <div className="dd-empty">Ucitavanje...</div>}
          {!loading && filtered.length === 0 && <div className="dd-empty">Nema pogodaka</div>}
          {filtered.map((r) => (
            <button
              key={r.id}
              type="button"
              className="dd-item"
              onClick={() => {
                onPick(r);
                setOpen(false);
                setQ("");
              }}
            >
              {r.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}