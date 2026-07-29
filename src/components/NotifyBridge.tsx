"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * In-app toast + browser Notification.
 * Dozvola se trazi samo na klik gumba (browseri blokiraju auto-prompt).
 */
export default function NotifyBridge() {
  const seen = useRef<Set<string>>(new Set());
  const primed = useRef(false);
  const [toast, setToast] = useState<{ title: string; body: string } | null>(null);
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">("default");

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setPerm("unsupported");
      return;
    }
    setPerm(Notification.permission);
  }, []);

  const showOs = useCallback(async (title: string, body: string, tag: string, link: string | null) => {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    try {
      const note = new Notification(title, { body, tag });
      note.onclick = () => {
        window.focus();
        if (link?.startsWith("http")) window.open(link, "_blank");
        else if (link) window.location.href = link;
        note.close();
      };
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    async function poll() {
      const r = await fetch("/api/notifications").catch(() => null);
      if (!r?.ok) return;
      const d = await r.json();
      const list: {
        id: string;
        title: string;
        body: string | null;
        link: string | null;
        read: boolean;
        kind: string;
      }[] = d.notifications ?? [];

      if (!primed.current) {
        for (const n of list) seen.current.add(n.id);
        primed.current = true;
        return;
      }

      const fresh = list.filter((n) => !n.read && !seen.current.has(n.id));
      for (const n of fresh) {
        seen.current.add(n.id);
        // Uvijek in-app toast (radi i bez OS dozvole)
        setToast({ title: n.title, body: n.body ?? "" });
        window.setTimeout(() => setToast(null), 6000);
        await showOs(n.title, n.body ?? "Nova obavijest iz HR Ops", n.id, n.link);
        // osvjezi badge — Nav polla zasebno, ali trigger custom event
        window.dispatchEvent(new CustomEvent("hr-ops-notif"));
      }
    }

    poll();
    const t = setInterval(poll, 5_000);
    return () => clearInterval(t);
  }, [showOs]);

  async function enablePush() {
    if (!("Notification" in window)) return;
    try {
      const p = await Notification.requestPermission();
      setPerm(p);
      if (p === "granted") {
        setToast({ title: "Notifikacije ukljucene", body: "Pingovi ce skociti i kao sistemske obavijesti." });
        window.setTimeout(() => setToast(null), 4000);
      }
    } catch {
      setPerm("denied");
    }
  }

  return (
    <>
      {perm !== "granted" && perm !== "unsupported" && (
        <button type="button" className="push-enable" onClick={enablePush}>
          Ukljuci notifikacije ✶
        </button>
      )}
      {toast && (
        <div className="notif-toast reveal" role="status">
          <div className="notif-toast-title">{toast.title}</div>
          {toast.body && <div className="notif-toast-body">{toast.body}</div>}
          <button type="button" className="assign-x" onClick={() => setToast(null)}>
            ×
          </button>
        </div>
      )}
    </>
  );
}