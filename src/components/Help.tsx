"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/** Suptilni "?" — na mobitelu otvara fiksni panel (vidljiv) */
export default function Help({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent | TouchEvent) {
      const t = e.target as Node;
      if (ref.current && ref.current.contains(t)) return;
      const pop = document.getElementById("help-portal-pop");
      if (pop && pop.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("touchstart", onDoc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("touchstart", onDoc);
    };
  }, [open]);

  return (
    <span className="help" ref={ref}>
      <button
        type="button"
        className="help-btn"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-label="Pomoc"
      >
        ?
      </button>
      {open &&
        mounted &&
        createPortal(
          <div
            id="help-portal-pop"
            className="help-portal reveal"
            role="dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="help-portal-card">
              <div className="help-portal-head">
                <span>Info</span>
                <button type="button" className="assign-x" onClick={() => setOpen(false)}>
                  ×
                </button>
              </div>
              <p>{text}</p>
            </div>
          </div>,
          document.body
        )}
    </span>
  );
}