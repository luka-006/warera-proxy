"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { RANK_LABEL, isCommandRank, rankOutlineClass } from "@/lib/ranks";

interface Notif {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  createdAt: string | number | Date;
}

export default function Nav({
  callsign,
  rank
}: {
  callsign: string;
  rank: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [unread, setUnread] = useState(0);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const links = [
    { href: "/", label: "Ploca" },
    { href: "/plan", label: "Plan" },
    { href: "/jedinice", label: "Jedinice" },
    { href: "/status", label: "Status" }
  ];
  if (isCommandRank(rank)) {
    links.push({ href: "/chat", label: "Kanal" });
  }
  if (rank === "admin") {
    links.push({ href: "/admin", label: "Sucelje" });
  }

  const loadNotifs = useCallback(async () => {
    const r = await fetch("/api/notifications");
    if (!r.ok) return;
    const d = await r.json();
    setNotifs(d.notifications ?? []);
    setUnread(d.unread ?? 0);
  }, []);

  useEffect(() => {
    loadNotifs();
    const t = setInterval(loadNotifs, 8_000);
    function onCustom() {
      loadNotifs();
    }
    window.addEventListener("hr-ops-notif", onCustom);
    return () => {
      clearInterval(t);
      window.removeEventListener("hr-ops-notif", onCustom);
    };
  }, [loadNotifs]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/prijava");
    router.refresh();
  }

  async function markAll() {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ all: true })
    });
    setUnread(0);
    setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  async function openNotif(n: Notif) {
    if (!n.read) {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: n.id })
      });
      setUnread((u) => Math.max(0, u - 1));
      setNotifs((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    }
    setOpen(false);
    if (n.link?.startsWith("http")) {
      window.open(n.link, "_blank");
    } else if (n.link) {
      router.push(n.link);
    } else {
      router.push("/");
    }
  }

  return (
    <header className="topbar">
      <Link href="/" className="brand" style={{ textDecoration: "none" }}>
        <span className="dot" />
        <span className="brand-main">
          <span className="brand-full">HR OPERATIVNI CENTAR</span>
          <span className="brand-short">HR OPS</span>
          <span className="sub">HROC</span>
        </span>
      </Link>
      <nav className="nav">
        {links.map((l) => {
          const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
          return (
            <Link key={l.href} href={l.href} className={active ? "active" : ""}>
              {l.label}
            </Link>
          );
        })}
      </nav>
      <div className="topbar-right">
        <div className="dd notif-dd" ref={ref}>
          <button
            type="button"
            className={`notif-bell ${unread ? "has" : ""}`}
            onClick={() => {
              setOpen((v) => !v);
              if (!open) loadNotifs();
            }}
            title="Obavijesti"
          >
            ✶{unread > 0 && <span className="notif-badge">{unread > 9 ? "9+" : unread}</span>}
          </button>
          {open && (
            <div className="dd-menu notif-menu right reveal">
              <div className="dd-title" style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Obavijesti</span>
                {unread > 0 && (
                  <button type="button" className="linkish" style={{ margin: 0 }} onClick={markAll}>
                    Sve procitano
                  </button>
                )}
              </div>
              {notifs.length === 0 ? (
                <div className="dd-empty">Nema obavijesti</div>
              ) : (
                notifs.slice(0, 12).map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    className={`dd-item notif-item ${n.read ? "" : "unread"}`}
                    onClick={() => openNotif(n)}
                  >
                    <span className="notif-title">{n.title}</span>
                    {n.body && <span className="dd-hint">{n.body}</span>}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
        <span className="mono callsign-chip" title={callsign}>
          {callsign}
        </span>
        {RANK_LABEL[rank] ? (
          <span className={`rank-tag ${rankOutlineClass(rank)}`}>{RANK_LABEL[rank]}</span>
        ) : null}
        <button className="btn btn-sm logout-btn" onClick={logout} title="Odjava">
          <span className="logout-full">Odjava</span>
          <span className="logout-short">⎋</span>
        </button>
      </div>
    </header>
  );
}
