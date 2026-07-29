"use client";

import { useEffect, useRef } from "react";

/**
 * Trazi browser/mobile Notification dozvolu i prikazuje
 * sistemsku notifikaciju kad stigne novi unread ping/order.
 */
export default function NotifyBridge() {
  const seen = useRef<Set<string>>(new Set());
  const primed = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;

    async function ensurePerm() {
      if (Notification.permission === "granted") return true;
      if (Notification.permission === "denied") return false;
      try {
        const p = await Notification.requestPermission();
        return p === "granted";
      } catch {
        return false;
      }
    }

    async function poll() {
      const r = await fetch("/api/notifications").catch(() => null);
      if (!r?.ok) return;
      const d = await r.json();
      const list: { id: string; title: string; body: string | null; link: string | null; read: boolean; kind: string }[] =
        d.notifications ?? [];

      if (!primed.current) {
        for (const n of list) seen.current.add(n.id);
        primed.current = true;
        return;
      }

      const fresh = list.filter((n) => !n.read && !seen.current.has(n.id));
      for (const n of fresh) {
        seen.current.add(n.id);
        if (["ping", "assign", "order", "help"].includes(n.kind) || n.title.startsWith("ORDER") || n.title.startsWith("PING")) {
          const ok = await ensurePerm();
          if (!ok) continue;
          try {
            const note = new Notification(n.title, {
              body: n.body ?? "Nova obavijest iz HR Ops",
              tag: n.id
            });
            note.onclick = () => {
              window.focus();
              if (n.link?.startsWith("http")) window.open(n.link, "_blank");
              else if (n.link) window.location.href = n.link;
              note.close();
            };
          } catch {
            /* ignore */
          }
        }
      }
    }

    poll();
    const t = setInterval(poll, 12_000);
    return () => clearInterval(t);
  }, []);

  return null;
}