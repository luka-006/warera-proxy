"use client";

import { useEffect, useRef, useState } from "react";

/** Suptilni "?" gumb — klik otvara kratko objasnjenje */
export default function Help({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <span className="help" ref={ref}>
      <button
        type="button"
        className="help-btn"
        onClick={() => setOpen((v) => !v)}
        aria-label="Pomoc"
      >
        ?
      </button>
      {open && <span className="help-pop reveal">{text}</span>}
    </span>
  );
}
